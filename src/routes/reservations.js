const express = require("express");
const router = express.Router();
const db = require("better-sqlite3")("./reservations.db");
const notificationsTemplate = require("../notifications/notificationsTemplate");
const { sendEmailNotification } = require("../notifications/emails");
const { body, param, validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Route to disable monitoring for a specific reservation
 * @route GET /disable-monitoring/:id/:email
 * @param {string} id - The ID of the reservation to disable monitoring for
 * @param {string} email - The email address associated with the reservation
 * @returns {object} Success or error message
 */
router.get(
  "/disable-monitoring/:id/:email",
  [
    param("id").isInt().withMessage("Invalid reservation ID"),
    param("email").isEmail().withMessage("Invalid email address"),
  ],
  validate,
  (req, res) => {
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
router.post(
  "/",
  [
    body("name").notEmpty().trim(),
    body("email_address").isEmail().normalizeEmail(),
    body("campsite_id").notEmpty().trim(),
    body("campsite_name").notEmpty().trim(),
    body("facility_id").notEmpty().trim(),
    body("campsite_number").notEmpty().trim(),
    body("reservation_start_date").isDate(),
    body("reservation_end_date")
      .isDate()
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.reservation_start_date)) {
          throw new Error("End date must be the same as or after start date");
        }
        return true;
      }),
  ],
  validate,
  async (req, res) => {
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
    const placeholders = {
      campsite_name,
      campsite_number,
      campsite_id,
      start_date: reservation_start_date,
      end_date: reservation_end_date,
      base_url: process.env.EXTERNAL_BASE_URL || "http://localhost:3000",
      reservation_id: result.lastInsertRowid,
      email_address: encodeURIComponent(email_address),
    };

    const subject = notificationsTemplate.formatTemplate(
      notificationsTemplate.confirmation.subject,
      placeholders
    );
    const message = notificationsTemplate.formatTemplate(
      notificationsTemplate.confirmation.body,
      placeholders
    );
    const htmlMessage = notificationsTemplate.formatTemplate(
      notificationsTemplate.confirmation.html,
      placeholders
    );

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
router.post(
  "/bulk",
  [
    body("reservations").isArray({ min: 1 }),
    body("reservations.*.name").notEmpty().trim(),
    body("reservations.*.email_address").isEmail().normalizeEmail(),
    body("reservations.*.campsite_id").notEmpty().trim(),
    body("reservations.*.campsite_name").notEmpty().trim(),
    body("reservations.*.facility_id").notEmpty().trim(),
    body("reservations.*.campsite_number").notEmpty().trim(),
    body("reservations.*.reservation_start_date").isDate(),
    body("reservations.*.reservation_end_date")
      .isDate()
      .custom((value, { req, path }) => {
        const index = path.match(/\d+/)[0];
        const startDate = req.body.reservations[index].reservation_start_date;
        if (new Date(value) < new Date(startDate)) {
          throw new Error("End date must be the same as or after start date");
        }
        return true;
      }),
  ],
  validate,
  async (req, res) => {
    try {
      const { reservations } = req.body;

    const createdReservations = [];
    const insertTransaction = db.transaction((reservations) => {
      const stmt = db.prepare(`
        INSERT INTO reservations (
          name, email_address, campsite_id, campsite_name, facility_id, campsite_number, reservation_start_date, reservation_end_date,
          monitoring_active, attempts_made, success_sent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const reservation of reservations) {
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
        } = reservation;

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

        createdReservations.push({
          id: result.lastInsertRowid,
          campsite_name,
          campsite_number,
        });
      }
    });

    insertTransaction(reservations);

    // Send bulk confirmation email to the first reservation's email address
    const firstReservation = reservations[0];

    // Create campsite list for plain text and HTML
    const campsiteList = createdReservations
      .map((res) => `- ${res.campsite_name} (Site ${res.campsite_number})`)
      .join("\n");

    const campsiteListHtml = createdReservations
      .map(
        (res) => `<li>${res.campsite_name} (Site ${res.campsite_number})</li>`
      )
      .join("");

    const placeholders = {
      campsite_list: campsiteList,
      campsite_list_html: campsiteListHtml,
      base_url: process.env.EXTERNAL_BASE_URL || "http://localhost:3000",
      reservation_id: createdReservations[0].id,
      email_address: encodeURIComponent(firstReservation.email_address),
    };

    const subject = notificationsTemplate.bulkConfirmation.subject;
    const message = notificationsTemplate.formatTemplate(
      notificationsTemplate.bulkConfirmation.body,
      placeholders
    );
    const htmlMessage = notificationsTemplate.formatTemplate(
      notificationsTemplate.bulkConfirmation.html,
      placeholders
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
