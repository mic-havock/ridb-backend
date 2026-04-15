const express = require("express");
const axios = require("axios");
const { query, param, validationResult } = require("express-validator");

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
const SORT = "NAME";
const ACTIVITY = "CAMPING";
const LIMIT = 100;
const OFFSET = 0;

// Endpoint: Get Facility by ID
router.get(
  "/facilities/:id",
  [param("id").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { id } = req.params;

  try {
    const response = await axios.get(`${RIDB_BASE_URL}/facilities/${id}`, {
      headers: { apikey: RIDB_API_KEY },
    });
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching facility:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching facility data" });
  }
});

//Endpoint: Get Facility by Multiple Criteria
router.get(
  "/facilities",
  [
    query("limit").optional({ values: "falsy" }).isInt({ min: 1, max: 1000 }),
    query("offset").optional({ values: "falsy" }).isInt({ min: 0 }),
    query("latitude").optional({ values: "falsy" }).isFloat(),
    query("longitude").optional({ values: "falsy" }).isFloat(),
    query("radius").optional({ values: "falsy" }).isFloat(),
  ],
  validate,
  async (req, res) => {
    const {
    query,
    limit,
    offset,
    state,
    latitude,
    longitude,
    radius,
    activity,
    lastupdated,
    sort,
  } = req.query;

  const url = `${RIDB_BASE_URL}/facilities`;
  const params = {
    query: query || "",
    limit: limit || LIMIT,
    offset: offset || OFFSET,
    state: state || "",
    latitude: latitude || "",
    longitude: longitude || "",
    radius: radius || "",
    activity: activity || ACTIVITY,
    lastupdated: lastupdated || "",
    sort: sort || SORT,
  };

  try {
    const response = await axios.get(url, {
      params,
      headers: { apikey: RIDB_API_KEY },
    });
    res.json(response.data); // return the response data
  } catch (error) {
    console.error(
      "Error fetching facilities:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching facilities" });
  }
});

module.exports = router;
