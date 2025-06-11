const Database = require("better-sqlite3");

// Open or create the database
const db = new Database("./reservations.db", { verbose: console.log });

try {
  // Create the table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email_address TEXT NOT NULL,
      campsite_id TEXT NOT NULL,
      campsite_name TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      campsite_number TEXT NOT NULL,
      reservation_start_date DATE NOT NULL,
      reservation_end_date DATE NOT NULL,
      monitoring_active BOOLEAN NOT NULL DEFAULT 0,
      attempts_made INTEGER NOT NULL DEFAULT 0,
      success_sent BOOLEAN NOT NULL DEFAULT 0,
      last_success_sent_at DATETIME,
      user_deleted BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(createTableQuery);
  console.log('Table "reservations" created successfully.');
} catch (err) {
  console.error("Error creating table:", err.message);
} finally {
  // Close the database connection
  db.close();
}
