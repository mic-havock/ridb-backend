const Database = require("better-sqlite3");
const path = require("path");

// Open the database using absolute path relative to repo root
const dbPath = path.join(__dirname, "..", "reservations.db");
const db = new Database(dbPath, { verbose: console.log });

console.log(`Using database at: ${path.resolve(dbPath)}`);

try {
  // Prepare the insert statement
  const insertStmt = db.prepare(`
    INSERT INTO reservations (
      name, email_address, campsite_id, campsite_name, reservation_start_date, reservation_end_date,
      monitoring_active, attempts_made, success_sent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert a row with boolean values converted to integers
  const info = insertStmt.run(
    "John Doe", // name
    "johndoe@example.com", // email_address
    "CAMP123", // campsite_id
    "Sunny Valley Campsite", // campsite_name
    "2025-06-01", // reservation_start_date
    "2025-06-07", // reservation_end_date
    1, // monitoring_active (true -> 1)
    3, // attempts_made
    0 // success_sent (false -> 0)
  );

  console.log("Row inserted successfully with ID:", info.lastInsertRowid);
} catch (err) {
  console.error("Error inserting data:", err.message);
} finally {
  // Close the database connection
  db.close();
}
