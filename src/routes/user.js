require("dotenv").config(); // Load environment variables

const express = require("express");
const router = express.Router();

// Create database connection
const db = require("better-sqlite3")("./reservations.db");

const { body, query, validationResult } = require("express-validator");

// BATCH MONITORING ROUTES - Must be defined before other reservation routes
// GET route for batch monitoring
router.get("/reservations/batch/monitoring", (req, res) => {
  console.log("[GET] /reservations/batch/monitoring - Request received");
  return res.status(200).json({
    message: "GET endpoint for batch monitoring is working",
    note: "For actual updates, use PATCH method with appropriate body parameters",
    example: {
      email: "user@example.com",
      active: true, // boolean true/false or string "true"/"false"
      ids: [1, 2, 3], // optional array of reservation IDs
    },
  });
});

// PATCH route for batch monitoring
router.patch("/reservations/batch/monitoring", async (req, res) => {
  console.log("[PATCH] /reservations/batch/monitoring - Request received");

  try {
    const { email, active } = req.body;

    // Manual validation for better error messages
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        receivedBody: req.body,
      });
    }

    // Convert string "true"/"false" to boolean if needed
    const activeBoolean =
      active === "true" ? true : active === "false" ? false : active;

    if (typeof activeBoolean !== "boolean") {
      return res.status(400).json({
        message: "Active must be a boolean value or 'true'/'false' string",
        received: active,
        receivedType: typeof active,
      });
    }

    // Check if any reservations exist for this email
    const existingReservations = db
      .prepare(
        "SELECT COUNT(*) as count FROM reservations WHERE email_address = ?"
      )
      .get(email);

    if (existingReservations.count === 0) {
      console.log(
        `[PATCH] /reservations/batch/monitoring - No reservations found for email: ${email}`
      );
      return res.status(404).json({
        message: "No reservations found for this email address",
        email: email,
        debug: {
          query:
            "SELECT COUNT(*) as count FROM reservations WHERE email_address = ?",
          params: [email],
        },
      });
    }

    let { ids } = req.body;
    let updateCount = 0;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Update specific reservations for this email
      const placeholders = ids.map(() => "?").join(",");
      console.log("Updating specific reservations with IDs:", ids);

      const result = db
        .prepare(
          `UPDATE reservations SET monitoring_active = ? WHERE id IN (${placeholders}) AND email_address = ?`
        )
        .run(activeBoolean ? 1 : 0, ...ids, email);

      updateCount = result.changes;
    } else {
      // Update all reservations for this email
      console.log("Updating all reservations for email:", email);

      const result = db
        .prepare(
          "UPDATE reservations SET monitoring_active = ? WHERE email_address = ?"
        )
        .run(activeBoolean ? 1 : 0, email);

      updateCount = result.changes;
    }

    console.log(
      `[PATCH] /reservations/batch/monitoring - Updated ${updateCount} reservations for email: ${email}`
    );

    return res.status(200).json({
      message: `Monitoring ${
        activeBoolean ? "enabled" : "disabled"
      } for ${updateCount} reservations`,
      count: updateCount,
    });
  } catch (error) {
    console.error(
      "[PATCH] /reservations/batch/monitoring - Error:",
      error.message
    );
    return res.status(500).json({
      message: "Failed to update monitoring status",
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Get all reservations for a user by email address
 * @route GET /api/user/reservations
 * @param {string} email - Email address of the user
 * @returns {Array} - Array of reservation objects
 */
router.get(
  "/reservations",
  [
    query("email")
      .isEmail()
      .withMessage("Valid email address is required")
      .normalizeEmail(),
  ],
  async (req, res) => {
    try {
      // Validate request parameters
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.query;

      // Fetch reservations for the specified email
      const reservations = db
        .prepare("SELECT * FROM reservations WHERE email_address = ?")
        .all(email);

      if (reservations.length === 0) {
        return res.status(404).json({
          message: "No reservations found for this email address",
        });
      }

      return res.status(200).json({
        message: "Reservations retrieved successfully",
        count: reservations.length,
        reservations: reservations,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to retrieve reservations",
        error: error.message,
      });
    }
  }
);

/**
 * Update monitoring status for a reservation
 * @route PATCH /api/user/reservations/:id/monitoring
 * @param {number} id - Reservation ID
 * @param {boolean} active - Monitoring status (true/false)
 * @returns {Object} - Updated reservation object
 */
router.patch(
  "/reservations/:id/monitoring",
  [
    body("active")
      .isBoolean()
      .withMessage("Monitoring status must be a boolean value"),
  ],
  async (req, res) => {
    try {
      // Validate request parameters
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { active } = req.body;

      // Check if reservation exists
      const reservation = db
        .prepare("SELECT * FROM reservations WHERE id = ?")
        .get(id);

      if (!reservation) {
        return res.status(404).json({
          message: "Reservation not found",
        });
      }

      // Update monitoring status
      db.prepare(
        "UPDATE reservations SET monitoring_active = ? WHERE id = ?"
      ).run(active ? 1 : 0, id);

      // Get updated reservation
      const updatedReservation = db
        .prepare("SELECT * FROM reservations WHERE id = ?")
        .get(id);

      return res.status(200).json({
        message: `Monitoring ${active ? "enabled" : "disabled"} successfully`,
        reservation: updatedReservation,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update monitoring status",
        error: error.message,
      });
    }
  }
);

/**
 * Update reservation dates
 * @route PATCH /api/user/reservations/:id/dates
 * @param {number} id - Reservation ID
 * @param {string} startDate - New start date (YYYY-MM-DD)
 * @param {string} endDate - New end date (YYYY-MM-DD)
 * @returns {Object} - Updated reservation object
 */
router.patch(
  "/reservations/:id/dates",
  [
    body("startDate")
      .isDate()
      .withMessage("Start date must be in YYYY-MM-DD format"),
    body("endDate")
      .isDate()
      .withMessage("End date must be in YYYY-MM-DD format")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
          throw new Error("End date must be after start date");
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      // Validate request parameters
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { startDate, endDate } = req.body;

      // Check if reservation exists
      const reservation = db
        .prepare("SELECT * FROM reservations WHERE id = ?")
        .get(id);

      if (!reservation) {
        return res.status(404).json({
          message: "Reservation not found",
        });
      }

      // Update reservation dates
      db.prepare(
        "UPDATE reservations SET reservation_start_date = ?, reservation_end_date = ? WHERE id = ?"
      ).run(startDate, endDate, id);

      // Get updated reservation
      const updatedReservation = db
        .prepare("SELECT * FROM reservations WHERE id = ?")
        .get(id);

      return res.status(200).json({
        message: "Reservation dates updated successfully",
        reservation: updatedReservation,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update reservation dates",
        error: error.message,
      });
    }
  }
);

/**
 * Delete a reservation
 * @route DELETE /api/user/reservations/:id
 * @param {number} id - Reservation ID
 * @returns {Object} - Success message
 */
router.delete("/reservations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if reservation exists
    const reservation = db
      .prepare("SELECT * FROM reservations WHERE id = ?")
      .get(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation not found",
      });
    }

    // Delete reservation
    db.prepare("DELETE FROM reservations WHERE id = ?").run(id);

    return res.status(200).json({
      message: "Reservation deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete reservation",
      error: error.message,
    });
  }
});

/**
 * Mark a reservation as deleted by the user (soft delete)
 * @route PATCH /api/user/reservations/:id/user-delete
 * @param {number} id - Reservation ID
 * @returns {Object} - Success message and the updated reservation (optional)
 */
router.patch("/reservations/:id/user-delete", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if reservation exists
    const reservation = db
      .prepare("SELECT * FROM reservations WHERE id = ?")
      .get(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation not found",
      });
    }

    // Check if already marked as deleted
    if (reservation.user_deleted === 1) {
      return res.status(409).json({
        // 409 Conflict might be appropriate
        message: "Reservation already marked as deleted by user",
        reservation: reservation, // Optionally return the existing state
      });
    }

    // Update user_deleted status
    const result = db
      .prepare("UPDATE reservations SET user_deleted = 1 WHERE id = ?")
      .run(id);

    // Check if the update was successful
    if (result.changes === 0) {
      // This case might occur if the reservation exists but the update fails for some reason,
      // though it's less likely with a simple update like this.
      // It could also happen in a race condition if deleted between the SELECT and UPDATE.
      return res.status(404).json({
        message: "Reservation found but could not be marked as deleted.",
      });
    }

    // Optionally, retrieve the updated reservation to return it
    const updatedReservation = db
      .prepare("SELECT * FROM reservations WHERE id = ?")
      .get(id);

    return res.status(200).json({
      message: "Reservation successfully marked as deleted by user",
      reservation: updatedReservation, // Return the updated record
    });
  } catch (error) {
    console.error(
      "[PATCH] /reservations/:id/user-delete - Error:",
      error.message
    );
    return res.status(500).json({
      message: "Failed to mark reservation as deleted",
      error: error.message,
    });
  }
});

/**
 * Get user statistics
 * @route GET /api/user/stats
 * @param {string} email - Email address of the user
 * @returns {Object} - User statistics
 */
router.get(
  "/stats",
  [
    query("email")
      .isEmail()
      .withMessage("Valid email address is required")
      .normalizeEmail(),
  ],
  async (req, res) => {
    try {
      // Validate request parameters
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.query;

      // Get user statistics
      const totalReservations = db
        .prepare(
          "SELECT COUNT(*) as count FROM reservations WHERE email_address = ?"
        )
        .get(email);

      const activeMonitoring = db
        .prepare(
          "SELECT COUNT(*) as count FROM reservations WHERE email_address = ? AND monitoring_active = 1"
        )
        .get(email);

      const successfulNotifications = db
        .prepare(
          "SELECT SUM(success_sent) as count FROM reservations WHERE email_address = ?"
        )
        .get(email);

      const totalAttempts = db
        .prepare(
          "SELECT SUM(attempts_made) as count FROM reservations WHERE email_address = ?"
        )
        .get(email);

      return res.status(200).json({
        message: "User statistics retrieved successfully",
        stats: {
          totalReservations: totalReservations.count,
          activeMonitoring: activeMonitoring.count,
          successfulNotifications: successfulNotifications.count || 0,
          totalAttempts: totalAttempts.count || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to retrieve user statistics",
        error: error.message,
      });
    }
  }
);

module.exports = router;
