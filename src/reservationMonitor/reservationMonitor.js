require("dotenv").config(); // Load environment variables
const sqlite3 = require("better-sqlite3"); // Use better-sqlite3 for improved performance
const {
  checkCampsiteAvailability,
  fetchCampgroundMonthAvailability,
  isDateRangeReservable,
} = require("../routes/campsites.js"); // Import availability check function
const { sendEmailNotification } = require("../notifications/emails.js"); // Import the sendEmailNotification function
const notificationsTemplates = require("../notifications/notificationsTemplate.js");

// Path to your database
const db = sqlite3("./reservations.db");

/**
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {{ year: number, month: number } | null}
 */
const parseDateParts = (dateStr) => {
  const [year, month] = dateStr.split("-").map(Number);
  if (!year || !month) {
    return null;
  }
  return { year, month };
};

/**
 * Returns each calendar month touched by a reservation range.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @returns {Array<{ year: number, month: number }>}
 */
const getMonthsInRange = (startDateStr, endDateStr) => {
  const start = parseDateParts(startDateStr);
  const end = parseDateParts(endDateStr);
  if (!start || !end) {
    return [];
  }

  const months = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

/**
 * Groups reservations by facility ID.
 * @param {Array<Object>} rows
 * @returns {Map<string, Array<Object>>}
 */
const groupReservationsByFacility = (rows) => {
  const groups = new Map();

  for (const row of rows) {
    if (!row.facility_id) {
      continue;
    }

    if (!groups.has(row.facility_id)) {
      groups.set(row.facility_id, []);
    }
    groups.get(row.facility_id).push(row);
  }

  return groups;
};

/**
 * Collects unique months needed across a set of reservations.
 * @param {Array<Object>} rows
 * @returns {Array<{ year: number, month: number }>}
 */
const getUniqueMonthsForReservations = (rows) => {
  const monthKeys = new Map();

  for (const row of rows) {
    const months = getMonthsInRange(
      row.reservation_start_date,
      row.reservation_end_date
    );
    for (const { year, month } of months) {
      monthKeys.set(`${year}_${month}`, { year, month });
    }
  }

  return Array.from(monthKeys.values());
};

/**
 * Fetches campground availability for each month once.
 * @param {string} facilityId
 * @param {Array<{ year: number, month: number }>} months
 * @returns {Promise<Map<string, object>>}
 */
const fetchFacilityMonthData = async (facilityId, months) => {
  const monthData = new Map();

  for (const { year, month } of months) {
    const monthKey = `${year}_${month}`;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
    const data = await fetchCampgroundMonthAvailability(facilityId, startDate);
    monthData.set(monthKey, data);
  }

  return monthData;
};

/**
 * Merges availability across months for one campsite.
 * @param {Map<string, object>} monthDataMap
 * @param {string} campsiteId
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {{ availabilities: object, campsite_rules: object|undefined } | null}
 */
const getMergedCampsiteData = (
  monthDataMap,
  campsiteId,
  startDateStr,
  endDateStr
) => {
  const months = getMonthsInRange(startDateStr, endDateStr);
  let availabilities = {};
  let campsiteRules;

  for (const { year, month } of months) {
    const monthKey = `${year}_${month}`;
    const monthData = monthDataMap.get(monthKey);
    const campsiteData = monthData?.campsites?.[campsiteId];

    if (!campsiteData?.availabilities) {
      continue;
    }

    availabilities = { ...availabilities, ...campsiteData.availabilities };
    if (!campsiteRules && campsiteData.campsite_rules) {
      campsiteRules = campsiteData.campsite_rules;
    }
  }

  if (Object.keys(availabilities).length === 0) {
    return null;
  }

  return {
    availabilities,
    campsite_rules: campsiteRules,
  };
};

/**
 * Stops monitoring when the reservation end date has passed.
 * @param {Object} row
 * @returns {boolean} True when the reservation is expired and was disabled.
 */
const handleExpiredReservation = (row) => {
  const currentDate = new Date();
  const endDate = new Date(row.reservation_end_date);

  if (currentDate <= endDate) {
    return false;
  }

  console.log(
    "Reservation monitoring ended - End date " +
      row.reservation_end_date +
      " has passed for:"
  );
  console.log("Reservation ID:", row.id);
  console.log("Campsite ID:", row.campsite_id);
  console.log("Email:", row.email_address);

  db.prepare(
    "UPDATE reservations SET monitoring_active = 0, success_sent = 0 WHERE id = ?"
  ).run(row.id);

  return true;
};

/**
 * Sends an availability alert and updates reservation success counters.
 * @param {Object} row
 */
const sendAvailabilityAlert = async (row) => {
  console.log(`Alert: Campsite ${row.campsite_id} is now reservable!`);

  const placeholders = {
    campsite_name: row.campsite_name,
    campsite_number: row.campsite_number,
    campsite_id: row.campsite_id,
    start_date: row.reservation_start_date,
    end_date: row.reservation_end_date,
    base_url: process.env.EXTERNAL_BASE_URL,
    reservation_id: row.id,
    email_address: encodeURIComponent(row.email_address),
  };

  const subject = notificationsTemplates.formatTemplate(
    notificationsTemplates.availabilityFound.subject,
    placeholders
  );
  const message = notificationsTemplates.formatTemplate(
    notificationsTemplates.availabilityFound.body,
    placeholders
  );
  const htmlMessage = notificationsTemplates.formatTemplate(
    notificationsTemplates.availabilityFound.html,
    placeholders
  );

  await sendEmailNotification(
    row.campsite_id,
    subject,
    { text: message, html: htmlMessage },
    row.email_address
  );

  db.prepare(
    "UPDATE reservations SET success_sent = success_sent + 1, last_success_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(row.id);

  console.log(`Campsite availability alert`, {
    campsiteId: row.campsite_id,
    name: row.name,
    campsiteName: row.campsite_name,
    startDate: row.reservation_start_date,
    endDate: row.reservation_end_date,
    emailAddress: row.email_address,
    monitoringAttempts: row.attempts_made,
    url: `https://www.recreation.gov/camping/campsites/${row.campsite_id}`,
  });
};

/**
 * Processes one reservation using pre-fetched facility month data.
 * @param {Object} row
 * @param {Map<string, object>} monthDataMap
 */
const processFacilityReservation = async (row, monthDataMap) => {
  if (handleExpiredReservation(row)) {
    return;
  }

  const campsiteData = getMergedCampsiteData(
    monthDataMap,
    row.campsite_id,
    row.reservation_start_date,
    row.reservation_end_date
  );

  if (!campsiteData) {
    console.log(`No availability data for campsite ${row.campsite_id}`);
    db.prepare(
      "UPDATE reservations SET attempts_made = attempts_made + 1 WHERE id = ?"
    ).run(row.id);
    return;
  }

  const isAvailable = isDateRangeReservable(
    campsiteData.availabilities,
    campsiteData.campsite_rules,
    row.reservation_start_date,
    row.reservation_end_date
  );

  if (!isAvailable) {
    console.log(
      `Campsite ${row.campsite_id} not reservable for ${row.reservation_start_date} to ${row.reservation_end_date}`
    );
  } else {
    console.log(
      `\n🎉 ALERT: Campsite ${row.campsite_id} available for ${row.reservation_start_date} to ${row.reservation_end_date}`
    );
    await sendAvailabilityAlert(row);
  }

  db.prepare(
    "UPDATE reservations SET attempts_made = attempts_made + 1 WHERE id = ?"
  ).run(row.id);
};

/**
 * Pauses monitoring and restarts the cycle after rate-limit/server errors.
 * @param {number} status
 * @returns {Promise<boolean>}
 */
const handleRateLimitError = async (status) => {
  if (status !== 500 && status !== 429) {
    return false;
  }

  const monitoringIntervalMinutes = parseInt(
    process.env.MONITOR_INTERVAL_MINUTES || "10",
    10
  );
  console.log(
    `Received ${status} status code. Pausing entire monitoring process for ${monitoringIntervalMinutes} minutes...`
  );
  await new Promise((resolve) =>
    setTimeout(resolve, monitoringIntervalMinutes * 60 * 1000)
  );
  return true;
};

/**
 * Process a batch of reservations with throttling
 * @param {Array} batch - Array of reservation records to process
 * @returns {Promise<Array>} - Results of processing the batch
 */
const processBatch = async (batch) => {
  return Promise.all(
    batch.map(async (row) => {
      try {
        if (handleExpiredReservation(row)) {
          return;
        }

        const availability = await checkCampsiteAvailability(
          row.campsite_id,
          row.reservation_start_date,
          row.reservation_end_date
        );
        console.log(
          `Availability check result for campsite ${row.campsite_id}:`,
          availability
        );

        if (availability.isReservable) {
          await sendAvailabilityAlert(row);
        }

        db.prepare(
          "UPDATE reservations SET attempts_made = attempts_made + 1 WHERE id = ?"
        ).run(row.id);
      } catch (error) {
        console.log(`Error checking availability for campsite ${row.id}:`, {
          error: error.message,
          campsiteId: row.campsite_id,
          startDate: row.reservation_start_date,
          endDate: row.reservation_end_date,
        });
      }
    })
  );
};

/**
 * Processes arrays in batches with a delay between batches
 * @param {Array} array - The array to process in batches
 * @param {number} batchSize - Size of each batch
 * @param {number} delayMs - Delay between batches in milliseconds
 * @param {Function} processFn - Function to process each batch
 * @returns {Promise<Array>} - Combined results from all batches
 */
const processBatches = async (array, batchSize, delayMs, processFn) => {
  const results = [];

  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);
    console.log(
      `Processing batch ${i / batchSize + 1} of ${Math.ceil(
        array.length / batchSize
      )}, size: ${batch.length}`
    );

    const batchResults = await processFn(batch);
    results.push(...batchResults);

    // Add delay between batches if not the last batch
    if (i + batchSize < array.length) {
      console.log(`Waiting ${delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

// Monitoring Logic
const monitorReservations = async () => {
  const startTime = Date.now();
  try {
    const monitoringIntervalMinutes = parseInt(
      process.env.MONITOR_INTERVAL_MINUTES || "10",
      10
    );

    // Fetch active monitoring records, filtering by last_success_sent_at in SQL
    const rows = db
      .prepare(
        `SELECT * FROM reservations
         WHERE monitoring_active = 1
         AND user_deleted = 0
         AND (last_success_sent_at IS NULL
              OR datetime(last_success_sent_at) < datetime('now', '-${monitoringIntervalMinutes} minutes'))`
      )
      .all();

    if (rows.length === 0) {
      console.log("No active reservations to monitor.");
      return;
    }

    console.log(`\n=== Starting Monitoring Cycle ===`);
    console.log(`Processing ${rows.length} reservations`);

    let filteredRows = rows;

    const facilityGroups = groupReservationsByFacility(filteredRows);
    console.log(`\n=== Grouping Results ===`);
    console.log(`Total facility groups: ${facilityGroups.size}`);

    const multiReservationFacilities = new Map(
      Array.from(facilityGroups.entries()).filter(
        ([_, facilityRows]) => facilityRows.length > 1
      )
    );

    console.log(
      `Facilities with multiple reservations: ${
        multiReservationFacilities.size
      }, single reservations: ${
        facilityGroups.size - multiReservationFacilities.size
      }`
    );

    const processedFacilityRowIds = new Set();

    for (const [facilityId, facilityRows] of multiReservationFacilities.entries()) {
      try {
        const months = getUniqueMonthsForReservations(facilityRows);
        console.log(
          `\nProcessing facility ${facilityId} - ${facilityRows.length} reservations across ${months.length} month(s)`
        );

        try {
          const monthDataMap = await fetchFacilityMonthData(facilityId, months);
          console.log(
            `Fetched ${monthDataMap.size} month(s) of availability for facility ${facilityId}`
          );

          for (const row of facilityRows) {
            try {
              await processFacilityReservation(row, monthDataMap);
              processedFacilityRowIds.add(row.id);
            } catch (error) {
              console.error(
                `Error processing reservation ${row.id} in facility ${facilityId}:`,
                error.message
              );
            }
          }
        } catch (error) {
          const status = error.response ? error.response.status : null;
          if (await handleRateLimitError(status)) {
            return monitorReservations();
          }
          throw error;
        }
      } catch (error) {
        console.error(
          `Error processing facility ${facilityId}:`,
          error.message
        );
      }
    }

    filteredRows = filteredRows.filter(
      (row) => !processedFacilityRowIds.has(row.id)
    );

    const batchSize = parseInt(process.env.MONITOR_BATCH_SIZE || "10", 10);
    const batchDelayMs = parseInt(
      process.env.MONITOR_BATCH_DELAY_MS || "2000",
      10
    );

    console.log(
      `Processing ${filteredRows.length} single reservations in batches of ${batchSize}`
    );

    // Process records in batches with delay between batches
    const results = await processBatches(
      filteredRows,
      batchSize,
      batchDelayMs,
      processBatch
    );

    console.log("Monitoring cycle complete", {
      processedSingleReservations: filteredRows.length,
      processedFacilityReservations: Array.from(
        multiReservationFacilities.values()
      ).reduce((sum, facilityRows) => sum + facilityRows.length, 0),
      durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
      timestamp: new Date().toISOString(),
    });
    return results;
  } catch (error) {
    const now = new Date().toISOString();
    console.log(`[${now}] Error during reservation monitoring:`, error.message);
    console.log(
      `[${now}] Monitoring cycle failed after`,
      ((Date.now() - startTime) / 1000).toFixed(2),
      "seconds"
    );
  }
};

// Export a function to start the monitoring process
const startReservationMonitor = () => {
  console.log("Reservation monitoring process started...");
  const intervalSeconds = process.env.MONITOR_INTERVAL_SECONDS || 60; // Default to 60 seconds if not set
  // Convert seconds to milliseconds for setInterval
  setInterval(monitorReservations, intervalSeconds * 1000);
};

module.exports = startReservationMonitor;
