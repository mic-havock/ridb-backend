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
      facility_id,
      campsite_number,
      reservation_start_date,
      reservation_end_date,
      monitoring_active,
      attempts_made,
      success_sent,
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO reservations (
        name, email_address, campsite_id, campsite_name, facility_id, campsite_number, reservation_start_date, reservation_end_date,
        monitoring_active, attempts_made, success_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      email_address,
      campsite_id,
      campsite_name,
      facility_id,
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

/**
 * Route to create multiple reservations in bulk
 * @route POST /bulk
 * @param {Array} reservations - Array of reservation objects to create
 * @returns {object} Success or error message with created reservation IDs
 */
router.post("/bulk", async (req, res) => {
  try {
    const { reservations } = req.body;

    if (!Array.isArray(reservations) || reservations.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid reservations data. Expected non-empty array of reservations.",
      });
    }

    const createdReservations = [];
    const stmt = db.prepare(`
      INSERT INTO reservations (
        name, email_address, campsite_id, campsite_name, campsite_number, reservation_start_date, reservation_end_date,
        monitoring_active, attempts_made, success_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const reservation of reservations) {
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
      } = reservation;

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

      createdReservations.push({
        id: result.lastInsertRowid,
        campsite_name,
        campsite_number,
      });
    }

    // Send bulk confirmation email to the first reservation's email address
    const firstReservation = reservations[0];
    let subject = notificationsTemplate.bulkConfirmation.subject;
    let message = notificationsTemplate.bulkConfirmation.body;
    let htmlMessage = notificationsTemplate.bulkConfirmation.html;

    // Create campsite list for plain text
    const campsiteList = createdReservations
      .map((res) => `- ${res.campsite_name} (Site ${res.campsite_number})`)
      .join("\n");

    // Create campsite list for HTML
    const campsiteListHtml = createdReservations
      .map(
        (res) => `<li>${res.campsite_name} (Site ${res.campsite_number})</li>`
      )
      .join("");

    // Replace placeholders
    message = message
      .replace("{campsite_list}", campsiteList)
      .replace(
        "{base_url}",
        process.env.EXTERNAL_BASE_URL || "http://localhost:3000"
      )
      .replace("{reservation_id}", createdReservations[0].id)
      .replace(
        "{email_address}",
        encodeURIComponent(firstReservation.email_address)
      );

    htmlMessage = htmlMessage
      .replace("{campsite_list_html}", campsiteListHtml)
      .replace(
        "{base_url}",
        process.env.EXTERNAL_BASE_URL || "http://localhost:3000"
      )
      .replace("{reservation_id}", createdReservations[0].id)
      .replace(
        "{email_address}",
        encodeURIComponent(firstReservation.email_address)
      );

    await sendEmailNotification(
      "bulk",
      subject,
      { text: message, html: htmlMessage },
      firstReservation.email_address
    );

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdReservations.length} reservations`,
      reservations: createdReservations,
    });
  } catch (err) {
    console.error("Error creating bulk reservations:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
