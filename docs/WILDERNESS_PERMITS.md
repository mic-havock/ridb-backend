# Wilderness Permit Monitoring - Implementation Guide

## Overview

This implementation adds wilderness permit cancellation/availability monitoring to Kamp Scout, extending the existing campsite reservation monitoring to support overnight wilderness permits from Recreation.gov.

## Supported Permits

| Park | Permit ID | API Type | Notes |
|------|-----------|----------|-------|
| Mount Rainier Wilderness & Climbing | 4675317 | itinerary | ~190 divisions (camps/zones) |
| North Cascades Backcountry | 4675322 | itinerary | Multiple backcountry camps |
| Olympic NP Wilderness | 4098362 | itinerary | Wilderness camps |
| Mount Margaret Backcountry | 250003 | standard | Standard availability API |
| Enchantments Advanced Lottery | 233273 | standard | Lottery product with remaining counts |
| Enchantments Daily Lottery | 445863 | lottery_daily | Not polled - geofenced/day-before only |

## API Endpoints

### GET /api/permits/catalog

Returns the curated list of wilderness permits supported by Kamp Scout.

**Response:**
```json
[
  {
    "id": "4675317",
    "name": "Mount Rainier Wilderness & Climbing",
    "park": "Mount Rainier National Park",
    "api_type": "itinerary",
    "rec_gov_url": "https://www.recreation.gov/permits/4675317",
    "detailed_availability_url": "https://www.recreation.gov/permits/4675317/registration/detailed-availability",
    "description": "Overnight wilderness permits for Mount Rainier backcountry camps and climbing routes"
  }
]
```

### GET /api/permits/:permitId/divisions

Fetches and caches division metadata (camps/zones) for a specific permit. Cache TTL: 24 hours.

**Parameters:**
- `permitId` (path) - Recreation.gov permit ID

**Response:**
```json
[
  {
    "id": "4675317001",
    "name": "Carbon River Camp",
    "description": ""
  }
]
```

### POST /api/permits/watches

Creates a new permit availability watch.

**Request Body:**
```json
{
  "name": "John Doe",
  "email_address": "john@example.com",
  "permit_id": "4675317",
  "permit_name": "Mount Rainier Wilderness & Climbing",
  "division_ids": ["4675317001", "4675317002"],
  "start_date": "2026-07-15",
  "end_date": "2026-07-17",
  "group_size": 2,
  "monitoring_active": true
}
```

**Response:**
```json
{
  "success": true,
  "id": 123,
  "message": "Monitoring enabled for Mount Rainier Wilderness & Climbing. Confirmation email sent to john@example.com"
}
```

**Behavior:**
- Sends confirmation email with unsubscribe link
- Monitors specified divisions for availability in the date range
- Sends alert email when any division becomes available

### GET /api/permits/watches?email=:email

Lists all permit watches for a given email address.

**Query Parameters:**
- `email` - Email address (required)

**Response:**
```json
[
  {
    "id": 123,
    "name": "John Doe",
    "email_address": "john@example.com",
    "permit_id": "4675317",
    "permit_name": "Mount Rainier Wilderness & Climbing",
    "division_ids": ["4675317001", "4675317002"],
    "start_date": "2026-07-15",
    "end_date": "2026-07-17",
    "group_size": 2,
    "monitoring_active": true,
    "attempts_made": 5,
    "success_sent": 0,
    "last_success_sent_at": null,
    "created_at": "2026-09-16T20:30:00.000Z",
    "updated_at": "2026-09-16T20:30:00.000Z"
  }
]
```

### GET /api/permits/watches/disable/:id/:email

Disables monitoring for a specific permit watch. Returns HTML page confirming the action.

**Parameters:**
- `id` (path) - Watch ID
- `email` (path) - Email address (must match watch)

## Database Schema

### Table: `permit_watches`

```sql
CREATE TABLE permit_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  permit_id TEXT NOT NULL,
  permit_name TEXT NOT NULL,
  division_ids TEXT NOT NULL,  -- JSON array of division IDs
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  group_size INTEGER,
  monitoring_active BOOLEAN NOT NULL DEFAULT 1,
  attempts_made INTEGER NOT NULL DEFAULT 0,
  success_sent INTEGER NOT NULL DEFAULT 0,
  last_success_sent_at DATETIME,
  user_deleted BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Recreation.gov API Integration

### Itinerary API (Rainier, NOCA, Olympic)

**Endpoint:** `GET https://www.recreation.gov/api/permititinerary/{permitId}/division/{divisionId}/availability/month?month=M&year=Y`

**Response:**
```json
{
  "bools": {
    "2026-07-15T00:00:00Z": true,
    "2026-07-16T00:00:00Z": false,
    "2026-07-17T00:00:00Z": true
  }
}
```

**Availability Check:** Any date with `true` value is available.

### Standard API (Mt Margaret, Enchantments)

**Endpoint:** `GET https://www.recreation.gov/api/permits/{id}/availability?start_date=ISO&end_date=ISO&commercial_acct=false&is_lottery=false`

**Response:**
```json
{
  "availability": {
    "250003001": {
      "remaining": 5,
      "date_availability": {
        "2026-07-15T00:00:00Z": { "remaining": 2 },
        "2026-07-16T00:00:00Z": { "remaining": 0 },
        "2026-07-17T00:00:00Z": { "remaining": 3 }
      }
    }
  }
}
```

**Availability Check:** Any date with `remaining > 0` is available.

### Enchantments Daily Lottery Handling

The Enchantments Daily Lottery (445863) is a geofenced, day-before lottery product. The implementation:

- Includes it in the catalog for visibility
- Marks it as `api_type: "lottery_daily"`
- Skips polling (no availability endpoint to check)
- Could be extended to send lottery window reminder emails (future enhancement)

## Monitoring Process

The permit monitor runs in parallel with campsite monitoring:

1. **Query Active Watches:** Fetches all `permit_watches` where `monitoring_active = 1` and respects rate-limit cooldown (`last_success_sent_at`)

2. **Process by API Type:**
   - **Itinerary:** Fetches monthly availability for each division and checks if any date in range is available
   - **Standard:** Fetches date range availability and checks `remaining > 0`
   - **Lottery Daily:** Skips (not pollable)

3. **Rate Limiting:**
   - 500ms delay between division checks within a single watch
   - `MONITOR_BATCH_DELAY_MS` (default 2000ms) between watches
   - Reuses existing `MONITOR_INTERVAL_MINUTES` for repeat alert cooldown

4. **Alert Emails:** Sends alert when availability found, with deep link to detailed availability page

5. **Expiration:** Auto-disables monitoring when `end_date` has passed

## Testing

### Manual API Testing

```bash
# 1. Start the server
npm start

# 2. Test the catalog endpoint
curl http://localhost:3000/api/permits/catalog | jq

# 3. Test divisions endpoint for Mount Rainier
curl http://localhost:3000/api/permits/4675317/divisions | jq

# 4. Create a test watch
curl -X POST http://localhost:3000/api/permits/watches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email_address": "test@example.com",
    "permit_id": "4675317",
    "permit_name": "Mount Rainier Wilderness & Climbing",
    "division_ids": ["4675317001"],
    "start_date": "2026-07-15",
    "end_date": "2026-07-17",
    "group_size": 2
  }'

# 5. List watches for email
curl "http://localhost:3000/api/permits/watches?email=test@example.com" | jq
```

### Automated Test Script

```bash
# Run the test suite (requires server running)
node test/testPermitsAPI.js

# With custom base URL and email
BASE_URL=http://localhost:3000 TEST_EMAIL=your@email.com node test/testPermitsAPI.js
```

### Verify Against Real Data

Test with Mount Rainier Carbon River Camp (division 4675317001 or similar):

```bash
# Check if divisions API works
curl "https://www.recreation.gov/api/permitcontent/4675317" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq '.payload.divisions | keys | .[0:3]'

# Check itinerary availability for a division
curl "https://www.recreation.gov/api/permititinerary/4675317/division/4675317001/availability/month?month=7&year=2026" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq
```

Test with Mt Margaret:

```bash
# Check standard availability
curl "https://www.recreation.gov/api/permits/250003/availability?start_date=2026-07-15T00:00:00.000Z&end_date=2026-07-20T00:00:00.000Z&commercial_acct=false&is_lottery=false" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json" | jq
```

## Email Templates

### Confirmation Email

Sent when a watch is created:

**Subject:** `Wilderness Permit Alert Confirmed for {permit_name} 🏔️`

**Body:** Includes permit details, dates, division count, and unsubscribe link

### Availability Alert Email

Sent when availability is found:

**Subject:** `{permit_name} is Available for Your Dates! 🏔️`

**Body:** Includes permit details, specific division/camp name, dates, and direct booking link to detailed-availability page

## Code Organization

```
src/
├── data/
│   └── permitsCatalog.js          # Curated list of 6 WA permits
├── notifications/
│   ├── emails.js                  # ZeptoMail integration (unchanged)
│   └── notificationsTemplate.js   # Added permit email templates
├── reservationMonitor/
│   ├── reservationMonitor.js      # Main monitor - now calls permit monitor
│   └── permitMonitor.js           # NEW: Permit-specific monitoring logic
├── routes/
│   ├── permits.js                 # NEW: Permit API endpoints
│   ├── reservations.js            # Campsite endpoints (unchanged)
│   └── ...
└── server.js                      # Mounts /api/permits routes

db/
├── initialize.js                  # Original campsite reservations table
└── initializePermits.js           # NEW: Creates permit_watches table

test/
└── testPermitsAPI.js              # NEW: API test suite
```

## Environment Variables

No new environment variables required. Reuses existing configuration:

- `MONITOR_INTERVAL_SECONDS` - How often to run monitoring cycle
- `MONITOR_INTERVAL_MINUTES` - Cooldown between repeat alerts
- `MONITOR_BATCH_DELAY_MS` - Delay between processing watches
- `EXTERNAL_BASE_URL` - Used in email links

## Deployment Checklist

1. Run `node db/initializePermits.js` to create the `permit_watches` table
2. Verify existing campsite monitoring still works
3. Test permit endpoints with curl/Postman
4. Configure email settings (already done for campsite alerts)
5. Monitor logs for permit availability checks

## Future Enhancements

1. **Enchantments Daily Lottery Reminders:** Send notification when lottery window opens
2. **Group Size Filtering:** Alert only if `remaining >= group_size`
3. **Frontend Dashboard:** Add UI for managing permit watches
4. **Webhook Integration:** Allow posting alerts to Slack/Discord
5. **Advanced Scheduling:** Different polling frequencies per permit type
6. **Historical Data:** Track availability patterns over time

## Known Limitations

1. **Olympic Permit:** Recreation.gov's `/api/permits/4098362/availability` endpoint returns "Olympic permit is disabled in PermitService". Only the itinerary endpoint works.

2. **Enchantments Daily Lottery:** Cannot be polled for availability (geofenced, day-before only). Watch creation allowed but monitoring is skipped.

3. **Rate Limiting:** Recreation.gov may return 429 errors under heavy load. Existing rate-limit handling applies.

4. **Division Name Lookup:** Requires extra API call to fetch human-readable names. Results are not cached in DB, refetched on each alert.

## Support

For questions or issues:
- Check logs for error messages
- Verify Recreation.gov API endpoints are responding
- Confirm database schema is created
- Test with known-good division IDs from Mount Rainier
