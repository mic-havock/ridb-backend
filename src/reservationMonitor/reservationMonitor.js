require("dotenv").config(); // Load environment variables
const sqlite3 = require("better-sqlite3"); // Use better-sqlite3 for improved performance
const { checkCampsiteAvailability } = require("../routes/campsites.js"); // Import availability check function
const { sendEmailNotification } = require("../notifications/emails.js"); // Import the sendEmailNotification function
const notificationsTemplates = require("../notifications/notificationsTemplate.js");

// Path to your database
const db = sqlite3("./reservations.db");

/**
 * Process a batch of reservations with throttling
 * @param {Array} batch - Array of reservation records to process
 * @returns {Promise<Array>} - Results of processing the batch
 */
const processBatch = async (batch) => {
  return Promise.all(
    batch.map(async (row) => {
      try {
        // Check if reservation end date has passed
        const currentDate = new Date();
        const endDate = new Date(row.reservation_end_date);

        if (currentDate > endDate) {
          console.log(
            "Reservation monitoring ended - End date " +
              row.reservation_end_date +
              " has passed for:"
          );
          console.log("Reservation ID:", row.id);
          console.log("Campsite ID:", row.campsite_id);
          console.log("Email:", row.email_address);

          // Update database to stop monitoring for expired reservation
          db.prepare(
            "UPDATE reservations SET monitoring_active = 0, success_sent = 0 WHERE id = ?"
          ).run(row.id);

          return; // Exit the function instead of continue
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
          console.log(`Alert: Campsite ${row.campsite_id} is now reservable!`);

          // Get templates from the templates file instead of env
          let subject = notificationsTemplates.availabilityFound.subject;
          let message = notificationsTemplates.availabilityFound.body;
          let htmlMessage = notificationsTemplates.availabilityFound.html;

          // Replace placeholders with actual values
          subject = subject
            .replace("{campsite_name}", row.campsite_name)
            .replace("{campsite_number}", row.campsite_number);

          message = message
            .replace("{campsite_name}", row.campsite_name)
            .replace("{campsite_number}", row.campsite_number)
            .replace("{campsite_id}", row.campsite_id)
            .replace("{start_date}", row.reservation_start_date)
            .replace("{end_date}", row.reservation_end_date)
            .replace("{base_url}", process.env.EXTERNAL_BASE_URL)
            .replace("{reservation_id}", row.id)
            .replace("{email_address}", encodeURIComponent(row.email_address));

          htmlMessage = htmlMessage
            .replace("{campsite_name}", row.campsite_name)
            .replace("{campsite_number}", row.campsite_number)
            .replace("{campsite_id}", row.campsite_id)
            .replace("{start_date}", row.reservation_start_date)
            .replace("{end_date}", row.reservation_end_date)
            .replace("{base_url}", process.env.EXTERNAL_BASE_URL)
            .replace("{reservation_id}", row.id)
            .replace("{email_address}", encodeURIComponent(row.email_address));

          await sendEmailNotification(
            row.campsite_id,
            subject,
            { text: message, html: htmlMessage },
            row.email_address
          );

          // Increment success_sent counter and update timestamps
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
        }
        //Incrememt attempts made
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
  try {
    // Fetch only necessary columns (e.g., id) for active monitoring records
    const rows = db
      .prepare(
        "SELECT * FROM reservations WHERE monitoring_active = 1 and user_deleted = 0"
      )
      .all();

    if (rows.length === 0) {
      console.log("No active reservations to monitor.");
      return;
    }

    // Filter out rows where last_success_sent_at is less than 10 minutes ago
    const monitoringIntervalMinutes = parseInt(
      process.env.MONITOR_INTERVAL_MINUTES || "10",
      10
    );
    const tenMinutesAgo = new Date(
      Date.now() - monitoringIntervalMinutes * 60 * 1000
    );
    let filteredRows = rows.filter((row) => {
      const lastSuccessSentAt = new Date(row.last_success_sent_at);
      return isNaN(lastSuccessSentAt) || lastSuccessSentAt < tenMinutesAgo;
    });

    if (filteredRows.length === 0) {
      console.log("No reservations to process after filtering.");
      return;
    }

    // Group rows by same month and facility ID
    const sameMonthFacilityGroups = filteredRows.reduce((groups, row) => {
      // Parse dates directly from strings (format: YYYY-MM-DD)
      const [startYear, startMonth] = row.reservation_start_date
        .split("-")
        .map(Number);
      const [endYear, endMonth] = row.reservation_end_date
        .split("-")
        .map(Number);

      // Check if start and end dates are in the same month and year
      if (startMonth === endMonth && startYear === endYear) {
        const key = `${row.facility_id}_${startYear}_${startMonth}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(row);
      }
      return groups;
    }, {});

    // Filter out groups that only have one row
    const multiRowGroups = Object.entries(sameMonthFacilityGroups).reduce(
      (acc, [key, rows]) => {
        if (rows.length > 1) {
          acc[key] = rows;
        }
        return acc;
      },
      {}
    );

    // Log the contents of multiRowGroups
    console.log(
      "Same Month Facility Groups (multiple rows only):",
      JSON.stringify(multiRowGroups, null, 2)
    );

    // Remove grouped rows from filteredRows
    const groupedRowIds = new Set();
    Object.values(multiRowGroups).forEach((group) => {
      group.forEach((row) => groupedRowIds.add(row.id));
    });
    filteredRows = filteredRows.filter((row) => !groupedRowIds.has(row.id));

    const batchSize = parseInt(process.env.MONITOR_BATCH_SIZE || "10", 10);
    const batchDelayMs = parseInt(
      process.env.MONITOR_BATCH_DELAY_MS || "2000",
      10
    );

    console.log(
      `Processing ${filteredRows.length} reservations in batches of ${batchSize} with ${batchDelayMs}ms delay between batches`
    );

    // Process records in batches with delay between batches
    const results = await processBatches(
      filteredRows,
      batchSize,
      batchDelayMs,
      processBatch
    );

    console.log("Monitoring cycle complete", {
      processedReservations: filteredRows.length,
    });
    return results;
  } catch (error) {
    console.log("Error during reservation monitoring:", error.message);
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
