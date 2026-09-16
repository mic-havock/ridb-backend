const Database = require("better-sqlite3");

// Open or create the database
const db = new Database("./reservations.db", { verbose: console.log });

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
} catch (err) {
  console.error("Error creating permit_watches table:", err.message);
} finally {
  // Close the database connection
  db.close();
}
