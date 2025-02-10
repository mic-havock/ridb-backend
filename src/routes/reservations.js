const express = require("express");
const router = express.Router();
const db = require("better-sqlite3")("./reservations.db");

/**
 * Route to disable monitoring for a specific reservation
 * @route GET /disable-monitoring/:id/:email
 * @param {string} id - The ID of the reservation to disable monitoring for
 * @param {string} email - The email address associated with the reservation
 * @returns {object} Success or error message
 */
router.get("/disable-monitoring/:id/:email", (req, res) => {
  console.log("Disabling monitoring for reservation:", req.params.id);
  try {
    const { id, email } = req.params;

    // Validate that id exists and is a number
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: "Invalid reservation ID provided",
      });
    }

    // Update database to stop monitoring only if ID and email match
    const result = db
      .prepare(
        "UPDATE reservations SET monitoring_active = 0 WHERE id = ? AND email_address = ?"
      )
      .run(id, decodeURIComponent(email));

    // Check if any rows were updated
    if (result.changes === 0) {
      return res.status(404).json({
        error: "Reservation not found or email doesn't match",
      });
    }

    res.json({
      message: "Monitoring disabled successfully",
      reservationId: id,
    });
  } catch (error) {
    console.error("Error disabling monitoring:", error);
    res.status(500).json({
      error: "Failed to disable monitoring",
      details: error.message,
    });
  }
});

// Create a new reservation
router.post("/", (req, res) => {
  try {
    const {
      name,
      email_address,
      campsite_id,
      campsite_name,
      campsite_number,
      reservation_start_date,
      reservation_end_date,
      monitoring_active,
      attempts_made,
      success_sent,
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO reservations (
        name, email_address, campsite_id, campsite_name, campsite_number, reservation_start_date, reservation_end_date,
        monitoring_active, attempts_made, success_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      email_address,
      campsite_id,
      campsite_name,
      campsite_number,
      reservation_start_date,
      reservation_end_date,
      monitoring_active ? 1 : 0,
      attempts_made,
      success_sent ? 1 : 0
    );

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: `Monitoring enabled for ${campsite_name}`,
    });
  } catch (err) {
    console.error("Error creating reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
