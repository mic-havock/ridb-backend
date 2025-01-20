const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

const router = express.Router();

router.get("/search", async (req, res) => {
  const {
    limit,
    offset,
    state,
    latitude,
    longitude,
    radius,
    activity,
    lastupdated,
  } = req.query;

  const url = `https://ridb.recreation.gov/api/v1/facilities`;
  const params = {
    limit: limit || 50,
    offset: offset || 0,
    state: state || "",
    latitude: latitude || "",
    longitude: longitude || "",
    radius: radius || "",
    activity: activity || "",
    lastupdated: lastupdated || "",
  };

  try {
    const response = await axios.get(url, { params });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
dotenv.config();

const apiUrl = process.env.RIDB_API_URL;
const apiKey = process.env.RIDB_API_KEY;

router.get("/search", async (req, res) => {
  const {
    limit,
    offset,
    state,
    latitude,
    longitude,
    radius,
    activity,
    lastupdated,
  } = req.query;

  const url = apiUrl;
  const params = {
    limit: limit || 50,
    offset: offset || 0,
    state: state || "",
    latitude: latitude || "",
    longitude: longitude || "",
    radius: radius || "",
    activity: activity || "",
    lastupdated: lastupdated || "",
    apikey: apiKey,
  };

  try {
    const response = await axios.get(url, { params });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
