# VOTP - Voice of the People: Community Comments Platform

A Chrome/Edge extension that enables users to leave and view comments on any webpage, creating a shared community experience.

## Project Structure

```
votp/
├── backend/          # Rust backend server with GraphQL API
├── extension/        # Chrome/Edge extension
├── database/         # PostgreSQL setup and migrations  
├── deployment/       # Docker Compose and Kubernetes configs
├── LICENSE          # Proprietary license
├── README.md        # This file
└── mvp.md          # Detailed requirements
```

## Quick Start

### Prerequisites
- Rust 1.70+
- Docker & Docker Compose
- Node.js 18+ (for extension development)
- PostgreSQL 15+

### Backend Setup
```bash
cd backend
cargo run
```

### Database Setup
```bash
cd database
docker-compose up -d
```

### Chrome Extension
1. Load `extension/` folder in Chrome Developer Mode
2. Click extension icon to activate sidebar
3. Sign up or login to start commenting

## Features

- **Universal Comments**: Comment on any webpage
- **URL Normalization**: Smart URL matching across variations
- **Real-time Updates**: See new comments instantly  
- **User Authentication**: Secure email-based signup/login
- **Sharded Database**: Scalable PostgreSQL architecture
- **Modern UI**: Clean, responsive extension interface

## Architecture

- **Frontend**: Chrome Extension (Manifest v3)
- **Backend**: Rust with Actix-web + async-GraphQL
- **Database**: PostgreSQL with sharding
- **Deployment**: Docker Compose + Kubernetes
- **Authentication**: JWT with email verification

## Security

- Argon2id password hashing
- JWT tokens with refresh mechanism
- Rate limiting on auth endpoints
- CORS protection
- Input sanitization
- SQL injection prevention

## License

Proprietary - See LICENSE file for details.

## Development Status

🚧 **In Development** - MVP implementation in progress

## Contact

For questions or support, please contact the development team.
