const express = require("express");
const axios = require("axios");

const router = express.Router();

// RIDB API Base URL and Key
const RIDB_BASE_URL = process.env.RIDB_BASE_URL;
const RIDB_API_KEY = process.env.RIDB_API_KEY;

// Endpoint: Get Facility by ID
router.get("/facilities/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(`${RIDB_BASE_URL}facilities/${id}`, {
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

// Endpoint: Search Facilities
router.get("/facilities", async (req, res) => {
  const { query } = req.query;

  try {
    const response = await axios.get(`${RIDB_BASE_URL}facilities`, {
      headers: { apikey: RIDB_API_KEY },
      params: { query },
    });
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error searching facilities:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error searching facilities" });
  }
});

module.exports = router;
