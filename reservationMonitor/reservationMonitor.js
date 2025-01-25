const sqlite3 = require("better-sqlite3"); // Use better-sqlite3 for improved performance
const { checkCampsiteAvailability } = require("../routes/campsites"); // Import availability check function

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
          //Todo: increment attempts_made
          if (availability.reservable) {
            console.log(
              `Alert: Campsite ${row.campsite_id} is now reservable!`
            );
            // Update database to stop monitoring
            db.prepare(
              "UPDATE reservations SET monitoring_active = 0 WHERE id = ?"
              //Todo: send alert and set success_sent to true
            ).run(row.id);
          }
        } catch (error) {
          console.error(
            `Error checking availability for campsite ${row.id}:`,
            error.message
          );
        }
      })
    );

    console.log("Monitoring cycle complete.");
    return results;
  } catch (error) {
    console.error("Error during reservation monitoring:", error.message);
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
