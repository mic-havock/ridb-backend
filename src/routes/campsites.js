const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const { query, param, validationResult } = require("express-validator");

// Load environment variables
dotenv.config();

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

// Get available campsite statuses from environment variable
const AVAILABLE_CAMPSITE_STATUSES = process.env.AVAILABLE_CAMPSITE_STATUSES
  ? process.env.AVAILABLE_CAMPSITE_STATUSES.split(",")
  : ["Available", "Open"]; // Default if not set

/** Status used for dates beyond the reservation window (checkout/end dates only). */
const CHECKOUT_ONLY_STATUS = "Checkout";

/**
 * Returns whole calendar days between today (UTC) and the given date string.
 * @param {string} dateStr - ISO date key from availability payload (e.g. "2026-07-29T00:00:00Z")
 * @returns {number}
 */
function getDaysFromToday(dateStr) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const date = new Date(dateStr.split("T")[0] + "T00:00:00Z");
  return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Extracts reservation window length in days from campsite_rules, if present.
 * @param {object|undefined} campsiteRules
 * @returns {number|null}
 */
function getReservationWindowDays(campsiteRules) {
  const reservationWindow = campsiteRules?.reservationWindow;
  if (
    !reservationWindow ||
    reservationWindow.units !== "Days" ||
    typeof reservationWindow.value !== "number"
  ) {
    return null;
  }
  return reservationWindow.value;
}

/**
 * Whether a date is far enough in the future to allow a new check-in.
 * Dates at or beyond the reservation window are checkout-only.
 * @param {string} dateStr
 * @param {number|null} windowDays
 * @returns {boolean}
 */
function isCheckInWithinReservationWindow(dateStr, windowDays) {
  if (windowDays === null) {
    return true;
  }
  return getDaysFromToday(dateStr) < windowDays;
}

/**
 * Marks dates outside the reservation window as checkout-only for one campsite.
 * @param {object} campsiteData - Campsite availability object with availabilities and campsite_rules
 * @returns {object}
 */
function applyReservationWindowToCampsite(campsiteData) {
  if (!campsiteData?.availabilities) {
    return campsiteData;
  }

  const windowDays = getReservationWindowDays(campsiteData.campsite_rules);
  if (windowDays === null) {
    return campsiteData;
  }

  for (const [dateStr, status] of Object.entries(campsiteData.availabilities)) {
    const isOpenStatus = AVAILABLE_CAMPSITE_STATUSES.includes(status);
    if (isOpenStatus && getDaysFromToday(dateStr) >= windowDays) {
      campsiteData.availabilities[dateStr] = CHECKOUT_ONLY_STATUS;
    }
  }

  return campsiteData;
}

/**
 * Marks dates outside the reservation window as checkout-only for all campsites.
 * @param {object} campgroundData - Campground month availability response
 * @returns {object}
 */
function applyReservationWindowToCampground(campgroundData) {
  if (!campgroundData?.campsites) {
    return campgroundData;
  }

  for (const campsiteId of Object.keys(campgroundData.campsites)) {
    applyReservationWindowToCampsite(campgroundData.campsites[campsiteId]);
  }

  return campgroundData;
}

/**
 * Marks dates outside the reservation window as checkout-only instead of open.
 * @param {object} availabilityPayload - Raw recreation.gov availability response
 * @returns {object}
 */
function applyReservationWindowRules(availabilityPayload) {
  const availability = availabilityPayload?.availability;
  if (!availability) {
    return availabilityPayload;
  }

  applyReservationWindowToCampsite(availability);
  return availabilityPayload;
}

/**
 * Determines whether a status is acceptable for a date within a reservation range.
 * @param {string|undefined} status
 * @param {"check-in"|"stay"|"checkout"} dateRole
 * @returns {boolean}
 */
function isStatusAcceptableForDateRole(status, dateRole) {
  if (!status) {
    return false;
  }

  if (dateRole === "check-in") {
    return AVAILABLE_CAMPSITE_STATUSES.includes(status);
  }

  return (
    AVAILABLE_CAMPSITE_STATUSES.includes(status) ||
    status === CHECKOUT_ONLY_STATUS
  );
}

/**
 * Checks whether a reservation date range is reservable using availability data.
 * @param {object} availabilities - Date-keyed availability statuses
 * @param {object|undefined} campsiteRules - Campsite rules including reservationWindow
 * @param {string} startDate - Reservation start date
 * @param {string} endDate - Reservation end date
 * @returns {boolean}
 */
function isDateRangeReservable(
  availabilities,
  campsiteRules,
  startDate,
  endDate
) {
  const windowDays = getReservationWindowDays(campsiteRules);
  const startDateObj = new Date(startDate);
  const endDateObj = endDate ? new Date(endDate) : startDateObj;
  const isSingleDateCheck = startDateObj.getTime() === endDateObj.getTime();
  const startDateStr =
    startDateObj.toISOString().split("T")[0] + "T00:00:00Z";
  const checkoutDateStr =
    endDateObj.toISOString().split("T")[0] + "T00:00:00Z";

  for (
    let date = new Date(startDateObj);
    date <= endDateObj;
    date.setDate(date.getDate() + 1)
  ) {
    const formattedDate = date.toISOString().split("T")[0] + "T00:00:00Z";
    const status = availabilities[formattedDate];

    if (isSingleDateCheck) {
      if (
        status !== "Available" ||
        !isCheckInWithinReservationWindow(formattedDate, windowDays)
      ) {
        return false;
      }
      continue;
    }

    const isCheckInDate = formattedDate === startDateStr;
    const isCheckoutDate = formattedDate === checkoutDateStr;
    let dateRole = "stay";
    if (isCheckInDate) {
      dateRole = "check-in";
    } else if (isCheckoutDate) {
      dateRole = "checkout";
    }

    if (
      dateRole === "check-in" &&
      !isCheckInWithinReservationWindow(formattedDate, windowDays)
    ) {
      return false;
    }

    if (!isStatusAcceptableForDateRole(status, dateRole)) {
      return false;
    }
  }

  return true;
}

// Checks campsite availability
async function checkCampsiteAvailability(campsiteId, startDate, endDate) {
  console.log("Checking availability for campsite:", campsiteId);
  try {
    const response = await fetchCampsiteAvailability(campsiteId);
    const availabilityData = response.availability.availabilities;
    const campsiteRules = response.availability.campsite_rules;
    console.log("Start Date:", new Date(startDate));
    console.log("End Date:", new Date(endDate || startDate));

    const isReservable = isDateRangeReservable(
      availabilityData,
      campsiteRules,
      startDate,
      endDate
    );

    console.log("Campsite is reservable:", isReservable);
    return {
      campsiteId,
      isReservable,
    };
  } catch (error) {
    console.error("Error checking campsite availability:", error);
    throw new Error("Failed to check availability. Please try again later.");
  }
}

/**
 * Fetch all campsites under a specific facility
 * Endpoint: GET /api/facilities/:facilityId/campsites
 */
router.get(
  "/facilities/:facilityId/campsites",
  [param("facilityId").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { facilityId } = req.params;

  try {
    const response = await axios.get(
      `${RIDB_BASE_URL}facilities/${facilityId}/campsites`,
      {
        headers: { apikey: RIDB_API_KEY },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching campsites:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching campsites" });
  }
});

/**
 * Fetch details for a specific campsite
 * Endpoint: GET /api/campsites/:id
 */
router.get(
  "/campsites/:id",
  [param("id").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { id } = req.params;

  try {
    const response = await axios.get(`${RIDB_BASE_URL}campsites/${id}`, {
      headers: { apikey: RIDB_API_KEY },
    });

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching campsite details:",
      error.response?.data || error.message
    );
    res.status(500).json({ message: "Error fetching campsite details" });
  }
});

/**
 * Internal function to fetch campground availability for a specific month
 * @param {string} campgroundId - The ID of the campground
 * @param {string} startDate - The start date for the month (ISO format)
 * @returns {Promise<Object>} - The availability data
 */
async function fetchCampgroundMonthAvailability(campgroundId, startDate) {
  const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(
    startDate
  )}`;

  try {
    const response = await axios.get(url);
    return applyReservationWindowToCampground(response.data);
  } catch (error) {
    console.error(
      "Error checking campsite availability:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Endpoint to check campground availability for a specific month
// Example URL: https://www.recreation.gov/api/camps/availability/campground/232459/month?start_date=2025-05-01T00:00:00.000Z
router.get(
  "/campsites/:campgroundId/availability",
  [
    param("campgroundId").notEmpty().trim().escape(),
    query("startDate").isISO8601().withMessage("start_date must be a valid date"),
  ],
  validate,
  async (req, res) => {
    const { campgroundId } = req.params;
    const { startDate } = req.query; // The start_date in the query string

    try {
      const data = await fetchCampgroundMonthAvailability(
        campgroundId,
        startDate
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Error checking campsite availability" });
    }
  }
);

/**
 * Function to fetch campsite availability for a specific campsite.
 * @param {string} campsiteId - The ID of the campsite to check availability.
 * @returns {Promise<object>} - The availability data for the campsite.
 * @throws {Error} - Throws an error if the API call fails.
 */
async function fetchCampsiteAvailability(campsiteId) {
  const url = `https://www.recreation.gov/api/camps/availability/campsite/${campsiteId}/all`;

  try {
    const response = await axios.get(url);
    return applyReservationWindowRules(response.data);
  } catch (error) {
    // Check if this is a rate limit error (429)
    if (error.response && error.response.status === 429) {
      // Get pause duration from environment variable or default to 120 seconds (2 minutes)
      const pauseDurationSeconds = parseInt(
        process.env.RATE_LIMIT_PAUSE_SECONDS || "120",
        10
      );
      console.log(
        `Rate limit (429) hit for campsite ${campsiteId}. Pausing for ${pauseDurationSeconds} seconds...`
      );

      // Pause execution for the specified duration
      await new Promise((resolve) =>
        setTimeout(resolve, pauseDurationSeconds * 1000)
      );

      // Try again after the pause
      console.log(`Retrying request for campsite ${campsiteId} after pause...`);
      return fetchCampsiteAvailability(campsiteId); // Recursive call to retry
    }

    console.error(
      "Error fetching campsite availability:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch campsite availability");
  }
}

// Endpoint to check availability for a specific campsite
router.get(
  "/campsites/availability/:campsiteId",
  [param("campsiteId").notEmpty().trim().escape()],
  validate,
  async (req, res) => {
    const { campsiteId } = req.params;

  try {
    const availabilityData = await fetchCampsiteAvailability(campsiteId);
    res.json(availabilityData);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error checking specific campsite availability" });
  }
});

module.exports = {
  router,
  checkCampsiteAvailability,
  fetchCampgroundMonthAvailability,
  applyReservationWindowRules,
  applyReservationWindowToCampground,
  getReservationWindowDays,
  isDateRangeReservable,
  CHECKOUT_ONLY_STATUS,
};
