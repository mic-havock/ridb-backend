const express = require("express");
const axios = require("axios");
const { param, validationResult } = require("express-validator");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// RIDB API Base URL and Key
const RIDB_BASE_URL = process.env.RIDB_BASE_URL;
const RIDB_API_KEY = process.env.RIDB_API_KEY;

// Endpoint: Get Facility Address by Facility ID
router.get(
  "/facilities/:facilityId/addresses",
  [param("facilityId").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { facilityId } = req.params;

  try {
    const response = await axios.get(
      `${RIDB_BASE_URL}/facilities/${facilityId}/facilityaddresses`,
      {
        headers: {
          apikey: RIDB_API_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching facility address:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching facility address" });
  }
});

module.exports = router;
