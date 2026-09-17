# Kamp Scout Backend

Backend service for monitoring Recreation.gov campsite reservations and wilderness permit availability. Sends email alerts when campsites or permits become available due to cancellations.

## Features

### Campsite Reservation Monitoring
- Monitor specific campsites for availability
- Check date ranges for reservations
- Batch processing for multiple sites
- Email notifications when sites become available

### Wilderness Permit Monitoring (NEW)
- Monitor wilderness permit cancellations/availability
- Support for 6 Washington State permits (Rainier, NOCA, Olympic, Mt Margaret, Enchantments)
- Handles both itinerary and standard Recreation.gov permit APIs
- Email alerts with direct booking links

## Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build native modules
npm rebuild better-sqlite3 --build-from-source

# Initialize databases (creates reservations.db at repo root)
node db/initialize.js        # Campsite reservations
node db/initializePermits.js # Wilderness permits
```

**Note:** Database initialization scripts use absolute paths and will always create `reservations.db` at the repository root, regardless of your current working directory.

### Configuration

Create a `.env` file based on `.env.example`:

```env
# API Config
PORT=3000
EXTERNAL_BASE_URL=https://api.kampscout.com

# RIDB Config
RIDB_BASE_URL=https://ridb.recreation.gov/api/v1/
RIDB_API_KEY=your_api_key_here

# Email Config (ZeptoMail SMTP)
EMAIL_HOST=smtp.zeptomail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=emailapikey
EMAIL_PASS=your_zeptomail_password
EMAIL_FROM=info@kampscout.com
EMAIL_NAME=Kamp Scout

# Monitor Settings
MONITOR_INTERVAL_SECONDS=60
MONITOR_BATCH_SIZE=10
MONITOR_BATCH_DELAY_MS=2000
RATE_LIMIT_PAUSE_SECONDS=120
MONITOR_INTERVAL_MINUTES=10
```

### Run

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## API Endpoints

### Campsite Reservations

#### POST /api/reservations
Create a new campsite reservation watch

```json
{
  "name": "John Doe",
  "email_address": "john@example.com",
  "campsite_id": "232459",
  "campsite_name": "Lake Twenty-Two",
  "facility_id": "10101",
  "campsite_number": "001",
  "reservation_start_date": "2026-07-15",
  "reservation_end_date": "2026-07-17"
}
```

#### POST /api/reservations/bulk
Create multiple campsite watches at once

#### GET /api/reservations/disable-monitoring/:id/:email
Disable monitoring for a specific reservation

### Wilderness Permits

#### GET /api/permits/catalog
Get list of supported wilderness permits

```json
[
  {
    "id": "4675317",
    "name": "Mount Rainier Wilderness & Climbing",
    "park": "Mount Rainier National Park",
    "api_type": "itinerary",
    "rec_gov_url": "https://www.recreation.gov/permits/4675317"
  }
]
```

#### GET /api/permits/:permitId/divisions
Get divisions (camps/zones) for a specific permit

#### POST /api/permits/watches
Create a wilderness permit watch

```json
{
  "name": "John Doe",
  "email_address": "john@example.com",
  "permit_id": "4675317",
  "permit_name": "Mount Rainier Wilderness & Climbing",
  "division_ids": ["4675317001", "4675317002"],
  "start_date": "2026-07-15",
  "end_date": "2026-07-17",
  "group_size": 2
}
```

#### GET /api/permits/watches?email=:email
List all permit watches for an email

#### GET /api/permits/watches/disable/:id/:email
Disable monitoring for a specific permit watch

### Other Endpoints

- GET /api/facilities/:facilityId/campsites - List campsites in a facility
- GET /api/campsites/:id - Get campsite details
- GET /api/campsites/:campgroundId/availability - Check campground availability

## Supported Wilderness Permits

| Park | Permit ID | API Type | Notes |
|------|-----------|----------|-------|
| Mount Rainier Wilderness & Climbing | 4675317 | itinerary | ~190 divisions |
| North Cascades Backcountry | 4675322 | itinerary | Multiple camps |
| Olympic NP Wilderness | 4098362 | itinerary | Wilderness camps |
| Mount Margaret Backcountry | 250003 | standard | Standard API |
| Enchantments Advanced Lottery | 233273 | standard | Lottery product |

## Database Schema

### reservations
Stores campsite reservation watches
- Monitors specific campsites for date ranges
- Tracks monitoring status and alert history

### permit_watches
Stores wilderness permit watches
- Monitors permit divisions (camps/zones) for date ranges
- Supports multiple divisions per watch
- Tracks availability check attempts and alerts

## Monitoring Process

The monitoring process runs on a configurable interval (default: 60 seconds) and:

1. **Campsite Monitoring:**
   - Fetches active reservation watches
   - Groups by facility to minimize API calls
   - Checks availability for each date range
   - Sends alerts when sites become available

2. **Permit Monitoring:**
   - Fetches active permit watches
   - Checks itinerary or standard APIs based on permit type
   - Polls each division for availability
   - Sends alerts with specific division names

Both monitoring types:
- Respect rate limits (429 handling)
- Use batch processing with delays
- Auto-disable expired watches
- Track alert history to avoid spam
- Send confirmation and alert emails

## Email Notifications

All emails use ZeptoMail SMTP and include:

### Campsite Alerts
- Confirmation on watch creation
- Availability alerts with booking links
- Unsubscribe links

### Permit Alerts
- Confirmation on watch creation with permit details
- Availability alerts with specific camp/zone names
- Deep links to Recreation.gov detailed availability
- Unsubscribe links

## Testing

### Automated Tests

```bash
# Test permit API endpoints
node test/testPermitsAPI.js

# With custom configuration
BASE_URL=http://localhost:3000 TEST_EMAIL=test@example.com node test/testPermitsAPI.js
```

### Manual Testing

```bash
# Test catalog
curl http://localhost:3000/api/permits/catalog | jq

# Test divisions for Mount Rainier
curl http://localhost:3000/api/permits/4675317/divisions | jq

# Create a test permit watch
curl -X POST http://localhost:3000/api/permits/watches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email_address": "test@example.com",
    "permit_id": "4675317",
    "permit_name": "Mount Rainier Wilderness & Climbing",
    "division_ids": ["4675317001"],
    "start_date": "2026-07-15",
    "end_date": "2026-07-17"
  }'
```

## Documentation

- **[Wilderness Permits Guide](docs/WILDERNESS_PERMITS.md)** - Comprehensive permit monitoring documentation
  - API integration details
  - Recreation.gov API formats
  - Testing procedures
  - Known limitations

## Tech Stack

- **Runtime:** Node.js 22+
- **Framework:** Express.js
- **Database:** SQLite (better-sqlite3)
- **Email:** ZeptoMail (nodemailer)
- **Validation:** express-validator
- **HTTP Client:** axios
- **Scheduling:** node-cron, node-schedule

## Development

### Project Structure

```
src/
├── data/
│   └── permitsCatalog.js       # Curated wilderness permits
├── notifications/
│   ├── emails.js               # Email sending logic
│   └── notificationsTemplate.js # Email templates
├── reservationMonitor/
│   ├── reservationMonitor.js   # Main monitoring process
│   └── permitMonitor.js        # Permit monitoring logic
├── routes/
│   ├── campsites.js           # Campsite endpoints
│   ├── facilities.js          # Facility endpoints
│   ├── location.js            # Location endpoints
│   ├── permits.js             # Permit endpoints
│   ├── reservations.js        # Reservation endpoints
│   └── user.js                # User endpoints
└── server.js                  # Express app setup

db/
├── initialize.js              # Campsite table setup
└── initializePermits.js       # Permit table setup

test/
└── testPermitsAPI.js          # Permit API tests
```

### Code Style

- CommonJS modules
- Express middleware patterns
- Express-validator for input validation
- Better-sqlite3 for synchronous DB operations
- Node-cron for scheduled tasks

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| EXTERNAL_BASE_URL | Public URL for email links | http://localhost:3000 |
| RIDB_API_KEY | Recreation.gov API key | Required |
| EMAIL_HOST | SMTP host | smtp.zeptomail.com |
| EMAIL_PORT | SMTP port | 465 |
| EMAIL_USER | SMTP username | emailapikey |
| EMAIL_PASS | ZeptoMail password | Required |
| EMAIL_FROM | From email address | Required |
| MONITOR_INTERVAL_SECONDS | Monitoring cycle interval | 60 |
| MONITOR_BATCH_SIZE | Batch size for processing | 10 |
| MONITOR_BATCH_DELAY_MS | Delay between batches | 2000 |
| MONITOR_INTERVAL_MINUTES | Alert cooldown period | 10 |

## Known Issues

1. **Olympic Permit API:** The standard `/api/permits/4098362/availability` endpoint is disabled by Recreation.gov. Only the itinerary endpoint works.

2. **Rate Limiting:** Recreation.gov may return 429 errors. The system automatically pauses and retries.

## Contributing

When adding new features:
1. Follow existing code patterns (CommonJS, express-validator, better-sqlite3)
2. Add appropriate validation
3. Update email templates if needed
4. Add tests for new endpoints
5. Document in relevant docs/ files

## License

ISC

## Support

For issues or questions about wilderness permit monitoring, see the [Wilderness Permits Guide](docs/WILDERNESS_PERMITS.md).
