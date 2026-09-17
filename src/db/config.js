/**
 * Shared database configuration
 * Ensures all modules use the same absolute path to the database file
 */
const path = require("path");

/**
 * Get the absolute path to the reservations database
 * @returns {string} Absolute path to reservations.db in the repo root
 */
function getDatabasePath() {
  // Path is relative to this file's location (src/db/)
  return path.join(__dirname, "..", "..", "reservations.db");
}

module.exports = {
  getDatabasePath
};
