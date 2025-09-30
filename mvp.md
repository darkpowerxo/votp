# Chrome Extension Implementation Request - Community Comments Platform called voice of the people or VOTP

## Project Overview
Create a Chrome/Edge extension that enables users to leave and view comments on any webpage, creating a shared community experience. The system should consist of:
1. Chrome/Edge extension (frontend)
2. Rust backend server with GraphQL-style single endpoint
3. PostgreSQL database with sharding
4. Docker Compose + Kubernetes deployment

## Core Functionality

### URL Normalization
The system must recognize these URLs as identical:
- `article.com/article1`
- `article.com/article1/`
- `article.com/en/article1/`
- `en.article.com/article1`

Implement robust URL normalization that:
- Strips trailing slashes
- Handles subdomains (especially language codes)
- Normalizes path variations
- Creates a canonical URL hash for comment grouping

### Chrome Extension Requirements

#### UI/UX
- **Popup Position**: Right side of the page
- **Activation**: Click extension icon to open/close sidebar
- **Width**: 350-400px fixed width
- **Design**: Clean, modern interface with smooth animations

#### Authentication Flow

**Not Signed In:**
1. Show single email input field with "Next" button
2. On email submission:
   - If user exists → Show password field below with "Login" button
   - If new user → Show "Sign Up" button

**Sign Up Flow:**
1. Email input (already filled from previous step)
2. Click "Sign Up" → Send 6-digit code via email
3. Show three fields:
   - Email (pre-filled, disabled)
   - 6-digit verification code input
   - New password field
   - "Complete Sign Up" button

**Signed In:**
- Show user profile section at top
- Comment input area
- List of existing comments for current URL

### User Model
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  bio: string;
  created_at: timestamp;
  updated_at: timestamp;
}
```

## Technical Architecture

### Backend (Rust)

#### Framework & Libraries
```toml
[dependencies]
actix-web = "4"
async-graphql = "5"
async-graphql-actix-web = "5"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-rustls"] }
serde = { version = "1", features = ["derive"] }
jsonwebtoken = "9"
argon2 = "0.5"
lettre = "0.11"  # For SMTP email
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
```

#### Single Endpoint Architecture
Implement GraphQL-style API at single endpoint `/api`:
- All requests POST to `/api`
- Request body contains operation type and parameters
- Use async-graphql for schema definition

#### Email Service
```rust
// SMTP configuration with SSL
struct EmailConfig {
    smtp_host: String,  // Will be provided later
    smtp_port: u16,
    smtp_username: String,  // Will be provided later
    smtp_password: String,  // Will be provided later
    use_ssl: bool,  // true
}
```

### Database (PostgreSQL with Sharding)

#### Docker Compose Configuration
```yaml
version: '3.8'

services:
  postgres-master:
    image: bitnami/postgresql:15
    environment:
      - POSTGRESQL_REPLICATION_MODE=master
      - POSTGRESQL_USERNAME=replicator
      - POSTGRESQL_PASSWORD=repl_password
      - POSTGRESQL_DATABASE=comments_db
      - POSTGRESQL_POSTGRES_PASSWORD=adminpassword
    volumes:
      - postgres-master-data:/bitnami/postgresql
      - ./init-sharding.sql:/docker-entrypoint-initdb.d/init.sql

  postgres-shard-1:
    image: bitnami/postgresql:15
    environment:
      - POSTGRESQL_REPLICATION_MODE=slave
      - POSTGRESQL_MASTER_HOST=postgres-master
      - POSTGRESQL_USERNAME=replicator
      - POSTGRESQL_PASSWORD=repl_password

  postgres-shard-2:
    image: bitnami/postgresql:15
    environment:
      - POSTGRESQL_REPLICATION_MODE=slave
      - POSTGRESQL_MASTER_HOST=postgres-master
      - POSTGRESQL_USERNAME=replicator
      - POSTGRESQL_PASSWORD=repl_password
```

#### Kubernetes Deployment
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  init.sql: |
    -- Sharding setup using postgres_fdw
    CREATE EXTENSION IF NOT EXISTS postgres_fdw;
    -- Additional sharding configuration
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-sharded
spec:
  serviceName: postgres-service
  replicas: 3
  # ... rest of configuration
```

### Chrome Extension Structure

```
extension/
├── manifest.json
├── background.js
├── content.js
├── sidebar/
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── LICENSE
```

#### Manifest.json (v3)
```json
{
  "manifest_version": 3,
  "name": "Community Comments",
  "version": "1.0.0",
  "description": "Share comments on any webpage",
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "http://localhost:8000/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["sidebar.css"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## GraphQL Schema

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  phoneNumber: String
  bio: String
  createdAt: DateTime!
}

type Comment {
  id: ID!
  content: String!
  url: String!
  normalizedUrl: String!
  user: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type AuthPayload {
  token: String!
  user: User!
}

type Query {
  currentUser: User
  commentsForUrl(url: String!): [Comment!]!
  userProfile(userId: ID!): User
}

type Mutation {
  # Authentication
  checkEmail(email: String!): Boolean!
  login(email: String!, password: String!): AuthPayload!
  signUp(email: String!, password: String!, verificationCode: String!): AuthPayload!
  sendVerificationCode(email: String!): Boolean!
  
  # User Profile
  updateProfile(name: String, phoneNumber: String, bio: String): User!
  
  # Comments
  createComment(content: String!, url: String!): Comment!
  updateComment(id: ID!, content: String!): Comment!
  deleteComment(id: ID!): Boolean!
}
```

## Security Requirements

1. **Password Hashing**: Use Argon2id
2. **JWT Tokens**: 24-hour expiry, refresh token mechanism
3. **Rate Limiting**: Implement on authentication endpoints
4. **CORS**: Configure properly for extension origin
5. **Input Validation**: Sanitize all user inputs
6. **SQL Injection Prevention**: Use prepared statements via SQLx

## License

Use a proprietary commercial license. Create a LICENSE file:

```
PROPRIETARY SOFTWARE LICENSE

Copyright (c) 2024 [Your Company Name]

All rights reserved.

This software and associated documentation files (the "Software") are the
proprietary and confidential property of [Your Company Name].

RESTRICTIONS:
1. This Software may not be used, copied, modified, merged, published,
   distributed, sublicensed, or sold by any entity other than [Your Company Name]
   without explicit written permission.

2. Commercial use by third parties is strictly prohibited.

3. Redistribution in any form is prohibited.

4. Reverse engineering, decompilation, or disassembly of this Software is prohibited.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

## Implementation Steps

1. **Phase 1 - Backend Setup**
   - Initialize Rust project with Cargo
   - Set up PostgreSQL with Docker Compose
   - Implement sharding strategy
   - Create GraphQL schema and resolvers
   - Implement authentication system with email verification

2. **Phase 2 - Database**
   - Design sharded schema for comments
   - Implement URL normalization function
   - Set up database migrations
   - Configure Kubernetes deployment

3. **Phase 3 - Chrome Extension**
   - Create extension structure
   - Implement sidebar UI
   - Build authentication flow
   - Connect to backend API
   - Implement real-time comment updates

4. **Phase 4 - Integration**
   - Test URL normalization across variations
   - Implement WebSocket for real-time updates
   - Add error handling and retry logic
   - Performance optimization

## Additional Features to Implement

1. **Comment Threading**: Reply to comments
2. **Reactions**: Like/upvote comments
3. **Notifications**: Alert when someone replies
4. **Moderation**: Report inappropriate content
5. **Analytics**: Track popular pages
6. **Export**: Download comment history

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/comments_db
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@example.com
API_PORT=8000
ENABLE_SSL=true
```

## Testing Requirements

1. **Unit Tests**: Minimum 80% coverage
2. **Integration Tests**: Test all API endpoints
3. **E2E Tests**: Playwright for extension testing
4. **Load Testing**: Support 10,000 concurrent users
5. **Security Testing**: OWASP compliance

Please implement this system with production-ready code, including proper error handling, logging, and documentation. Focus on scalability and performance from the start.