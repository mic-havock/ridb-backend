const Database = require("better-sqlite3");
const path = require("path");
const { getDatabasePath } = require("../src/db/config");

// Open or create the database using shared config helper
const dbPath = getDatabasePath();
const db = new Database(dbPath, { verbose: console.log });

console.log(`Initializing database at: ${path.resolve(dbPath)}`);

try {
  // Create the permit_watches table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS permit_watches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email_address TEXT NOT NULL,
      permit_id TEXT NOT NULL,
      permit_name TEXT NOT NULL,
      division_ids TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      group_size INTEGER,
      monitoring_active BOOLEAN NOT NULL DEFAULT 1,
      attempts_made INTEGER NOT NULL DEFAULT 0,
      success_sent INTEGER NOT NULL DEFAULT 0,
      last_success_sent_at DATETIME,
      user_deleted BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(createTableQuery);
  console.log('Table "permit_watches" created successfully.');
  console.log(`Database location: ${path.resolve(dbPath)}`);
} catch (err) {
  console.error("Error creating permit_watches table:", err.message);
} finally {
  // Close the database connection
  db.close();
}
