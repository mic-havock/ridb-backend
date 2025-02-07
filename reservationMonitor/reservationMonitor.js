require("dotenv").config(); // Load environment variables
const sqlite3 = require("better-sqlite3"); // Use better-sqlite3 for improved performance
const { checkCampsiteAvailability } = require("../routes/campsites"); // Import availability check function
const { sendEmailNotification } = require("../notifications/emails"); // Import the sendEmailNotification function
const emailTemplates = require("../notifications/emailTemplates.js");

// Path to your database
const db = sqlite3("./reservations.db");

// Monitoring Logic
const monitorReservations = async () => {
  try {
    // Fetch only necessary columns (e.g., id) for active monitoring records
    const rows = db
      //.prepare("SELECT id FROM reservations WHERE monitoring_active = 1")
      .prepare("SELECT * FROM reservations WHERE monitoring_active = 0")
      .all();

    if (rows.length === 0) {
      console.log("No active reservations to monitor.");
      return;
    }

    // Process records concurrently using Promise.all
    const results = await Promise.all(
      rows.map(async (row) => {
        try {
          const availability = await checkCampsiteAvailability(
            row.campsite_id,
            row.reservation_start_date,
            row.reservation_end_date
          );
          console.log(
            `Availability check result for campsite ${row.campsite_id}:`,
            availability
          );
          //Todo: increment attempts_made
          if (availability.isReservable) {
            console.log(
              `Alert: Campsite ${row.campsite_id} is now reservable!`
            );

            // Get templates from the templates file instead of env
            let subject = emailTemplates.success.subject;
            let message = emailTemplates.success.body;

            // Replace placeholders with actual values
            subject = subject.replace("{campsite_id}", row.campsite_id);

            message = message
              .replace("{campsite_id}", row.campsite_id)
              .replace("{start_date}", row.reservation_start_date)
              .replace("{end_date}", row.reservation_end_date);

            await sendEmailNotification(
              row.campsite_id,
              subject,
              message,
              row.email_address
            );

            // Update database to stop monitoring
            db.prepare(
              "UPDATE reservations SET monitoring_active = 0 WHERE id = ?"
              //Todo: send alert and set success_sent to true
            ).run(row.id);

            console.log(`Campsite availability alert`, {
              campsiteId: row.campsite_id,
              name: row.name,
              startDate: row.reservation_start_date,
              endDate: row.reservation_end_date,
              emailAddress: row.email_address,
              monitoringAttempts: row.attempts_made,
              url: `https://www.recreation.gov/camping/campsites/${row.campsite_id}`,
            });
          }
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

    console.log("Monitoring cycle complete", {
      processedReservations: rows.length,
    });
    return results;
  } catch (error) {
    console.log("Error during reservation monitoring:", error.message);
  }
};

// Export a function to start the monitoring process
const startReservationMonitor = () => {
  console.log("Reservation monitoring process started...");
  // Run the monitoring logic every 5 minutes
  //setInterval(monitorReservations, 5 * 60 * 1000);
  //every 10 secs for development
  setInterval(monitorReservations, 15 * 1000);
};

module.exports = startReservationMonitor;
