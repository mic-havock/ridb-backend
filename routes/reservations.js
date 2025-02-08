const express = require("express");
const router = express.Router();
const db = require("better-sqlite3")("./reservations.db");

// Add route to disable monitoring
router.get("/disable-monitoring/:id", (req, res) => {
  try {
    const { id } = req.params;

    db.prepare(
      "UPDATE reservations SET monitoring_active = 0 WHERE id = ?"
    ).run(id);

    res.send("Monitoring disabled successfully!");
  } catch (error) {
    console.error("Error disabling monitoring:", error);
    res.status(500).send("Failed to disable monitoring");
  }
});

module.exports = router;
