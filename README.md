# 🗣️ VOTP - Voice of the People

> **Community Comments Platform** - Share your voice and engage with community comments on any webpage across the internet.

A comprehensive Chrome/Edge extension that enables users to leave and view comments on any webpage, creating a shared community experience with robust backend infrastructure and modern security practices.

## 🌟 Features

### 🌍 Universal Commenting
- **Comment on Any Website**: Works on every webpage across the internet
- **Smart URL Normalization**: Recognizes identical pages with different URL formats
- **Real-time Updates**: See new comments instantly as they're posted
- **Threaded Discussions**: Reply to comments for deeper conversations

### 🔐 Secure Authentication
- **Email-based Signup**: Verify accounts with 6-digit email codes
- **JWT Authentication**: Secure token-based authentication with 24-hour expiry
- **Password Security**: Argon2id hashing with secure salt generation
- **Profile Management**: Customizable user profiles with bio and contact info

### 🎨 Modern User Experience
- **Sidebar Interface**: Clean, unobtrusive 380px sidebar
- **Responsive Design**: Works perfectly on all screen sizes
- **Smooth Animations**: Polished UI with CSS transitions
- **Dark/Light Support**: Adapts to user preferences

### ⚡ Performance & Scalability
- **Sharded Database**: PostgreSQL with intelligent URL-based sharding
- **GraphQL API**: Single endpoint with efficient data fetching
- **Auto-scaling**: Kubernetes HPA for dynamic load handling
- **Caching Layer**: Redis for sessions and temporary data

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome/Edge    │    │  Rust Backend   │    │  PostgreSQL     │
│  Extension      │◄──►│  GraphQL API    │◄──►│  Sharded DB     │
│  (Frontend)     │    │  (Actix-web)    │    │  (Master+Slaves)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │     Redis       │              │
         └──────────────►│  (Caching)     │◄─────────────┘
                        └─────────────────┘
```

### Tech Stack
- **Frontend**: Chrome Extension (Manifest v3, Vanilla JS, CSS3)
- **Backend**: Rust (Actix-web, async-GraphQL, SQLx)
- **Database**: PostgreSQL 15 with FDW sharding
- **Caching**: Redis 7
- **Email**: SMTP with SSL (Gmail/custom)
- **Deployment**: Docker Compose + Kubernetes
- **Security**: JWT, Argon2id, CORS, Rate limiting

## 🚀 Quick Start

### Prerequisites
- **Rust 1.75+** - Install from [rustup.rs](https://rustup.rs/)
- **Docker & Docker Compose** - For database setup
- **Chrome/Edge Browser** - For extension testing
- **Git** - For cloning the repository

### 1. Clone and Setup
```bash
git clone <repository-url>
cd votp
```

### 2. Database Setup (Docker)
```bash
cd database

# Start PostgreSQL cluster with sharding
docker-compose up -d

# Or use the management script
./manage-db.sh start-dev  # Linux/Mac
.\manage-db.ps1 start-dev  # Windows
```

### 3. Backend Setup
```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your SMTP credentials
# DATABASE_URL=postgresql://postgres:password@localhost:5432/votp_db
# JWT_SECRET=your-secure-jwt-secret
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# Install dependencies and run
cargo run
```

Server will start at `http://localhost:8000`
- GraphQL Playground: `http://localhost:8000/playground`
- API Endpoint: `http://localhost:8000/api`

### 4. Chrome Extension Setup
```bash
# Open Chrome and go to Extensions
chrome://extensions/

# Enable "Developer mode" (top right toggle)
# Click "Load unpacked" and select the 'extension' folder
```

### 5. Test the Platform
1. **Open any website** (e.g., news article, blog post)
2. **Click the VOTP extension icon** in Chrome toolbar
3. **Sign up** with your email (you'll receive a verification code)
4. **Start commenting** and engaging with the community!

## 📁 Project Structure

```
votp/
├── 🦀 backend/                 # Rust GraphQL API Server
│   ├── src/
│   │   ├── main.rs            # Application entry point
│   │   ├── config.rs          # Configuration management
│   │   ├── database.rs        # Database connection & migrations
│   │   ├── models.rs          # Data models (User, Comment)
│   │   ├── utils.rs           # URL normalization & utilities
│   │   ├── graphql/           # GraphQL schema & resolvers
│   │   │   ├── mod.rs
│   │   │   ├── query.rs       # Query resolvers
│   │   │   └── mutation.rs    # Mutation resolvers
│   │   └── services/          # Business logic services
│   │       ├── auth.rs        # Authentication service
│   │       └── email.rs       # SMTP email service
│   ├── Cargo.toml            # Rust dependencies
│   ├── Dockerfile            # Container image
│   └── .env.example          # Environment template
│
├── 🌐 extension/              # Chrome Extension
│   ├── manifest.json         # Extension manifest (v3)
│   ├── background.js         # Service worker
│   ├── content.js            # Content script
│   ├── sidebar/              # Sidebar interface
│   │   ├── sidebar.html      # UI layout
│   │   ├── sidebar.css       # Styling
│   │   └── sidebar.js        # Authentication & comments logic
│   └── icons/                # Extension icons
│
├── 🗄️ database/               # PostgreSQL Setup
│   ├── docker-compose.yml    # Multi-node database cluster
│   ├── init-sharding.sql     # Database schema & sharding setup
│   ├── manage-db.sh          # Database management (Linux/Mac)
│   ├── manage-db.ps1         # Database management (Windows)
│   └── README.md             # Database documentation
│
├── 🚀 deployment/             # Production Deployment
│   └── kubernetes/           # Kubernetes manifests
│       ├── votp-deployment.yaml  # Complete K8s deployment
│       ├── deploy.sh         # Automated deployment (Linux/Mac)
│       ├── deploy.ps1        # Automated deployment (Windows)
│       └── README.md         # Deployment guide
│
├── 📄 LICENSE                # Proprietary license
├── 📖 README.md              # This file
└── 📋 mvp.md                 # Detailed MVP requirements
```

## 🛠️ Development

### Backend Development
```bash
cd backend

# Watch mode with auto-reload
cargo install cargo-watch
cargo watch -x run

# Run tests
cargo test

# Check code quality
cargo clippy
cargo fmt
```

### Database Management
```bash
cd database

# View status
./manage-db.sh status

# Connect to database
./manage-db.sh connect

# Create backup
./manage-db.sh backup

# View logs
./manage-db.sh logs postgres-master
```

### Extension Development
1. Make changes to files in `extension/`
2. Go to `chrome://extensions/`
3. Click "Reload" on the VOTP extension
4. Test on any webpage

## 🚢 Production Deployment

### Option 1: Docker Compose (Simple)
```bash
cd database
docker-compose up -d

cd ../backend
docker build -t votp-backend .
docker run -p 8000:8000 --env-file .env votp-backend
```

### Option 2: Kubernetes (Scalable)
```bash
cd deployment/kubernetes

# Automated deployment
./deploy.sh  # Linux/Mac
.\deploy.ps1 # Windows

# Manual deployment
kubectl apply -f votp-deployment.yaml
```

The Kubernetes deployment includes:
- PostgreSQL master + 2 shards with replication
- Redis for caching
- Auto-scaling backend (3-10 replicas)
- NGINX Ingress with SSL
- Network policies for security

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: 24-hour expiry with secure secrets
- **Password Hashing**: Argon2id with random salts
- **Email Verification**: 6-digit codes with 10-minute expiry
- **Rate Limiting**: Protection against brute force attacks

### Data Protection
- **SQL Injection Prevention**: Parameterized queries with SQLx
- **XSS Protection**: Input sanitization and output encoding
- **CORS Configuration**: Restricted cross-origin requests
- **HTTPS Enforcement**: TLS 1.2+ with strong ciphers

### Infrastructure Security
- **Network Policies**: Kubernetes pod-to-pod restrictions
- **Container Security**: Non-root users, read-only filesystems
- **Secrets Management**: Kubernetes secrets for sensitive data
- **Database Encryption**: SSL connections, encrypted storage

## 🧪 Testing

### Backend Tests
```bash
cd backend
cargo test                    # Unit tests
cargo test --integration     # Integration tests
```

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] Sidebar opens/closes properly
- [ ] Email signup flow works
- [ ] Login with existing account
- [ ] Comment posting and display
- [ ] URL normalization (test with trailing slashes, subdomains)
- [ ] Real-time comment updates
- [ ] Logout functionality

## 📊 Performance Metrics

### Database Sharding
- **Shard 1**: URLs with hash `0-5` (50% of traffic)
- **Shard 2**: URLs with hash `6-b` (50% of traffic)
- **Master**: User data + fallback comments

### Scalability Targets
- **10,000 concurrent users**
- **1M+ comments stored**
- **Sub-100ms API response times**
- **99.9% uptime**

## 📝 API Documentation

### GraphQL Schema
The API provides a single GraphQL endpoint at `/api` with the following operations:

#### Queries
```graphql
# Get current authenticated user
currentUser: User

# Get comments for a URL
commentsForUrl(url: String!): [Comment!]!

# Get user profile
userProfile(userId: ID!): User
```

#### Mutations
```graphql
# Authentication
checkEmail(email: String!): Boolean!
sendVerificationCode(email: String!): Boolean!
login(email: String!, password: String!): AuthPayload!
signUp(email: String!, password: String!, verificationCode: String!, name: String!): AuthPayload!

# Comments
createComment(content: String!, url: String!): Comment!
updateComment(id: ID!, content: String!): Comment!
deleteComment(id: ID!): Boolean!

# Profile
updateProfile(name: String, phoneNumber: String, bio: String): User!
```

### REST Endpoints
- `GET /playground` - GraphQL Playground (development)
- `POST /api` - GraphQL endpoint
- Health checks are built into the GraphQL playground

## 🌐 Browser Support

### Chrome Extension
- ✅ **Chrome 88+** (Manifest v3 support)
- ✅ **Edge 88+** (Chromium-based)
- ⏳ **Firefox** (Future: Manifest v3 migration)
- ⏳ **Safari** (Future: Safari Web Extensions)

### Web Standards
- Modern JavaScript (ES2020+)
- CSS Grid & Flexbox
- Fetch API with Promises
- Web Storage API

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards
- **Rust**: Follow `rustfmt` and `clippy` suggestions
- **JavaScript**: Use modern ES6+ syntax, no semicolons
- **CSS**: BEM methodology, mobile-first responsive design
- **Git**: Conventional commits format

### Testing Requirements
- All new features must include tests
- Maintain >80% code coverage
- Test across multiple browsers
- Validate accessibility (WCAG 2.1 AA)

## 📜 License

**Proprietary Commercial License**

Copyright (c) 2025 theproject. All rights reserved.

This software and associated documentation files (the "Software") are proprietary and confidential. See [LICENSE](LICENSE) file for complete terms.

**Key Restrictions:**
- ❌ No redistribution or modification without permission
- ❌ No commercial use by third parties
- ❌ No reverse engineering or decompilation
- ✅ Internal use by authorized personnel only

## 📞 Support & Contact

### Getting Help
- 📧 **Email**: support@votp.com
- 📖 **Documentation**: See `/docs` directory
- 🐛 **Bug Reports**: GitHub Issues (internal repo)
- 💡 **Feature Requests**: GitHub Discussions

### Status & Monitoring
- 🟢 **System Status**: [to co](#)
- 📊 **Performance**: Internal monitoring dashboard
- 🔄 **CI/CD**: GitHub Actions pipeline

---

## 🎯 Roadmap

### Phase 1: MVP (Current)
- [x] Basic Chrome extension
- [x] User authentication
- [x] Comment CRUD operations
- [x] Database sharding
- [x] Kubernetes deployment

### Phase 2: Enhancement
- [ ] Comment threading/replies
- [ ] Like/dislike reactions
- [ ] Real-time notifications
- [ ] Moderation tools
- [ ] User blocking/reporting

### Phase 3: Scale
- [ ] Firefox extension
- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] API rate limiting
- [ ] Enterprise features

### Phase 4: Innovation
- [ ] AI-powered content moderation
- [ ] Sentiment analysis
- [ ] Topic categorization
- [ ] Community insights dashboard

---

**Built with ❤️ by the VOTP team**

*Last updated: January 2025*