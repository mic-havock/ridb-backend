const Database = require("better-sqlite3");
const path = require("path");

// Open or create the database using absolute path relative to repo root
const dbPath = path.join(__dirname, "..", "reservations.db");
const db = new Database(dbPath, { verbose: console.log });

console.log(`Initializing database at: ${path.resolve(dbPath)}`);

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
  console.log(`Database location: ${path.resolve(dbPath)}`);
} catch (err) {
  console.error("Error creating table:", err.message);
} finally {
  // Close the database connection
  db.close();
}
