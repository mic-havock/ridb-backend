const express = require("express");
const axios = require("axios");
const router = express.Router();
const db = require("better-sqlite3")("./reservations.db");
const notificationsTemplate = require("../notifications/notificationsTemplate");
const { sendEmailNotification } = require("../notifications/emails");
const { body, param, query, validationResult } = require("express-validator");
const permitsCatalog = require("../data/permitsCatalog");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * In-memory cache for permit division metadata
 * Format: { permitId: { divisions: {}, cachedAt: timestamp } }
 */
const divisionCache = new Map();
const DIVISION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GET /api/permits/catalog
 * Returns the curated list of wilderness permits supported by Kamp Scout
 */
router.get("/catalog", (req, res) => {
  res.json(permitsCatalog);
});

/**
 * GET /api/permits/:permitId/divisions
 * Fetches division metadata for a specific permit from Recreation.gov
 * Caches results for 24 hours to avoid hammering the API
 */
router.get(
  "/:permitId/divisions",
  [param("permitId").notEmpty().trim()],
  validate,
  async (req, res) => {
    const { permitId } = req.params;

    try {
      // Check cache first
      const cached = divisionCache.get(permitId);
      if (cached && (Date.now() - cached.cachedAt) < DIVISION_CACHE_TTL_MS) {
        console.log(`Returning cached divisions for permit ${permitId}`);
        return res.json(cached.divisions);
      }

      // Fetch from Recreation.gov API
      const url = `https://www.recreation.gov/api/permitcontent/${permitId}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });

      const divisions = response.data?.payload?.divisions || {};
      
      // Transform to array format with id and name
      const divisionsArray = Object.entries(divisions).map(([id, data]) => ({
        id,
        name: data.name || id,
        description: data.description || ""
      }));

      // Cache the result
      divisionCache.set(permitId, {
        divisions: divisionsArray,
        cachedAt: Date.now()
      });

      console.log(`Fetched and cached ${divisionsArray.length} divisions for permit ${permitId}`);
      res.json(divisionsArray);
    } catch (error) {
      console.error(`Error fetching divisions for permit ${permitId}:`, error.message);
      if (error.response?.status === 404) {
        return res.status(404).json({ error: "Permit not found" });
      }
      res.status(500).json({ error: "Failed to fetch permit divisions" });
    }
  }
);

/**
 * POST /api/permits/watches
 * Creates a new permit watch
 */
router.post(
  "/watches",
  [
    body("name").notEmpty().trim(),
    body("email_address").isEmail().normalizeEmail(),
    body("permit_id").notEmpty().trim(),
    body("permit_name").notEmpty().trim(),
    body("division_ids").isArray({ min: 1 }).withMessage("At least one division is required"),
    body("start_date").isDate(),
    body("end_date")
      .isDate()
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.start_date)) {
          throw new Error("End date must be the same as or after start date");
        }
        return true;
      }),
    body("group_size").optional().isInt({ min: 1 })
  ],
  validate,
  async (req, res) => {
    try {
      const {
        name,
        email_address,
        permit_id,
        permit_name,
        division_ids,
        start_date,
        end_date,
        group_size,
        monitoring_active
      } = req.body;

      // Store division_ids as JSON string
      const divisionIdsJson = JSON.stringify(division_ids);

      const stmt = db.prepare(`
        INSERT INTO permit_watches (
          name, email_address, permit_id, permit_name, division_ids, 
          start_date, end_date, group_size, monitoring_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        name,
        email_address,
        permit_id,
        permit_name,
        divisionIdsJson,
        start_date,
        end_date,
        group_size || null,
        monitoring_active ? 1 : 1 // Default to active
      );

      // Send confirmation email
      const placeholders = {
        permit_name,
        permit_id,
        start_date,
        end_date,
        division_count: division_ids.length,
        base_url: process.env.EXTERNAL_BASE_URL || "http://localhost:3000",
        watch_id: result.lastInsertRowid,
        email_address: encodeURIComponent(email_address)
      };

      const subject = notificationsTemplate.formatTemplate(
        notificationsTemplate.permitConfirmation.subject,
        placeholders
      );
      const message = notificationsTemplate.formatTemplate(
        notificationsTemplate.permitConfirmation.body,
        placeholders
      );
      const htmlMessage = notificationsTemplate.formatTemplate(
        notificationsTemplate.permitConfirmation.html,
        placeholders
      );

      await sendEmailNotification(
        permit_id,
        subject,
        { text: message, html: htmlMessage },
        email_address
      );

      res.status(201).json({
        success: true,
        id: result.lastInsertRowid,
        message: `Monitoring enabled for ${permit_name}. Confirmation email sent to ${email_address}`
      });
    } catch (err) {
      console.error("Error creating permit watch:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/permits/watches
 * Lists all permit watches for a given email address
 */
router.get(
  "/watches",
  [query("email").isEmail().normalizeEmail()],
  validate,
  (req, res) => {
    try {
      const { email } = req.query;

      const watches = db
        .prepare(
          `SELECT id, name, email_address, permit_id, permit_name, division_ids, 
                  start_date, end_date, group_size, monitoring_active, 
                  attempts_made, success_sent, last_success_sent_at, 
                  created_at, updated_at
           FROM permit_watches 
           WHERE email_address = ? AND user_deleted = 0
           ORDER BY created_at DESC`
        )
        .all(email);

      // Parse division_ids JSON strings back to arrays
      const parsedWatches = watches.map(watch => ({
        ...watch,
        division_ids: JSON.parse(watch.division_ids),
        monitoring_active: Boolean(watch.monitoring_active),
        success_sent: Boolean(watch.success_sent),
        user_deleted: Boolean(watch.user_deleted)
      }));

      res.json(parsedWatches);
    } catch (err) {
      console.error("Error fetching permit watches:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/permits/watches/disable/:id/:email
 * Disables monitoring for a specific permit watch
 */
router.get(
  "/watches/disable/:id/:email",
  [
    param("id").isInt().withMessage("Invalid watch ID"),
    param("email").isEmail().withMessage("Invalid email address")
  ],
  validate,
  (req, res) => {
    console.log("Disabling monitoring for permit watch:", req.params.id);
    try {
      const { id, email } = req.params;

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          error: "Invalid watch ID provided"
        });
      }

      // Update database to stop monitoring only if ID and email match
      const result = db
        .prepare(
          "UPDATE permit_watches SET monitoring_active = 0 WHERE id = ? AND email_address = ?"
        )
        .run(id, decodeURIComponent(email));

      if (result.changes === 0) {
        return res.status(404).json({
          error: "Permit watch not found or email doesn't match"
        });
      }

      // Return a user-friendly HTML page using the template
      res.send(notificationsTemplate.htmlTemplates.monitoringDisabled);
    } catch (error) {
      console.error("Error disabling permit watch monitoring:", error);
      res.status(500).json({
        error: "Failed to disable monitoring",
        details: error.message
      });
    }
  }
);

module.exports = router;
