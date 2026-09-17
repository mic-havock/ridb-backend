# Testing Guide: Wilderness Permit Monitoring

## Prerequisites

Before running tests, ensure the database is initialized:

```bash
# Initialize both tables (creates reservations.db at repo root)
node db/initialize.js
node db/initializePermits.js

# Verify database location
ls -la reservations.db  # Should be at repo root
```

**Note:** The initialization scripts use absolute paths and will always create `reservations.db` at the repository root, regardless of your current working directory. The scripts log the absolute database path when run.

## Quick Verification Checklist

### 1. Database Setup ✓

```bash
# Both tables should exist
node -e "
const db = require('better-sqlite3')('./reservations.db');
const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=?').all('table');
console.log('Tables:', tables.map(t => t.name).join(', '));
db.close();
"
# Expected output: permit_watches, sqlite_sequence, reservations
```

### 2. Syntax Validation ✓

```bash
node -c src/server.js
node -c src/routes/permits.js
node -c src/reservationMonitor/permitMonitor.js
node -c src/reservationMonitor/reservationMonitor.js
```

### 3. Catalog Data ✓

```bash
node -e "
const catalog = require('./src/data/permitsCatalog.js');
console.log('Permits:', catalog.length);
catalog.forEach(p => console.log('  ', p.name, '(' + p.api_type + ')'));
"
# Expected: 6 permits
```

## Live API Testing

### Start the Server

```bash
# Set environment variables first
export EMAIL_FROM="your-verified-sender@domain.com"
export EMAIL_PASS="your-zeptomail-password"
export RIDB_API_KEY="your-ridb-key"

# Start server
npm start
```

The server will:
- Start on port 3000 (or PORT env var)
- Initialize campsite monitoring
- Initialize permit monitoring
- Run monitoring cycle every MONITOR_INTERVAL_SECONDS (default 60s)

### Test Endpoints

#### 1. Test Catalog (no external API call)

```bash
curl http://localhost:3000/api/permits/catalog | jq '.[0:3] | .[] | {id, name, api_type}'
```

Expected: Returns 6 Washington State permits

#### 2. Test Divisions (calls Recreation.gov)

```bash
# Mount Rainier - should return ~190 divisions
curl http://localhost:3000/api/permits/4675317/divisions | jq 'length'

# Check a sample division
curl http://localhost:3000/api/permits/4675317/divisions | jq '.[0] | {id, name}'
```

Expected: Returns division array with id and name fields

#### 3. Create a Test Watch

```bash
curl -X POST http://localhost:3000/api/permits/watches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email_address": "your-email@example.com",
    "permit_id": "4675317",
    "permit_name": "Mount Rainier Wilderness & Climbing",
    "division_ids": ["4675317001"],
    "start_date": "2026-07-15",
    "end_date": "2026-07-17",
    "group_size": 2
  }'
```

Expected:
- Returns `{success: true, id: N}`
- Sends confirmation email to your address
- Creates record in permit_watches table

#### 4. List Watches

```bash
curl "http://localhost:3000/api/permits/watches?email=your-email@example.com" | jq
```

Expected: Returns array with your test watch

#### 5. Verify Database Record

```bash
node -e "
const db = require('better-sqlite3')('./reservations.db');
const watches = db.prepare('SELECT * FROM permit_watches').all();
console.log('Total watches:', watches.length);
if (watches.length > 0) {
  const w = watches[0];
  console.log('Latest watch:', {
    id: w.id,
    permit_name: w.permit_name,
    division_ids: JSON.parse(w.division_ids),
    monitoring_active: !!w.monitoring_active
  });
}
db.close();
"
```

## Recreation.gov API Verification

### Test Itinerary API (Mount Rainier)

```bash
# Get a real division ID
curl "https://www.recreation.gov/api/permitcontent/4675317" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.payload.divisions | keys[0]'

# Save the division ID, then check availability
DIVISION_ID="4675317001"  # Use actual ID from above
curl "https://www.recreation.gov/api/permititinerary/4675317/division/$DIVISION_ID/availability/month?month=7&year=2026" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.bools | keys[0:3]'
```

Expected: Returns date keys with true/false values

### Test Standard API (Mount Margaret)

```bash
curl "https://www.recreation.gov/api/permits/250003/availability?start_date=2026-07-15T00:00:00.000Z&end_date=2026-07-20T00:00:00.000Z&commercial_acct=false&is_lottery=false" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.availability | keys[0]'
```

Expected: Returns availability object with division IDs

## Monitoring Cycle Testing

### Watch the Logs

```bash
npm start | grep -E "(Permit|ALERT|permit_watches)"
```

You should see:
- "No active permit watches to monitor" (if no watches exist)
- "Starting Permit Watch Monitoring Cycle" (every cycle)
- "Processing N permit watches" (when watches exist)
- Attempt counters incrementing

### Test with Real Data

To see a live alert:

1. Create a watch for a permit that has current availability
2. Use start_date/end_date that spans available dates
3. Wait for monitoring cycle (up to 60 seconds)
4. Check email for alert

Example: Mount Margaret often has availability in summer months.

### Test Expiration Handling

```bash
# Create a watch with past dates
curl -X POST http://localhost:3000/api/permits/watches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Expiration",
    "email_address": "test@example.com",
    "permit_id": "4675317",
    "permit_name": "Mount Rainier Wilderness & Climbing",
    "division_ids": ["4675317001"],
    "start_date": "2020-07-15",
    "end_date": "2020-07-17"
  }'

# Wait for next monitoring cycle
# Check logs for "Permit watch monitoring ended - End date ... has passed"
```

## Automated Test Suite

```bash
# Requires server running on localhost:3000
node test/testPermitsAPI.js

# With custom settings
BASE_URL=http://localhost:3000 \
TEST_EMAIL=your-test-email@example.com \
node test/testPermitsAPI.js
```

Expected output:
```
============================================================
Wilderness Permit API Test Suite
============================================================

Testing against: http://localhost:3000
Test email: your-test-email@example.com

✓ Catalog endpoint works - returned 6 permits
  Permits: Mount Rainier Wilderness & Climbing (4675317), ...

✓ Divisions endpoint works - returned 190 divisions
  Sample divisions: Carbon River Camp, Mowich Lake Camp, ...

✓ Created permit watch with ID 1

✓ Listed 1 watches for your-test-email@example.com
  Latest watch: Mount Rainier Wilderness & Climbing (2026-07-15 to 2026-07-17)

============================================================
Tests passed: 4/4
============================================================

✓ All tests passed!
```

## Troubleshooting

### Server won't start

```bash
# Check for syntax errors
node -c src/server.js

# Check for missing dependencies
pnpm install
npm rebuild better-sqlite3 --build-from-source
```

### Divisions endpoint returns 404

This is normal if Recreation.gov API is temporarily unavailable or the permit ID is invalid. The endpoint will cache successful responses for 24 hours.

### No monitoring activity in logs

Check:
1. Are there active watches? `SELECT * FROM permit_watches WHERE monitoring_active=1`
2. Is MONITOR_INTERVAL_SECONDS set correctly?
3. Are watches within the rate-limit cooldown period?

### Email not sending

Check:
1. EMAIL_FROM is set to a verified ZeptoMail sender
2. EMAIL_PASS is correct
3. Logs for "Failed to send email notification"

### Permit monitoring not finding availability

For itinerary permits:
- Check if Recreation.gov actually has availability for those dates
- Verify division IDs are correct
- Test the Recreation.gov API directly (see above)

For standard permits:
- Check if permit is lottery-only (no remaining inventory)
- Verify dates are within booking window

## Success Criteria

✅ Server starts without errors
✅ All 4 automated tests pass
✅ Can create a permit watch and receive confirmation email
✅ Monitoring logs show permit watch processing
✅ Database contains permit_watches and reservations tables
✅ Existing campsite monitoring still works
✅ Can fetch divisions for at least one permit

## Manual Verification Scenarios

### Scenario 1: Mount Rainier Carbon River Camp

```bash
# 1. Get division ID for Carbon River
curl "https://www.recreation.gov/api/permitcontent/4675317" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.payload.divisions | to_entries | .[] | select(.value.name | contains("Carbon")) | .key' | head -1

# 2. Create watch with that division ID
# 3. Monitor logs for availability checks
# 4. Verify email confirmation received
```

### Scenario 2: Mount Margaret Availability

```bash
# 1. Check current availability
curl "https://www.recreation.gov/api/permits/250003/availability?start_date=2026-07-15T00:00:00.000Z&end_date=2026-07-20T00:00:00.000Z&commercial_acct=false&is_lottery=false" \
  -H "User-Agent: Mozilla/5.0" | jq '.availability | keys'

# 2. Create watch for a division with availability
# 3. Should receive alert email within one monitoring cycle
```

## Clean Up Test Data

```bash
# Remove test watches
node -e "
const db = require('better-sqlite3')('./reservations.db');
const result = db.prepare('DELETE FROM permit_watches WHERE email_address LIKE ?').run('%test%');
console.log('Deleted', result.changes, 'test watches');
db.close();
"
```
