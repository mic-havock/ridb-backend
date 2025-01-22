const Database = require("better-sqlite3");

// Open the database
const db = new Database("./reservations.db", { verbose: console.log });

try {
  // Prepare the insert statement
  const insertStmt = db.prepare(`
    INSERT INTO reservations (
      name, email_address, campsite_id, reservation_start_date, reservation_end_date,
      monitoring_active, attempts_made, success_sent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert a row with boolean values converted to integers
  const info = insertStmt.run(
    "John Doe", // name
    "johndoe@example.com", // email_address
    "CAMP123", // campsite_id
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
