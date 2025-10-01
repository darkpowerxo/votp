# VOTP System Architecture

## Overview

Voice of the People (VOTP) is a distributed commenting platform that enables users to engage in discussions on any webpage through a Chrome extension. This document provides a comprehensive architectural overview from a solutions architect perspective.

## High-Level Architecture

```mermaid
architecture-beta
    group client(cloud)[Client Layer]
    group extension(server)[Browser Extension]
    group backend(server)[Backend Services]
    group data(database)[Data Layer]
    group external(internet)[External Services]

    service browser(internet)[Web Browser] in client
    service content[Content Script] in extension
    service background[Background Service] in extension
    service sidebar[Sidebar UI] in extension
    
    service api(server)[GraphQL API] in backend
    service auth[Auth Service] in backend
    service email[Email Service] in backend
    
    service postgres(database)[PostgreSQL] in data
    service redis(database)[Redis Cache] in data
    
    service smtp(internet)[SMTP Server] in external
    service websites(internet)[Target Websites] in external

    browser:R -- L:content
    content:R -- L:background
    background:B -- T:sidebar
    content:B -- T:api
    background:B -- T:api
    api:R -- L:auth
    api:R -- L:email
    api:B -- T:postgres
    api:B -- T:redis
    email:R -- L:smtp
    browser:B -- T:websites
```

## Component Architecture

### 1. Browser Extension Layer

The Chrome extension operates across multiple contexts to provide seamless commenting functionality:

```mermaid
graph TB
    A[Web Page] --> B[Content Script]
    B --> C[Background Service Worker]
    B --> D[Sidebar UI]
    C --> E[Extension Storage]
    C --> F[Backend API]
    D --> F
    
    subgraph "Extension Contexts"
        B[Content Script<br/>- Sidebar injection<br/>- Page interaction<br/>- Message routing]
        C[Background Service<br/>- API communication<br/>- Auth management<br/>- Storage handling]
        D[Sidebar UI<br/>- Comment interface<br/>- User authentication<br/>- Real-time updates]
    end
```

**Content Script Responsibilities:**
- Inject commenting sidebar into web pages
- Manage sidebar visibility and positioning
- Route messages between contexts
- Handle extension context validation

**Background Service Worker:**
- Authenticate users with JWT tokens
- Make secure API requests to backend
- Manage extension state and storage
- Handle extension lifecycle events

**Sidebar UI:**
- Provide commenting interface
- Handle user authentication flows
- Display comments for current page
- Manage real-time comment updates

### 2. Backend Services Architecture

The backend is built on a modern Rust stack with GraphQL API:

```mermaid
graph TB
    A[HTTP Requests] --> B[Actix-Web Server]
    B --> C[CORS Middleware]
    C --> D[JWT Auth Middleware]
    D --> E[GraphQL Handler]
    E --> F[Query Resolver]
    E --> G[Mutation Resolver]
    F --> H[Database Pool]
    G --> H
    G --> I[Auth Service]
    G --> J[Email Service]
    H --> K[(PostgreSQL)]
    I --> L[JWT Tokens]
    J --> M[SMTP Server]
    
    subgraph "Business Logic"
        F[Query Resolver<br/>- Comments retrieval<br/>- User lookup<br/>- Search functionality]
        G[Mutation Resolver<br/>- User registration<br/>- Comment CRUD<br/>- Authentication]
    end
    
    subgraph "Services"
        I[Auth Service<br/>- Password hashing<br/>- JWT generation<br/>- Token validation]
        J[Email Service<br/>- Verification codes<br/>- Welcome emails<br/>- Notifications]
    end
```

### 3. Data Architecture

The data layer provides scalable storage and caching:

```mermaid
erDiagram
    USERS ||--o{ COMMENTS : creates
    COMMENTS ||--o{ COMMENTS : replies_to
    
    USERS {
        uuid id PK
        string name
        string email UK
        string password_hash
        string phone_number
        text bio
        boolean email_verified
        string verification_code
        timestamp verification_code_expires_at
        timestamp created_at
        timestamp updated_at
    }
    
    COMMENTS {
        uuid id PK
        text content
        string url
        string normalized_url
        string url_hash
        uuid user_id FK
        uuid parent_id FK
        timestamp created_at
        timestamp updated_at
    }
```

**Database Design Principles:**
- **UUID Primary Keys**: Scalable, non-sequential identifiers
- **URL Normalization**: Consistent comment grouping across similar URLs
- **Hash Indexing**: Fast comment retrieval by URL
- **Hierarchical Comments**: Support for threaded discussions
- **Soft Constraints**: Flexible schema for future extensions

### 4. Security Architecture

```mermaid
graph LR
    A[Browser Extension] --> B[JWT Token]
    B --> C[HTTPS Request]
    C --> D[Backend API]
    D --> E[JWT Validation]
    E --> F[User Context]
    F --> G[Authorized Operation]
    
    subgraph "Security Layers"
        H[Content Security Policy]
        I[CORS Protection]
        J[Password Hashing]
        K[Email Verification]
        L[Rate Limiting]
    end
    
    D --> H
    D --> I
    D --> J
    D --> K
    D --> L
```

**Security Features:**
- **JWT Authentication**: Stateless token-based auth
- **Password Security**: Argon2 hashing algorithm
- **Email Verification**: Prevent fake account creation
- **CORS Protection**: Controlled cross-origin access
- **CSP Compliance**: Secure extension execution
- **HTTPS Only**: Encrypted data transmission

## Deployment Architecture

### Development Environment

```mermaid
graph TB
    A[Developer Machine] --> B[Docker Compose]
    B --> C[PostgreSQL Container]
    B --> D[Redis Container]
    A --> E[Rust Backend]
    A --> F[Chrome Extension]
    E --> C
    E --> D
    F --> E
```

### Production Environment

```mermaid
architecture-beta
    group k8s(cloud)[Kubernetes Cluster]
    group ingress(internet)[Load Balancer]
    group apps(server)[Application Layer]
    group data(database)[Data Layer]
    group monitoring(server)[Monitoring]

    service lb(internet)[Load Balancer] in ingress
    service ingress_ctrl[Ingress Controller] in ingress
    
    service api_pods(server)[API Pods] in apps
    service worker_pods(server)[Worker Pods] in apps
    
    service postgres_cluster(database)[PostgreSQL] in data
    service redis_cluster(database)[Redis Cluster] in data
    service storage(disk)[Persistent Storage] in data
    
    service prometheus(server)[Prometheus] in monitoring
    service grafana(server)[Grafana] in monitoring

    lb:R -- L:ingress_ctrl
    ingress_ctrl:B -- T:api_pods
    api_pods:B -- T:postgres_cluster
    api_pods:B -- T:redis_cluster
    postgres_cluster:B -- T:storage
    api_pods:R -- L:prometheus
    prometheus:R -- L:grafana
```

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: Multiple backend instances behind load balancer
- **Database Sharding**: Partition comments by URL hash
- **Redis Clustering**: Distributed caching for session management
- **CDN Integration**: Static asset delivery optimization

### Performance Optimization
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed searches and joins
- **Caching Strategy**: Redis for frequently accessed data
- **Async Processing**: Non-blocking I/O operations

### Monitoring and Observability

```mermaid
graph TB
    A[Application Metrics] --> B[Prometheus]
    C[Database Metrics] --> B
    D[System Metrics] --> B
    B --> E[Grafana Dashboards]
    F[Application Logs] --> G[Log Aggregation]
    H[Error Tracking] --> I[Alert Manager]
    E --> J[Operations Team]
    G --> J
    I --> J
```

## Technology Stack

### Frontend (Chrome Extension)
- **Language**: JavaScript (ES2020+)
- **Manifest**: V3 for modern Chrome extensions
- **UI Framework**: Vanilla JS with modern CSS
- **Build Process**: Native browser APIs, no bundling required

### Backend Services
- **Language**: Rust (2021 Edition)
- **Web Framework**: Actix-Web 4.x
- **GraphQL**: async-graphql 7.x
- **Database**: SQLx with PostgreSQL driver
- **Authentication**: jsonwebtoken + Argon2
- **Email**: lettre with native-tls

### Data Layer
- **Primary Database**: PostgreSQL 15+
- **Caching**: Redis 7+
- **Migrations**: SQLx migrations
- **Connection Pooling**: SQLx connection pool

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (production)
- **Reverse Proxy**: Nginx Ingress Controller
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: GitHub Actions (future)

## Data Flow Patterns

### Comment Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant E as Extension
    participant A as API
    participant D as Database
    
    U->>E: Write comment
    E->>A: POST /api (createComment)
    A->>A: Validate JWT token
    A->>A: Normalize URL
    A->>D: INSERT comment
    D-->>A: Comment created
    A-->>E: Comment response
    E-->>U: Success confirmation
    
    E->>A: GET comments for URL
    A->>D: SELECT comments by URL hash
    D-->>A: Comments list
    A-->>E: Updated comments
    E-->>U: Refresh comment list
```

### User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant E as Extension
    participant A as API
    participant M as Email Service
    participant D as Database
    
    U->>E: Enter email
    E->>A: Check if user exists
    A->>D: SELECT user by email
    D-->>A: User status
    A-->>E: User exists/new
    
    alt New User
        E->>A: Request verification code
        A->>M: Send verification email
        A->>D: Store temp verification
        U->>E: Enter verification code
        E->>A: Complete registration
        A->>D: CREATE user
    else Existing User
        U->>E: Enter password
        E->>A: Login request
        A->>A: Verify password
        A->>A: Generate JWT token
    end
    
    A-->>E: JWT token
    E->>E: Store token
    E-->>U: Authenticated
```

## Integration Points

### Chrome Extension APIs
- **Storage API**: Token and user data persistence
- **Tabs API**: URL detection and page management
- **Runtime API**: Inter-context messaging
- **WebRequest API**: Request interception (future)

### External Services
- **SMTP Server**: Email delivery service
- **OAuth Providers**: Future social login integration
- **CDN Services**: Static asset delivery
- **Analytics**: Usage tracking and insights

## Future Architecture Considerations

### Planned Enhancements
- **Real-time Updates**: WebSocket connections for live comments
- **Content Moderation**: AI-powered content filtering
- **Mobile App**: React Native companion app
- **Social Features**: User profiles and following
- **Analytics Dashboard**: Comment engagement metrics

### Scalability Roadmap
- **Microservices**: Break monolith into specialized services
- **Event Sourcing**: Audit trail and state reconstruction
- **CQRS Pattern**: Separate read/write optimizations
- **Global Distribution**: Multi-region deployment strategy

---

*This architecture document reflects the current system design and is updated with major architectural changes.*