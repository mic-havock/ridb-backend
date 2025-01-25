const express = require("express");
const router = express.Router();
const Database = require("better-sqlite3");

// Open the database
const db = new Database("reservations.db", { verbose: console.log });

// Create a new reservation
router.post("/", (req, res) => {
  try {
    const {
      name,
      email_address,
      campsite_id,
      reservation_start_date,
      reservation_end_date,
      monitoring_active,
      attempts_made,
      success_sent,
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO reservations (
        name, email_address, campsite_id, reservation_start_date, reservation_end_date,
        monitoring_active, attempts_made, success_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      email_address,
      campsite_id,
      reservation_start_date,
      reservation_end_date,
      monitoring_active ? 1 : 0,
      attempts_made,
      success_sent ? 1 : 0
    );

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("Error creating reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all reservations
router.get("/", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM reservations");
    const reservations = stmt.all();
    res.json({ success: true, reservations });
  } catch (err) {
    console.error("Error fetching reservations:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a reservation by ID
router.get("/:id", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM reservations WHERE id = ?");
    const reservation = stmt.get(req.params.id);

    if (reservation) {
      res.json({ success: true, reservation });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }
  } catch (err) {
    console.error("Error fetching reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a reservation by ID
router.put("/:id", (req, res) => {
  try {
    const {
      name,
      email_address,
      campsite_id,
      reservation_start_date,
      reservation_end_date,
      monitoring_active,
      attempts_made,
      success_sent,
    } = req.body;

    const stmt = db.prepare(`
      UPDATE reservations
      SET name = ?, email_address = ?, campsite_id = ?, reservation_start_date = ?, reservation_end_date = ?, 
          monitoring_active = ?, attempts_made = ?, success_sent = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      name,
      email_address,
      campsite_id,
      reservation_start_date,
      reservation_end_date,
      monitoring_active ? 1 : 0,
      attempts_made,
      success_sent ? 1 : 0,
      req.params.id
    );

    if (result.changes > 0) {
      res.json({ success: true, message: "Reservation updated successfully" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }
  } catch (err) {
    console.error("Error updating reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a reservation by ID
router.delete("/:id", (req, res) => {
  try {
    const stmt = db.prepare("DELETE FROM reservations WHERE id = ?");
    const result = stmt.run(req.params.id);

    if (result.changes > 0) {
      res.json({ success: true, message: "Reservation deleted successfully" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }
  } catch (err) {
    console.error("Error deleting reservation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
