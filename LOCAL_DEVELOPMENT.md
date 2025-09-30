# VOTP Local Development Quick Start Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker Desktop
- Rust (install from https://rustup.rs/)
- Git

### Step 1: Start Database
```powershell
# Navigate to project root
cd C:\Users\sam.abtahi\votp

# Start simple PostgreSQL + Redis
docker-compose -f docker-compose.dev.yml up -d

# Check if containers are running
docker-compose -f docker-compose.dev.yml ps
```

Expected output:
```
NAME                  COMMAND                  SERVICE             STATUS              PORTS
votp-postgres-dev     "docker-entrypoint.s…"   postgres            running (healthy)   0.0.0.0:5432->5432/tcp
votp-redis-dev        "docker-entrypoint.s…"   redis               running (healthy)   0.0.0.0:6379->6379/tcp
```

### Step 2: Setup Backend Environment
```powershell
cd backend

# Copy the development environment file
Copy-Item .env.dev .env

# Install dependencies (first time only)
cargo build
```

### Step 3: Start Backend Server
```powershell
cd backend

# Run the server
cargo run
```

You should see:
```
[INFO] Starting VOTP GraphQL Server on 127.0.0.1:8000
[INFO] Database connection established
[INFO] GraphQL Playground available at http://localhost:8000/playground
```

### Step 4: Test the API
Open your browser and go to:
- **GraphQL Playground**: http://localhost:8000/playground
- **API Endpoint**: http://localhost:8000/api

### Step 5: Install Chrome Extension
1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The VOTP icon should appear in your toolbar

### Step 6: Test End-to-End
1. Visit any website (e.g., https://news.ycombinator.com)
2. Click the VOTP extension icon
3. Sign up with any email (you won't receive real emails in dev mode)
4. Start commenting!

---

## 🛠️ Development Commands

### Database Management
```powershell
# View logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Connect to database
docker exec -it votp-postgres-dev psql -U postgres -d votp_db

# Stop database
docker-compose -f docker-compose.dev.yml down

# Reset database (delete all data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Backend Development
```powershell
cd backend

# Run with auto-reload (install cargo-watch first)
cargo install cargo-watch
cargo watch -x run

# Run tests
cargo test

# Check code formatting
cargo fmt
cargo clippy
```

### Useful Database Queries
Connect to database: `docker exec -it votp-postgres-dev psql -U postgres -d votp_db`

```sql
-- View all users
SELECT id, name, email, email_verified, created_at FROM users;

-- View all comments
SELECT c.content, c.url, u.name as author, c.created_at 
FROM comments c 
JOIN users u ON c.user_id = u.id 
ORDER BY c.created_at DESC;

-- Test URL normalization
SELECT * FROM normalize_and_hash_url('https://Example.com/Path/?utm_source=test');

-- View comment statistics
SELECT * FROM comment_stats;
```

---

## 🧪 Testing Scenarios

### 1. Authentication Flow
- Sign up with email: `test@example.com`
- Use any 6-digit code (dev mode doesn't send real emails)
- Test login/logout

### 2. Comment Operations  
- Post a comment on any webpage
- Edit your comment
- Delete your comment
- View comments from other users

### 3. URL Normalization
Test that these URLs are treated as the same:
- `https://example.com/page`
- `https://example.com/page/`
- `https://example.com/page?utm_source=test`
- `https://Example.com/Page`

---

## 🐛 Troubleshooting

### Database Connection Issues
```powershell
# Check if PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps postgres

# Check database logs
docker-compose -f docker-compose.dev.yml logs postgres

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres
```

### Backend Issues
```powershell
# Check environment variables
Get-Content backend\.env

# Check if database schema exists
docker exec -it votp-postgres-dev psql -U postgres -d votp_db -c "\dt"
```

### Extension Issues
1. Check browser console for errors (F12)
2. Go to `chrome://extensions/` and check for errors
3. Try reloading the extension

---

## 📊 Database Schema

**Users Table:**
- `id` - UUID primary key
- `name` - User display name
- `email` - Unique email address
- `password_hash` - Argon2id hashed password
- `email_verified` - Boolean verification status

**Comments Table:**
- `id` - UUID primary key  
- `content` - Comment text
- `url` - Original URL
- `normalized_url` - Cleaned URL
- `url_hash` - SHA256 hash for grouping
- `user_id` - Foreign key to users

**Verification Codes Table:**
- `email` - Primary key
- `code` - 6-digit verification code
- `expires_at` - Expiration timestamp

---

## 🎯 Next Steps

Once local testing works:
1. Configure real SMTP for email verification
2. Deploy to production using Kubernetes manifests
3. Set up monitoring and logging
4. Add more advanced features (comment threading, reactions, etc.)

**Happy coding!** 🚀