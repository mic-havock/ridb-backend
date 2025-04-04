const express = require("express");
const router = express.Router();
const db = require("better-sqlite3")("./reservations.db");
const notificationsTemplate = require("../notifications/notificationsTemplate");
const { sendEmailNotification } = require("../notifications/emails");

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

    // Return a user-friendly HTML page using the template
    res.send(notificationsTemplate.htmlTemplates.monitoringDisabled);
  } catch (error) {
    console.error("Error disabling monitoring:", error);
    res.status(500).json({
      error: "Failed to disable monitoring",
      details: error.message,
    });
  }
});

// Create a new reservation
router.post("/", async (req, res) => {
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

    // Send confirmation email
    let subject = notificationsTemplate.confirmation.subject;
    let message = notificationsTemplate.confirmation.body;
    let htmlMessage = notificationsTemplate.confirmation.html;

    // Replace placeholders
    subject = subject
      .replace("{campsite_name}", campsite_name)
      .replace("{campsite_number}", campsite_number);

    message = message
      .replace("{campsite_name}", campsite_name)
      .replace("{campsite_number}", campsite_number)
      .replace("{campsite_id}", campsite_id)
      .replace("{start_date}", reservation_start_date)
      .replace("{end_date}", reservation_end_date)
      .replace(
        "{base_url}",
        process.env.EXTERNAL_BASE_URL || "http://localhost:3000"
      )
      .replace("{reservation_id}", result.lastInsertRowid)
      .replace("{email_address}", encodeURIComponent(email_address));

    htmlMessage = htmlMessage
      .replace("{campsite_name}", campsite_name)
      .replace("{campsite_number}", campsite_number)
      .replace("{campsite_id}", campsite_id)
      .replace("{start_date}", reservation_start_date)
      .replace("{end_date}", reservation_end_date)
      .replace(
        "{base_url}",
        process.env.EXTERNAL_BASE_URL || "http://localhost:3000"
      )
      .replace("{reservation_id}", result.lastInsertRowid)
      .replace("{email_address}", encodeURIComponent(email_address));

    await sendEmailNotification(
      campsite_id,
      subject,
      { text: message, html: htmlMessage },
      email_address
    );

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: `Monitoring enabled for ${campsite_name}. Confirmation email sent to ${email_address}`,
    });
  } catch (err) {
    console.error("Error creating reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
