#!/usr/bin/env node
/**
 * Test script for wilderness permit monitoring endpoints
 * 
 * Tests:
 * 1. GET /api/permits/catalog - Should return 6 wilderness permits
 * 2. GET /api/permits/:permitId/divisions - Should return divisions for Mount Rainier
 * 3. POST /api/permits/watches - Creates a test watch (requires valid email)
 * 4. GET /api/permits/watches?email=... - Lists watches for email
 * 
 * To run: node test/testPermitsAPI.js
 * Requires: Server running on http://localhost:3000
 */

const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

// ANSI color codes for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m"
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

async function testGetCatalog() {
  log.info("Testing GET /api/permits/catalog");
  
  try {
    const response = await axios.get(`${BASE_URL}/api/permits/catalog`);
    
    if (response.status === 200 && Array.isArray(response.data) && response.data.length === 6) {
      log.success("Catalog endpoint works - returned 6 permits");
      console.log("  Permits:", response.data.map(p => `${p.name} (${p.id})`).join(", "));
      return true;
    } else {
      log.error(`Catalog endpoint returned unexpected data: ${response.data.length} permits`);
      return false;
    }
  } catch (error) {
    log.error(`Catalog endpoint failed: ${error.message}`);
    return false;
  }
}

async function testGetDivisions() {
  log.info("Testing GET /api/permits/:permitId/divisions for Mount Rainier (4675317)");
  
  try {
    const response = await axios.get(`${BASE_URL}/api/permits/4675317/divisions`);
    
    if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
      log.success(`Divisions endpoint works - returned ${response.data.length} divisions`);
      console.log("  Sample divisions:", response.data.slice(0, 3).map(d => d.name).join(", "), "...");
      return { success: true, divisions: response.data };
    } else {
      log.error(`Divisions endpoint returned unexpected data`);
      return { success: false };
    }
  } catch (error) {
    log.error(`Divisions endpoint failed: ${error.message}`);
    if (error.response?.status === 404) {
      log.warn("This may be expected if Recreation.gov API is unavailable");
    }
    return { success: false };
  }
}

async function testCreateWatch(divisionId) {
  log.info("Testing POST /api/permits/watches");
  
  const watchData = {
    name: "Test User",
    email_address: TEST_EMAIL,
    permit_id: "4675317",
    permit_name: "Mount Rainier Wilderness & Climbing",
    division_ids: [divisionId || "4675317001"],
    start_date: "2026-07-15",
    end_date: "2026-07-17",
    group_size: 2,
    monitoring_active: true
  };
  
  try {
    const response = await axios.post(`${BASE_URL}/api/permits/watches`, watchData);
    
    if (response.status === 201 && response.data.success) {
      log.success(`Created permit watch with ID ${response.data.id}`);
      return { success: true, watchId: response.data.id };
    } else {
      log.error(`Watch creation returned unexpected response`);
      return { success: false };
    }
  } catch (error) {
    log.error(`Watch creation failed: ${error.message}`);
    if (error.response?.data) {
      console.log("  Error details:", error.response.data);
    }
    return { success: false };
  }
}

async function testListWatches() {
  log.info(`Testing GET /api/permits/watches?email=${TEST_EMAIL}`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/permits/watches`, {
      params: { email: TEST_EMAIL }
    });
    
    if (response.status === 200 && Array.isArray(response.data)) {
      log.success(`Listed ${response.data.length} watches for ${TEST_EMAIL}`);
      if (response.data.length > 0) {
        const watch = response.data[0];
        console.log(`  Latest watch: ${watch.permit_name} (${watch.start_date} to ${watch.end_date})`);
      }
      return true;
    } else {
      log.error(`List watches returned unexpected data`);
      return false;
    }
  } catch (error) {
    log.error(`List watches failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("Wilderness Permit API Test Suite");
  console.log("=".repeat(60) + "\n");
  
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Test email: ${TEST_EMAIL}\n`);
  
  let passCount = 0;
  let totalTests = 4;
  
  // Test 1: Catalog
  if (await testGetCatalog()) passCount++;
  console.log("");
  
  // Test 2: Divisions
  const divisionsResult = await testGetDivisions();
  if (divisionsResult.success) passCount++;
  console.log("");
  
  // Test 3: Create Watch
  const divisionId = divisionsResult.divisions?.[0]?.id;
  const createResult = await testCreateWatch(divisionId);
  if (createResult.success) passCount++;
  console.log("");
  
  // Test 4: List Watches
  if (await testListWatches()) passCount++;
  console.log("");
  
  // Summary
  console.log("=".repeat(60));
  console.log(`Tests passed: ${passCount}/${totalTests}`);
  console.log("=".repeat(60) + "\n");
  
  if (passCount === totalTests) {
    log.success("All tests passed!");
    process.exit(0);
  } else {
    log.error(`${totalTests - passCount} test(s) failed`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});
