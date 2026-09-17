require("dotenv").config();
const axios = require("axios");
const sqlite3 = require("better-sqlite3");
const { getDatabasePath } = require("../db/config.js");
const { sendEmailNotification } = require("../notifications/emails.js");
const notificationsTemplates = require("../notifications/notificationsTemplate.js");

// Path to your database
const db = sqlite3(getDatabasePath());

/**
 * User-Agent and Accept headers for Recreation.gov API calls
 */
const RECREATIONGOV_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json"
};

/**
 * Parses a date string to get year and month
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
 * Returns each calendar month touched by a date range
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
 * Fetches permit availability for itinerary-based permits (Rainier, NOCA, Olympic)
 * GET https://www.recreation.gov/api/permititinerary/{permitId}/division/{divisionId}/availability/month?month=M&year=Y
 * Returns: { bools: { "2026-07-15T00:00:00Z": true/false } }
 * @param {string} permitId
 * @param {string} divisionId
 * @param {number} year
 * @param {number} month
 * @returns {Promise<object>}
 */
const fetchItineraryAvailability = async (permitId, divisionId, year, month) => {
  const url = `https://www.recreation.gov/api/permititinerary/${permitId}/division/${divisionId}/availability/month?month=${month}&year=${year}`;
  
  try {
    const response = await axios.get(url, { headers: RECREATIONGOV_HEADERS });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`Itinerary availability not found for permit ${permitId} division ${divisionId} ${year}-${month}`);
      return { bools: {} };
    }
    throw error;
  }
};

/**
 * Fetches permit availability for standard permits (Mt Margaret, Enchantments)
 * GET https://www.recreation.gov/api/permits/{id}/availability?start_date=ISO&end_date=ISO&commercial_acct=false&is_lottery=false
 * Returns: { availability: { [divisionId]: { remaining: number, date_availability: { "2026-07-15T00:00:00Z": { remaining: number } } } } }
 * @param {string} permitId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<object>}
 */
const fetchStandardAvailability = async (permitId, startDate, endDate) => {
  const startDateISO = `${startDate}T00:00:00.000Z`;
  const endDateISO = `${endDate}T00:00:00.000Z`;
  const url = `https://www.recreation.gov/api/permits/${permitId}/availability?start_date=${encodeURIComponent(startDateISO)}&end_date=${encodeURIComponent(endDateISO)}&commercial_acct=false&is_lottery=false`;
  
  try {
    const response = await axios.get(url, { headers: RECREATIONGOV_HEADERS });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`Standard availability not found for permit ${permitId} (may be lottery or disabled)`);
      return { availability: {} };
    }
    throw error;
  }
};

/**
 * Checks if any date in the range is available for itinerary permit
 * @param {object} boolsData - { "2026-07-15T00:00:00Z": true/false }
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {boolean}
 */
const isItineraryAvailable = (boolsData, startDate, endDate) => {
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  for (
    let date = new Date(startDateObj);
    date <= endDateObj;
    date.setDate(date.getDate() + 1)
  ) {
    const formattedDate = date.toISOString().split("T")[0] + "T00:00:00Z";
    if (boolsData[formattedDate] === true) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if any date in the range has remaining availability for standard permit
 * @param {object} dateAvailability - { "2026-07-15T00:00:00Z": { remaining: number } }
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {boolean}
 */
const isStandardAvailable = (dateAvailability, startDate, endDate) => {
  if (!dateAvailability) {
    return false;
  }

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  for (
    let date = new Date(startDateObj);
    date <= endDateObj;
    date.setDate(date.getDate() + 1)
  ) {
    const formattedDate = date.toISOString().split("T")[0] + "T00:00:00Z";
    const remaining = dateAvailability[formattedDate]?.remaining;
    if (remaining && remaining > 0) {
      return true;
    }
  }

  return false;
};

/**
 * Fetches division name from permitcontent API (cached in permits routes, but we can fetch here too)
 * @param {string} permitId
 * @param {string} divisionId
 * @returns {Promise<string>}
 */
const getDivisionName = async (permitId, divisionId) => {
  try {
    const url = `https://www.recreation.gov/api/permitcontent/${permitId}`;
    const response = await axios.get(url, { headers: RECREATIONGOV_HEADERS });
    const divisions = response.data?.payload?.divisions || {};
    return divisions[divisionId]?.name || divisionId;
  } catch (error) {
    console.error(`Error fetching division name for ${permitId}/${divisionId}:`, error.message);
    return divisionId; // Fallback to division ID
  }
};

/**
 * Sends permit availability alert
 * @param {object} watch - The permit watch record
 * @param {string} divisionName - The name of the available division
 */
const sendPermitAvailabilityAlert = async (watch, divisionName) => {
  console.log(`Alert: Permit ${watch.permit_id} division ${divisionName} is now available!`);

  const placeholders = {
    permit_name: watch.permit_name,
    permit_id: watch.permit_id,
    division_name: divisionName,
    start_date: watch.start_date,
    end_date: watch.end_date,
    base_url: process.env.EXTERNAL_BASE_URL || "http://localhost:3000",
    watch_id: watch.id,
    email_address: encodeURIComponent(watch.email_address)
  };

  const subject = notificationsTemplates.formatTemplate(
    notificationsTemplates.permitAvailabilityFound.subject,
    placeholders
  );
  const message = notificationsTemplates.formatTemplate(
    notificationsTemplates.permitAvailabilityFound.body,
    placeholders
  );
  const htmlMessage = notificationsTemplates.formatTemplate(
    notificationsTemplates.permitAvailabilityFound.html,
    placeholders
  );

  await sendEmailNotification(
    watch.permit_id,
    subject,
    { text: message, html: htmlMessage },
    watch.email_address
  );

  db.prepare(
    "UPDATE permit_watches SET success_sent = success_sent + 1, last_success_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(watch.id);

  console.log(`Permit availability alert sent`, {
    permitId: watch.permit_id,
    permitName: watch.permit_name,
    divisionName,
    startDate: watch.start_date,
    endDate: watch.end_date,
    emailAddress: watch.email_address,
    url: `https://www.recreation.gov/permits/${watch.permit_id}/registration/detailed-availability`
  });
};

/**
 * Stops monitoring when the end date has passed
 * @param {object} watch
 * @returns {boolean} True when the watch is expired and was disabled
 */
const handleExpiredPermitWatch = (watch) => {
  const currentDate = new Date();
  const endDate = new Date(watch.end_date);

  if (currentDate <= endDate) {
    return false;
  }

  console.log(
    `Permit watch monitoring ended - End date ${watch.end_date} has passed for watch ID ${watch.id}`
  );

  db.prepare(
    "UPDATE permit_watches SET monitoring_active = 0, success_sent = 0 WHERE id = ?"
  ).run(watch.id);

  return true;
};

/**
 * Determines permit API type from catalog or falls back to itinerary
 * @param {string} permitId
 * @returns {string} - "itinerary" or "standard"
 */
const getPermitApiType = (permitId) => {
  const permitsCatalog = require("../data/permitsCatalog");
  const catalogEntry = permitsCatalog.find(p => p.id === permitId);
  return catalogEntry?.api_type || "itinerary";
};

/**
 * Processes one permit watch by checking availability
 * @param {object} watch
 */
const processPermitWatch = async (watch) => {
  if (handleExpiredPermitWatch(watch)) {
    return;
  }

  try {
    const divisionIds = JSON.parse(watch.division_ids);
    const apiType = getPermitApiType(watch.permit_id);

    let foundAvailability = false;
    let availableDivisionName = null;

    if (apiType === "itinerary") {
      // Itinerary-based permits (Rainier, NOCA, Olympic)
      const months = getMonthsInRange(watch.start_date, watch.end_date);

      for (const divisionId of divisionIds) {
        if (foundAvailability) break;

        for (const { year, month } of months) {
          const data = await fetchItineraryAvailability(
            watch.permit_id,
            divisionId,
            year,
            month
          );

          const bools = data?.bools || data?.payload?.bools || {};
          
          if (isItineraryAvailable(bools, watch.start_date, watch.end_date)) {
            foundAvailability = true;
            availableDivisionName = await getDivisionName(watch.permit_id, divisionId);
            break;
          }

          // Add a small delay between division checks to be polite
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else if (apiType === "standard") {
      // Standard permits (Mt Margaret, Enchantments)
      const data = await fetchStandardAvailability(
        watch.permit_id,
        watch.start_date,
        watch.end_date
      );

      const availability = data?.availability || {};

      for (const divisionId of divisionIds) {
        const divisionData = availability[divisionId];
        if (
          divisionData &&
          isStandardAvailable(divisionData.date_availability, watch.start_date, watch.end_date)
        ) {
          foundAvailability = true;
          availableDivisionName = await getDivisionName(watch.permit_id, divisionId);
          break;
        }
      }
    }

    if (foundAvailability && availableDivisionName) {
      console.log(
        `\n🎉 ALERT: Permit ${watch.permit_id} available for ${watch.start_date} to ${watch.end_date} at ${availableDivisionName}`
      );
      await sendPermitAvailabilityAlert(watch, availableDivisionName);
    } else {
      console.log(
        `Permit ${watch.permit_id} not available for ${watch.start_date} to ${watch.end_date}`
      );
    }

    db.prepare(
      "UPDATE permit_watches SET attempts_made = attempts_made + 1 WHERE id = ?"
    ).run(watch.id);
  } catch (error) {
    console.error(`Error processing permit watch ${watch.id}:`, error.message);
    db.prepare(
      "UPDATE permit_watches SET attempts_made = attempts_made + 1 WHERE id = ?"
    ).run(watch.id);
  }
};

/**
 * Main monitoring function for permit watches
 */
const monitorPermitWatches = async () => {
  const startTime = Date.now();
  
  try {
    const monitoringIntervalMinutes = parseInt(
      process.env.MONITOR_INTERVAL_MINUTES || "10",
      10
    );

    // Fetch active permit watches, filtering by last_success_sent_at
    const watches = db
      .prepare(
        `SELECT * FROM permit_watches
         WHERE monitoring_active = 1
         AND user_deleted = 0
         AND (last_success_sent_at IS NULL
              OR datetime(last_success_sent_at) < datetime('now', '-${monitoringIntervalMinutes} minutes'))`
      )
      .all();

    if (watches.length === 0) {
      console.log("No active permit watches to monitor.");
      return;
    }

    console.log(`\n=== Starting Permit Watch Monitoring Cycle ===`);
    console.log(`Processing ${watches.length} permit watches`);

    // Process watches with delays between each to be polite to Recreation.gov
    const batchDelayMs = parseInt(
      process.env.MONITOR_BATCH_DELAY_MS || "2000",
      10
    );

    for (let i = 0; i < watches.length; i++) {
      await processPermitWatch(watches[i]);
      
      // Add delay between watches except for the last one
      if (i < watches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    console.log("Permit watch monitoring cycle complete", {
      processedWatches: watches.length,
      durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const now = new Date().toISOString();
    console.log(`[${now}] Error during permit watch monitoring:`, error.message);
    console.log(
      `[${now}] Permit watch monitoring cycle failed after`,
      ((Date.now() - startTime) / 1000).toFixed(2),
      "seconds"
    );
  }
};

module.exports = { monitorPermitWatches, processPermitWatch };
