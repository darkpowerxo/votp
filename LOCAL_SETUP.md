# 🚀 VOTP Local Development Setup

## Quick Start (3 commands)

```powershell
# 1. Start the database
.\dev.ps1

# 2. Start the backend (in a new terminal)
cd backend
cargo run

# 3. Load extension in Chrome
# chrome://extensions/ -> Load unpacked -> select 'extension' folder
```

## What This Gives You

### 🗄️ **Simple Database Setup**
- Single PostgreSQL container (no sharding complexity)
- Redis for caching
- Auto-created schema with sample data
- PgAdmin for database management (optional)

### 🦀 **Backend Ready to Run**
- Pre-configured environment file
- All dependencies handled by Cargo
- GraphQL playground at http://localhost:8000/playground

### 🌐 **Chrome Extension**
- Load unpacked from `extension/` folder
- Works on any website immediately
- Full authentication and commenting flow

## Files Created for Local Development

### `docker-compose.dev.yml`
Simplified Docker Compose with:
- PostgreSQL 15 (single instance)
- Redis 7 for caching
- PgAdmin for database management

### `database/init-simple.sql`
Database schema without sharding:
- Users table
- Comments table (single table)
- Verification codes table
- Sample data for testing

### `backend/.env.dev`
Development environment with:
- Database connection to local PostgreSQL
- Simplified JWT settings
- Debug logging enabled
- Optional SMTP (can be skipped for testing)

### `dev.ps1`
PowerShell automation script:
- `.\dev.ps1` - Start everything
- `.\dev.ps1 -Status` - Check what's running
- `.\dev.ps1 -Stop` - Stop containers
- `.\dev.ps1 -Reset` - Clean reset

### `LOCAL_DEVELOPMENT.md`
Detailed guide with:
- Step-by-step instructions
- Troubleshooting tips
- Database commands
- Testing scenarios

## Database Connection Details

```
Host: localhost
Port: 5432
Database: votp_db
Username: postgres
Password: password
```

## Sample Users (for testing)

```
Email: test@example.com
Email: demo@example.com
Password: any password (dev mode)
```

## Next Steps After Local Testing

1. Configure real SMTP for email verification
2. Test the Chrome extension on various websites
3. Use the full production setup with Kubernetes when ready
4. Add your own features and customizations

**Everything is ready for local development and testing!** 🎯