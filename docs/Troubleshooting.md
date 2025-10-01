# VOTP Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Voice of the People (VOTP) platform.

## Quick Diagnostics

Use this checklist to quickly identify common issues:

```mermaid
flowchart TD
    A[Issue Reported] --> B{Extension Loading?}
    B -->|No| C[Check Extension Installation]
    B -->|Yes| D{API Server Running?}
    D -->|No| E[Start Backend Services]
    D -->|Yes| F{Database Connected?}
    F -->|No| G[Check Database Status]
    F -->|Yes| H{Authentication Working?}
    H -->|No| I[Check JWT Configuration]
    H -->|Yes| J{Comments Loading?}
    J -->|No| K[Check GraphQL Queries]
    J -->|Yes| L[Check Browser Console]
    
    C --> M[Installation Guide]
    E --> N[Development Setup]
    G --> O[Database Troubleshooting]
    I --> P[Auth Troubleshooting]
    K --> Q[API Troubleshooting]
    L --> R[Browser Issues]
```

## Chrome Extension Issues

### Extension Not Loading

**Symptoms:**
- Extension icon not visible in toolbar
- "Extension context invalidated" errors
- Extension not appearing in `chrome://extensions/`

**Diagnosis:**
```javascript
// Check in browser console
console.log('Extension context:', typeof chrome !== 'undefined' && chrome.runtime);
console.log('Extension ID:', chrome.runtime?.id);
```

**Solutions:**

1. **Reload Extension:**
   ```bash
   1. Go to chrome://extensions/
   2. Find VOTP extension
   3. Click reload button (🔄)
   4. Check for error messages
   ```

2. **Check Manifest Validity:**
   ```bash
   cd extension
   # Validate manifest.json
   cat manifest.json | jq '.'
   ```

3. **Verify File Permissions:**
   ```bash
   # Ensure files are readable
   ls -la extension/
   chmod 644 extension/*.js extension/*.json
   ```

4. **Check Chrome Version:**
   - Minimum Chrome version: 88+
   - Manifest V3 required
   - Check compatibility at `chrome://version/`

### Sidebar Not Appearing

**Symptoms:**
- Extension loads but sidebar doesn't show
- Sidebar appears but content is blank
- CSS styling issues

**Diagnosis:**
```javascript
// Check in content script console
console.log('Sidebar element:', document.getElementById('votp-sidebar'));
console.log('Content script loaded:', window.votpContentScriptLoaded);
```

**Solutions:**

1. **Check Content Script Injection:**
   ```javascript
   // Add to extension/content.js for debugging
   console.log('Content script loading on:', window.location.href);
   console.log('DOM ready state:', document.readyState);
   ```

2. **Verify Site Permissions:**
   ```json
   // In manifest.json, ensure permissions include current site
   {
     "content_scripts": [{
       "matches": ["<all_urls>"],
       "js": ["content.js"]
     }]
   }
   ```

3. **Check CSS Conflicts:**
   ```css
   /* Add to extension/sidebar/sidebar.css */
   #votp-sidebar {
     z-index: 2147483647 !important;
     position: fixed !important;
     top: 0 !important;
     right: 0 !important;
   }
   ```

### Context Invalidation Errors

**Symptoms:**
- "Extension context invalidated" messages
- Extension stops working after Chrome updates
- Intermittent functionality

**Diagnosis:**
```javascript
// Add to extension/content.js
function checkExtensionContext() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    console.error('Extension context check failed:', error);
    return false;
  }
}

setInterval(() => {
  if (!checkExtensionContext()) {
    console.warn('Extension context lost, attempting recovery...');
  }
}, 5000);
```

**Solutions:**

1. **Implement Context Recovery:**
   ```javascript
   // Enhanced context validation
   function isExtensionContextValid() {
     try {
       return !!(chrome?.runtime?.id);
     } catch {
       return false;
     }
   }

   function handleContextLoss() {
     console.warn('Extension context lost, reloading page...');
     window.location.reload();
   }

   // Check context before API calls
   if (!isExtensionContextValid()) {
     handleContextLoss();
     return;
   }
   ```

2. **Background Script Persistence:**
   ```javascript
   // In extension/background.js
   chrome.runtime.onStartup.addListener(() => {
     console.log('Extension starting up');
   });

   chrome.runtime.onSuspend.addListener(() => {
     console.log('Extension suspending');
   });
   ```

## API Server Issues

### Server Won't Start

**Symptoms:**
- `cargo run` fails
- Port already in use errors
- Database connection failures

**Diagnosis:**
```bash
# Check if port is available
netstat -tulpn | grep :8000  # Linux
netstat -an | findstr :8000  # Windows
lsof -i :8000  # macOS

# Check Rust installation
rustc --version
cargo --version

# Check database connectivity
docker ps | grep postgres
```

**Solutions:**

1. **Port Conflicts:**
   ```bash
   # Kill process using port 8000
   sudo kill -9 $(lsof -ti:8000)  # macOS/Linux
   
   # Or change port in .env
   echo "PORT=8001" >> .env
   ```

2. **Missing Dependencies:**
   ```bash
   # Install build tools
   # Ubuntu/Debian
   sudo apt-get install build-essential pkg-config libssl-dev

   # macOS
   xcode-select --install

   # Windows - Install Visual Studio Build Tools
   ```

3. **Database Connection Issues:**
   ```bash
   # Start database services
   docker-compose -f docker-compose.dev.yml up -d postgres redis

   # Check connection
   docker exec -it votp-postgres-dev psql -U votp_user -d votp_db -c "SELECT 1;"
   ```

### GraphQL Errors

**Symptoms:**
- GraphQL playground not accessible
- Schema loading errors
- Query resolution failures

**Diagnosis:**
```bash
# Test GraphQL endpoint
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { types { name } } }"}'

# Check server logs
cargo run 2>&1 | grep -E "(ERROR|WARN)"
```

**Solutions:**

1. **Schema Compilation Issues:**
   ```bash
   # Rebuild with clean cache
   cargo clean
   cargo build

   # Check for schema definition errors
   grep -r "type\|input\|enum" backend/src/graphql/
   ```

2. **Resolver Errors:**
   ```rust
   // Add error logging to resolvers
   use log::{error, info, warn};

   #[graphql_object]
   impl Query {
       async fn comments(&self, context: &Context<'_>, page_url: String) -> Result<Vec<Comment>, Error> {
           info!("Fetching comments for page: {}", page_url);
           // ... implementation
       }
   }
   ```

### Authentication Issues

**Symptoms:**
- JWT token validation failures
- "Authentication required" errors
- Token expiration issues

**Diagnosis:**
```javascript
// Check token in browser console
const token = localStorage.getItem('votp_token');
console.log('Token present:', !!token);
console.log('Token length:', token?.length);

// Decode JWT (client-side inspection only)
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token payload:', payload);
  console.log('Token expired:', payload.exp < Date.now() / 1000);
}
```

**Solutions:**

1. **Token Storage Issues:**
   ```javascript
   // Proper token management
   class TokenManager {
     static setToken(token) {
       localStorage.setItem('votp_token', token);
     }

     static getToken() {
       return localStorage.getItem('votp_token');
     }

     static clearToken() {
       localStorage.removeItem('votp_token');
     }

     static isTokenValid() {
       const token = this.getToken();
       if (!token) return false;

       try {
         const payload = JSON.parse(atob(token.split('.')[1]));
         return payload.exp > Date.now() / 1000;
       } catch {
         return false;
       }
     }
   }
   ```

2. **JWT Secret Configuration:**
   ```bash
   # Ensure JWT_SECRET is set
   echo "JWT_SECRET=your-super-secret-key-at-least-32-chars" >> .env

   # Restart server after changing
   cargo run
   ```

## Database Issues

### Connection Failures

**Symptoms:**
- "Connection refused" errors
- Database queries timing out
- Migration failures

**Diagnosis:**
```bash
# Check Docker containers
docker ps | grep postgres
docker logs votp-postgres-dev

# Test direct connection
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db -c "SELECT version();"

# Check network connectivity
docker network ls
docker network inspect votp_default
```

**Solutions:**

1. **Container Not Running:**
   ```bash
   # Start PostgreSQL container
   docker-compose -f docker-compose.dev.yml up -d postgres

   # Check startup logs
   docker logs -f votp-postgres-dev
   ```

2. **Connection String Issues:**
   ```bash
   # Verify environment variables
   cat .env | grep DATABASE_URL

   # Test connection string format
   # postgresql://username:password@host:port/database
   DATABASE_URL="postgresql://votp_user:votp_pass@localhost:5432/votp_db"
   ```

3. **Port Conflicts:**
   ```bash
   # Check if port 5432 is in use
   netstat -tulpn | grep :5432

   # Use different port if needed
   docker-compose -f docker-compose.dev.yml down
   # Edit docker-compose.dev.yml to change port mapping
   # "5433:5432" instead of "5432:5432"
   ```

### Migration Errors

**Symptoms:**
- `sqlx migrate run` fails
- Schema version conflicts
- Missing tables

**Diagnosis:**
```bash
# Check migration status
cd backend
sqlx migrate info

# Check migration files
ls -la migrations/

# Verify database schema
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db -c "\dt"
```

**Solutions:**

1. **Reset Database:**
   ```bash
   # WARNING: This deletes all data
   cd database
   ./manage-db.sh reset

   # Re-run migrations
   cd ../backend
   sqlx migrate run
   ```

2. **Manual Migration Fix:**
   ```bash
   # Connect to database
   docker exec -it votp-postgres-dev psql -U votp_user -d votp_db

   # Check migration table
   SELECT * FROM _sqlx_migrations;

   # Fix migration issues manually if needed
   ```

### Data Corruption

**Symptoms:**
- Inconsistent query results
- Foreign key constraint errors
- Data integrity issues

**Diagnosis:**
```sql
-- Connect to database and run diagnostics
-- Check for orphaned records
SELECT c.* FROM comments c 
LEFT JOIN comments p ON c.parent_id = p.id 
WHERE c.parent_id IS NOT NULL AND p.id IS NULL;

-- Check data consistency
SELECT COUNT(*) as total_comments FROM comments;
SELECT COUNT(DISTINCT page_url) as unique_pages FROM comments;
```

**Solutions:**

1. **Data Cleanup:**
   ```sql
   -- Remove orphaned comments
   DELETE FROM comments 
   WHERE parent_id IS NOT NULL 
   AND parent_id NOT IN (SELECT id FROM comments);

   -- Rebuild indexes
   REINDEX DATABASE votp_db;
   ```

2. **Backup and Restore:**
   ```bash
   # Create backup
   docker exec votp-postgres-dev pg_dump -U votp_user votp_db > backup.sql

   # Restore from backup
   docker exec -i votp-postgres-dev psql -U votp_user votp_db < backup.sql
   ```

## Browser Issues

### CORS Errors

**Symptoms:**
- "CORS policy" error messages
- API requests failing from extension
- Cross-origin restrictions

**Diagnosis:**
```javascript
// Check network tab in browser dev tools
// Look for CORS-related error messages
console.log('Origin:', window.location.origin);
console.log('Making request to:', 'http://localhost:8000/graphql');
```

**Solutions:**

1. **Development CORS Configuration:**
   ```rust
   // In backend/src/main.rs
   use actix_cors::Cors;

   let cors = Cors::default()
       .allowed_origin_fn(|origin, _req_head| {
           origin.as_bytes().starts_with(b"chrome-extension://")
       })
       .allowed_methods(vec!["GET", "POST", "OPTIONS"])
       .allowed_headers(vec!["Content-Type", "Authorization"])
       .max_age(3600);

   App::new()
       .wrap(cors)
       // ... other configuration
   ```

2. **Extension Permissions:**
   ```json
   // In extension/manifest.json
   {
     "permissions": [
       "activeTab",
       "storage"
     ],
     "host_permissions": [
       "http://localhost:8000/*",
       "https://api.votp.example.com/*"
     ]
   }
   ```

### Content Security Policy (CSP) Violations

**Symptoms:**
- "Refused to execute inline event handler" errors
- Scripts not loading
- Style injection blocked

**Diagnosis:**
```javascript
// Check for CSP violations in console
// Look for messages like "Refused to execute..."
console.log('CSP violations detected');
```

**Solutions:**

1. **Replace Inline Handlers:**
   ```javascript
   // Instead of inline onclick
   // <button onclick="deleteComment(id)">Delete</button>

   // Use event delegation
   document.addEventListener('click', (event) => {
     if (event.target.classList.contains('delete-comment')) {
       const commentId = event.target.dataset.commentId;
       deleteComment(commentId);
     }
   });
   ```

2. **Proper Event Listeners:**
   ```javascript
   // Good: Event listeners
   const deleteButtons = document.querySelectorAll('.delete-comment');
   deleteButtons.forEach(button => {
     button.addEventListener('click', (e) => {
       const commentId = e.target.dataset.commentId;
       deleteComment(commentId);
     });
   });
   ```

### LocalStorage Issues

**Symptoms:**
- User sessions not persisting
- Token storage failures
- Data loss between page loads

**Diagnosis:**
```javascript
// Check localStorage functionality
try {
  localStorage.setItem('test', 'value');
  const retrieved = localStorage.getItem('test');
  localStorage.removeItem('test');
  console.log('LocalStorage working:', retrieved === 'value');
} catch (error) {
  console.error('LocalStorage error:', error);
}

// Check storage quotas
navigator.storage.estimate().then(estimate => {
  console.log('Storage quota:', estimate);
});
```

**Solutions:**

1. **Storage Fallback:**
   ```javascript
   class StorageManager {
     static setItem(key, value) {
       try {
         localStorage.setItem(key, value);
       } catch (error) {
         console.warn('LocalStorage failed, using memory storage');
         this.memoryStorage = this.memoryStorage || {};
         this.memoryStorage[key] = value;
       }
     }

     static getItem(key) {
       try {
         return localStorage.getItem(key);
       } catch (error) {
         return this.memoryStorage?.[key] || null;
       }
     }
   }
   ```

2. **Clear Storage Issues:**
   ```javascript
   // Clear corrupted storage
   try {
     localStorage.clear();
     console.log('Storage cleared successfully');
   } catch (error) {
     console.error('Storage clear failed:', error);
   }
   ```

## Performance Issues

### Slow API Responses

**Symptoms:**
- GraphQL queries taking > 1 second
- High server CPU usage
- Database query timeouts

**Diagnosis:**
```bash
# Monitor server performance
htop  # Linux/macOS
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10  # Windows

# Check database performance
docker exec -it votp-postgres-dev psql -U votp_user -d votp_db -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

**Solutions:**

1. **Database Optimization:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_comments_page_url ON comments(page_url);
   CREATE INDEX idx_comments_parent_id ON comments(parent_id);
   CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

   -- Analyze query performance
   EXPLAIN ANALYZE SELECT * FROM comments WHERE page_url = 'https://example.com';
   ```

2. **Query Optimization:**
   ```rust
   // Use connection pooling
   use sqlx::postgres::PgPoolOptions;

   let pool = PgPoolOptions::new()
       .max_connections(20)
       .min_connections(5)
       .connect(&database_url)
       .await?;
   ```

3. **Caching Implementation:**
   ```rust
   // Add Redis caching
   use redis::AsyncCommands;

   async fn get_comments_cached(page_url: String) -> Result<Vec<Comment>, Error> {
       let cache_key = format!("comments:{}", page_url);
       
       // Try cache first
       if let Ok(cached) = redis_conn.get::<_, String>(&cache_key).await {
           if let Ok(comments) = serde_json::from_str(&cached) {
               return Ok(comments);
           }
       }
       
       // Fetch from database
       let comments = fetch_comments_from_db(page_url).await?;
       
       // Cache for 5 minutes
       let _ = redis_conn.setex(&cache_key, 300, 
           serde_json::to_string(&comments)?).await;
       
       Ok(comments)
   }
   ```

### Memory Leaks

**Symptoms:**
- Browser tab consuming excessive memory
- Extension becoming unresponsive
- System slowdown over time

**Diagnosis:**
```javascript
// Monitor memory usage
console.log('Memory usage:', performance.memory);

// Check for event listener leaks
console.log('Event listeners count:', 
  getEventListeners(document).length);

// Monitor DOM nodes
console.log('DOM nodes count:', 
  document.querySelectorAll('*').length);
```

**Solutions:**

1. **Proper Cleanup:**
   ```javascript
   class CommentManager {
     constructor() {
       this.eventListeners = new Map();
     }

     addEventListeners() {
       const handler = this.handleCommentClick.bind(this);
       document.addEventListener('click', handler);
       this.eventListeners.set('click', handler);
     }

     cleanup() {
       // Remove all event listeners
       this.eventListeners.forEach((handler, event) => {
         document.removeEventListener(event, handler);
       });
       this.eventListeners.clear();
     }
   }

   // Cleanup on page unload
   window.addEventListener('beforeunload', () => {
     commentManager.cleanup();
   });
   ```

2. **Efficient DOM Manipulation:**
   ```javascript
   // Use DocumentFragment for bulk operations
   function renderComments(comments) {
     const fragment = document.createDocumentFragment();
     
     comments.forEach(comment => {
       const element = createCommentElement(comment);
       fragment.appendChild(element);
     });
     
     document.getElementById('comments-container').appendChild(fragment);
   }
   ```

## Debugging Tools

### Browser Developer Tools

1. **Console Commands:**
   ```javascript
   // Debug extension state
   console.log('Extension state:', {
     contextValid: typeof chrome !== 'undefined',
     runtime: !!chrome?.runtime,
     token: !!localStorage.getItem('votp_token')
   });

   // Monitor API calls
   const originalFetch = window.fetch;
   window.fetch = function(...args) {
     console.log('Fetch request:', args[0]);
     return originalFetch.apply(this, args).then(response => {
       console.log('Fetch response:', response.status, response.statusText);
       return response;
     });
   };
   ```

2. **Network Monitoring:**
   - Open DevTools → Network tab
   - Filter by "XHR" to see API calls
   - Check response times and error codes
   - Inspect request/response headers

### Server-Side Debugging

1. **Logging Configuration:**
   ```bash
   # Enable debug logging
   export RUST_LOG=debug
   cargo run

   # Or in .env file
   echo "RUST_LOG=debug" >> .env
   ```

2. **Database Query Logging:**
   ```sql
   -- Enable query logging in PostgreSQL
   ALTER SYSTEM SET log_statement = 'all';
   SELECT pg_reload_conf();

   -- View logs
   docker logs votp-postgres-dev | grep "LOG:"
   ```

### Automated Testing

1. **API Testing Script:**
   ```bash
   #!/bin/bash
   # test-api.sh

   API_URL="http://localhost:8000/graphql"

   # Test server health
   echo "Testing server health..."
   curl -f $API_URL || exit 1

   # Test GraphQL schema
   echo "Testing GraphQL schema..."
   curl -X POST $API_URL \
     -H "Content-Type: application/json" \
     -d '{"query": "query { __schema { types { name } } }"}' \
     | jq '.data.__schema.types | length'

   echo "API tests completed successfully"
   ```

2. **Extension Testing:**
   ```javascript
   // extension-test.js
   function runExtensionTests() {
     const tests = [
       {
         name: 'Extension context validation',
         test: () => typeof chrome !== 'undefined' && chrome.runtime
       },
       {
         name: 'Sidebar injection',
         test: () => document.getElementById('votp-sidebar') !== null
       },
       {
         name: 'Token storage',
         test: () => {
           localStorage.setItem('test-token', 'test');
           const retrieved = localStorage.getItem('test-token');
           localStorage.removeItem('test-token');
           return retrieved === 'test';
         }
       }
     ];

     tests.forEach(({ name, test }) => {
       try {
         const result = test();
         console.log(`✅ ${name}: ${result ? 'PASS' : 'FAIL'}`);
       } catch (error) {
         console.log(`❌ ${name}: ERROR - ${error.message}`);
       }
     });
   }

   // Run tests
   runExtensionTests();
   ```

## Support Resources

### Log Collection

When reporting issues, please include:

1. **Browser Information:**
   ```javascript
   console.log('Browser info:', {
     userAgent: navigator.userAgent,
     platform: navigator.platform,
     language: navigator.language,
     cookieEnabled: navigator.cookieEnabled
   });
   ```

2. **Extension Information:**
   ```javascript
   console.log('Extension info:', {
     id: chrome?.runtime?.id,
     version: chrome?.runtime?.getManifest?.()?.version,
     contextValid: typeof chrome !== 'undefined'
   });
   ```

3. **API Server Logs:**
   ```bash
   # Collect recent logs
   cargo run 2>&1 | tail -100 > votp-server.log
   
   # Database logs
   docker logs votp-postgres-dev --tail 50 > votp-db.log
   ```

### Community Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive guides and API reference
- **Development Setup**: Step-by-step installation guide
- **Architecture Overview**: System design and component interaction

### Emergency Recovery

If the system is completely broken:

```bash
# Nuclear option - complete reset
docker-compose -f docker-compose.dev.yml down -v
docker system prune -f
rm -rf backend/target/
cargo clean

# Restart from scratch
./setup.sh  # Linux/macOS
./setup.ps1  # Windows
```

---

*This troubleshooting guide covers the most common issues. If you encounter a problem not listed here, please check the GitHub issues or create a new issue with detailed information.*