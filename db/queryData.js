const Database = require("better-sqlite3");

// Open the database
const db = new Database("./reservations.db", { verbose: console.log });

try {
  // Query all reservations
  const rows = db.prepare("SELECT * FROM reservations").all();

  // Log the results
  console.log("Reservations:", rows);
} catch (err) {
  console.error("Error querying data:", err.message);
} finally {
  // Close the database connection
  db.close();
}
