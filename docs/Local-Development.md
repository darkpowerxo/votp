# VOTP Local Development Guide

This guide helps you set up the Voice of the People (VOTP) platform for local development. Follow these steps to get your development environment running quickly.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/votp.git
cd votp

# Run the setup script
./setup.sh  # Linux/macOS
# OR
./setup.ps1  # Windows PowerShell

# Start development environment
./dev.ps1  # Windows
# OR
docker-compose -f docker-compose.dev.yml up -d
```

## Development Environment Overview

```mermaid
flowchart TB
    subgraph "Local Development"
        A[Chrome Extension] --> B[Content Script]
        B --> C[Sidebar Interface]
        C --> D[VOTP API Server]
        D --> E[PostgreSQL Database]
        D --> F[Redis Cache]
        D --> G[Email Service]
    end
    
    subgraph "Development Tools"
        H[Hot Reload] --> D
        I[Database Admin] --> E
        J[Redis CLI] --> F
        K[Chrome DevTools] --> A
    end
    
    subgraph "Testing"
        L[Unit Tests] --> D
        M[Integration Tests] --> D
        N[Extension Tests] --> A
    end
```

## Prerequisites

### Required Software
- **Rust** (1.70+) - [Install from rustup.rs](https://rustup.rs/)
- **Node.js** (18+) - [Download from nodejs.org](https://nodejs.org/)
- **Docker** & **Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **PostgreSQL Client** (optional) - For database management

### Development Tools (Recommended)
- **VS Code** with Rust Analyzer extension
- **Chrome Browser** for extension testing
- **Postman** or **Insomnia** for API testing
- **Git** for version control

### System Requirements
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux

## Installation Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/votp.git
cd votp

# Make scripts executable (Linux/macOS)
chmod +x setup.sh dev.sh
chmod +x database/manage-db.sh
```

### 2. Environment Configuration

Create your local environment file:

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env  # or your preferred editor
```

Required environment variables:
```env
# Database Configuration
DATABASE_URL=postgresql://votp_user:votp_pass@localhost:5432/votp_db
POSTGRES_USER=votp_user
POSTGRES_PASSWORD=votp_pass
POSTGRES_DB=votp_db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Configuration
HOST=127.0.0.1
PORT=8000
RUST_LOG=debug

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration (optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@votp.example.com
```

### 3. Database Setup

Start the database services:

```bash
# Start PostgreSQL and Redis with Docker
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Wait for services to be ready
sleep 10

# Initialize the database
cd database
./manage-db.sh init  # Linux/macOS
# OR
./manage-db.ps1 init  # Windows
```

Verify database connection:
```bash
# Connect to PostgreSQL
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db

# Check tables
\dt

# Exit
\q
```

### 4. Backend Development

Install Rust dependencies and start the server:

```bash
cd backend

# Install dependencies
cargo build

# Run database migrations
cargo install sqlx-cli
sqlx migrate run

# Start development server with hot reload
cargo watch -x run

# OR run normally
cargo run
```

The API server will start at `http://localhost:8000`

#### GraphQL Playground
Access the GraphQL playground at: `http://localhost:8000/playground`

Example queries to test:
```graphql
# Test connection
query {
  __schema {
    types {
      name
    }
  }
}

# Get all comments for a page
query GetComments {
  comments(page_url: "https://example.com") {
    id
    content
    author_email
    created_at
    parent_id
  }
}
```

### 5. Chrome Extension Development

Load the extension in Chrome:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from your project
5. The extension icon should appear in the toolbar

#### Extension Development Workflow

```bash
# Watch for extension file changes
cd extension

# Install development dependencies (if needed)
npm install  # Only if package.json exists

# After making changes, reload the extension:
# Go to chrome://extensions/ and click the reload icon
```

#### Testing the Extension

1. Navigate to any webpage (e.g., `https://example.com`)
2. Click the VOTP extension icon
3. The sidebar should appear on the right side
4. Try posting a comment to test functionality

#### Extension Debug Tools

```javascript
// Add to extension/debug-votp.js for debugging
console.log('Extension Debug Mode');

// Check extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Extension context is valid');
    console.log('Extension ID:', chrome.runtime.id);
} else {
    console.log('Extension context is invalid');
}

// Debug API calls
window.addEventListener('message', (event) => {
    if (event.data.type === 'VOTP_DEBUG') {
        console.log('VOTP Message:', event.data);
    }
});
```

## Development Workflow

### Daily Development Process

1. **Start Services**:
   ```bash
   # Start databases
   docker-compose -f docker-compose.dev.yml up -d
   
   # Start API server
   cd backend && cargo run
   ```

2. **Make Changes**:
   - Edit Rust code in `backend/src/`
   - Modify extension files in `extension/`
   - Update database schema in `backend/migrations/`

3. **Test Changes**:
   - Test API endpoints in GraphQL playground
   - Reload Chrome extension
   - Verify functionality on test websites

4. **Stop Services**:
   ```bash
   # Stop all services
   docker-compose -f docker-compose.dev.yml down
   ```

### Code Structure

```
votp/
├── backend/                 # Rust API server
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   ├── config.rs       # Configuration management
│   │   ├── database.rs     # Database connection
│   │   ├── models.rs       # Data models
│   │   ├── utils.rs        # Utility functions
│   │   ├── graphql/        # GraphQL schema and resolvers
│   │   └── services/       # Business logic services
│   ├── migrations/         # Database migration files
│   └── Cargo.toml         # Rust dependencies
├── extension/              # Chrome extension
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Service worker
│   ├── content.js         # Content script
│   ├── sidebar/           # Sidebar UI components
│   └── icons/             # Extension icons
├── database/              # Database management scripts
└── docs/                  # Documentation
```

## Testing

### Backend Testing

```bash
cd backend

# Run unit tests
cargo test

# Run specific test
cargo test test_create_comment

# Run tests with output
cargo test -- --nocapture

# Run integration tests
cargo test --test '*'
```

### Extension Testing

```bash
# Manual testing checklist
# 1. Load extension in Chrome
# 2. Visit different websites
# 3. Test comment posting
# 4. Test user authentication
# 5. Test error handling
# 6. Check browser console for errors

# Automated testing (if implemented)
npm test  # If test framework is set up
```

### API Testing with cURL

```bash
# Test GraphQL endpoint
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { comments(page_url: \"https://example.com\") { id content } }"
  }'

# Test with authentication
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation { createComment(input: { content: \"Test comment\", page_url: \"https://example.com\" }) { id } }"
  }'
```

## Database Management

### Common Database Operations

```bash
cd database

# Initialize database
./manage-db.sh init

# Reset database (WARNING: Deletes all data)
./manage-db.sh reset

# Create backup
./manage-db.sh backup

# View database logs
docker logs votp-postgres-dev

# Access PostgreSQL shell
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db
```

### Database Migrations

```bash
cd backend

# Create new migration
sqlx migrate add create_new_table

# Run pending migrations
sqlx migrate run

# Revert last migration
sqlx migrate revert

# Check migration status
sqlx migrate info
```

### Sample Database Queries

```sql
-- View all tables
\dt

-- View comments table structure
\d comments

-- View recent comments
SELECT id, content, author_email, created_at 
FROM comments 
ORDER BY created_at DESC 
LIMIT 10;

-- View comments by page
SELECT * FROM comments 
WHERE page_url = 'https://example.com';

-- Clean up test data
DELETE FROM comments 
WHERE author_email LIKE '%test%';
```

## Configuration

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | No |
| `HOST` | API server host | `127.0.0.1` | No |
| `PORT` | API server port | `8000` | No |
| `RUST_LOG` | Log level | `info` | No |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `SMTP_HOST` | Email server host | - | No |
| `SMTP_PORT` | Email server port | `587` | No |
| `SMTP_USERNAME` | Email username | - | No |
| `SMTP_PASSWORD` | Email password | - | No |

### Development Configuration Files

- **`.env`** - Local environment variables
- **`docker-compose.dev.yml`** - Development services
- **`backend/Cargo.toml`** - Rust dependencies
- **`extension/manifest.json`** - Extension configuration

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
Error: Connection refused (os error 61)
```
**Solution**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d postgres

# Check logs
docker logs votp-postgres-dev
```

#### 2. Extension Context Invalidated
```javascript
Error: Extension context invalidated
```
**Solution**:
- Reload the extension in `chrome://extensions/`
- Check for JavaScript errors in browser console
- Verify manifest.json is valid

#### 3. Port Already in Use
```bash
Error: Address already in use (os error 48)
```
**Solution**:
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### 4. Cargo Build Fails
```bash
Error: linker `cc` not found
```
**Solution**:
```bash
# Install build tools
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS
xcode-select --install

# Windows
# Install Visual Studio Build Tools
```

#### 5. GraphQL Schema Errors
```bash
Error: Cannot query field "comments" on type "Query"
```
**Solution**:
- Check GraphQL schema definition
- Verify resolvers are properly implemented
- Restart the API server

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
export RUST_LOG=debug

# Or in .env file
RUST_LOG=debug

# Restart the server
cargo run
```

### Performance Issues

Monitor performance:
```bash
# Check database performance
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Check API server memory usage
ps aux | grep votp

# Monitor Docker container resources
docker stats votp-postgres-dev votp-redis-dev
```

## Contributing

### Development Guidelines

1. **Code Style**:
   - Use `cargo fmt` for Rust code formatting
   - Use `rustfmt.toml` configuration
   - Follow JavaScript Standard Style for extension code

2. **Commit Messages**:
   ```
   type(scope): description
   
   Examples:
   feat(api): add user authentication
   fix(extension): resolve context invalidation
   docs(readme): update installation steps
   ```

3. **Testing Requirements**:
   - Add unit tests for new functions
   - Test extension changes manually
   - Verify GraphQL schema changes

4. **Pull Request Process**:
   - Fork the repository
   - Create feature branch
   - Make changes with tests
   - Submit pull request

### Development Environment Cleanup

```bash
# Clean up Docker containers
docker-compose -f docker-compose.dev.yml down -v

# Clean up Rust build cache
cargo clean

# Clean up database volumes
docker volume prune

# Reset extension state
# Go to chrome://extensions/ and remove/reload extension
```

---

*This development guide covers all aspects of local VOTP development. For production deployment, see the [Deployment Guide](Deployment.md).*