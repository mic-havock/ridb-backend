const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const scheduleCronJob = require("./cron/cron-job");

// Load environment variables
dotenv.config();

// Import routes
const facilitiesRoutes = require("./routes/facilities");
const campsiteRoutes = require("./routes/campsites");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());

// Start the cron job
//scheduleCronJob();

// Enable CORS & allow all origins
app.use(cors());

// Use routes
app.use("/api", facilitiesRoutes);
app.use("/api", campsiteRoutes);

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
