require("dotenv").config(); // Load environment variables
const sqlite3 = require("better-sqlite3"); // Use better-sqlite3 for improved performance
const { checkCampsiteAvailability } = require("../routes/campsites.js"); // Import availability check function
const { sendEmailNotification } = require("../notifications/emails.js"); // Import the sendEmailNotification function
const emailTemplates = require("../notifications/emailTemplates.js");

// Path to your database
const db = sqlite3("./reservations.db");

// Monitoring Logic
const monitorReservations = async () => {
  try {
    // Fetch only necessary columns (e.g., id) for active monitoring records
    const rows = db
      .prepare("SELECT * FROM reservations WHERE monitoring_active = 1")
      .all();

    if (rows.length === 0) {
      console.log("No active reservations to monitor.");
      return;
    }

    // Process records concurrently using Promise.all
    const results = await Promise.all(
      rows.map(async (row) => {
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
            console.log(
              `Alert: Campsite ${row.campsite_id} is now reservable!`
            );

            // Get templates from the templates file instead of env
            let subject = emailTemplates.success.subject;
            let message = emailTemplates.success.body;

            // Replace placeholders with actual values
            subject = subject.replace("{campsite_name}", row.campsite_name);

            message = message
              .replace("{campsite_name}", row.campsite_name)
              .replace("campsite_number", row.campsite_number)
              .replace("{campsite_id}", row.campsite_id)
              .replace("{start_date}", row.reservation_start_date)
              .replace("{end_date}", row.reservation_end_date)
              .replace("{base_url}", process.env.EXTERNAL_BASE_URL)
              .replace("{reservation_id}", row.id)
              .replace(
                "{email_address}",
                encodeURIComponent(row.email_address)
              );

            await sendEmailNotification(
              row.campsite_id,
              subject,
              message,
              row.email_address
            );

            // Increment success_sent counter
            db.prepare(
              "UPDATE reservations SET success_sent = success_sent + 1 WHERE id = ?"
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
  // Convert seconds to milliseconds for setInterval
  const intervalSeconds = process.env.MONITOR_INTERVAL_SECONDS || 60; // Default to 10 seconds if not set
  setInterval(monitorReservations, intervalSeconds * 1000);
};

module.exports = startReservationMonitor;
