const fs = require("fs");
const https = require("https");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const startReservationMonitor = require("./reservationMonitor/reservationMonitor"); // Import monitoring process

// Load environment variables
dotenv.config();

// Import routes
const facilitiesRouter = require("./routes/facilities");
const { router: campsitesRouter } = require("./routes/campsites");
const locationRouter = require("./routes/location");
const reservationsRouter = require("./db/reservations");

const app = express();
const PORT = process.env.PORT || 3000;
const options = {
  key: fs.readFileSync("./backend.key"),
  cert: fs.readFileSync("./backend.crt"),
};

// Middleware for JSON parsing
app.use(express.json());

// Enable CORS & allow all origins
app.use(cors());

// Use routes
app.use("/api", facilitiesRouter);
app.use("/api", campsitesRouter);
app.use("/api", locationRouter);
app.use("/api/reservations", reservationsRouter); // Mount reservations endpoints

https.createServer(options, app).listen(443, () => {
  console.log("Backend running on https://10.0.0.153");
});

// Default route to check if the server is running
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Start the reservation monitoring process
//startReservationMonitor();
