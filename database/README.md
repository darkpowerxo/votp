# VOTP Database Setup

This directory contains the PostgreSQL database configuration with sharding support for the Voice of the People (VOTP) platform.

## Architecture

- **Master Database**: Primary PostgreSQL instance that handles user data and coordinates sharding
- **Shard 1**: Handles comments for URLs with hash starting with 0-5
- **Shard 2**: Handles comments for URLs with hash starting with 6-b
- **Redis**: Caching layer for sessions and temporary data
- **PgAdmin**: Web-based database administration tool (development only)

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM available for containers

### Start the Database Cluster

```bash
# Start all database services
docker-compose up -d

# Start with PgAdmin for development
docker-compose --profile dev up -d

# Check service health
docker-compose ps
```

### Environment Variables

The following environment variables are configured in docker-compose.yml:

- `POSTGRESQL_PASSWORD`: adminpassword
- `POSTGRESQL_DATABASE`: votp_db
- `POSTGRESQL_REPLICATION_PASSWORD`: repl_password
- `REDIS_PASSWORD`: redis_password
- `PGADMIN_EMAIL`: admin@votp.com
- `PGADMIN_PASSWORD`: admin123

### Connection Details

| Service | Host | Port | Database | Username | Password |
|---------|------|------|----------|----------|----------|
| Master | localhost | 5432 | votp_db | postgres | adminpassword |
| Shard 1 | localhost | 5433 | - | postgres | adminpassword |
| Shard 2 | localhost | 5434 | - | postgres | adminpassword |
| Redis | localhost | 6379 | - | - | redis_password |
| PgAdmin | localhost | 8080 | - | admin@votp.com | admin123 |

### Database Schema

The database includes the following main tables:

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    bio TEXT,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Comments Table (Sharded)
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    url_hash VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES comments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Sharding Strategy

Comments are distributed across shards based on the URL hash:
- URLs with hash starting with `0-5` → Shard 1
- URLs with hash starting with `6-b` → Shard 2
- Other URLs → Master (fallback)

## Useful Commands

### Connect to Master Database
```bash
docker exec -it votp-postgres-master psql -U postgres -d votp_db
```

### Connect to Shard 1
```bash
docker exec -it votp-postgres-shard-1 psql -U postgres
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres-master
```

### Backup Database
```bash
# Create backup
docker exec votp-postgres-master pg_dump -U postgres votp_db > backup.sql

# Restore backup
docker exec -i votp-postgres-master psql -U postgres votp_db < backup.sql
```

### Reset Database
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Monitoring and Health Checks

Health check endpoints are configured for all services:
- PostgreSQL: `pg_isready` command
- Redis: `redis-cli ping` command

Check service health:
```bash
docker-compose ps
```

## Performance Tuning

For production, consider adjusting these PostgreSQL settings in the docker-compose.yml environment:

```yaml
environment:
  - POSTGRESQL_SHARED_BUFFERS=256MB
  - POSTGRESQL_EFFECTIVE_CACHE_SIZE=1GB
  - POSTGRESQL_MAINTENANCE_WORK_MEM=64MB
  - POSTGRESQL_CHECKPOINT_COMPLETION_TARGET=0.9
  - POSTGRESQL_WAL_BUFFERS=16MB
  - POSTGRESQL_DEFAULT_STATISTICS_TARGET=100
```

## Security Notes

⚠️ **Important**: The current configuration is for development only. For production:

1. Change all default passwords
2. Use proper SSL certificates
3. Configure firewall rules
4. Enable PostgreSQL SSL
5. Use secrets management
6. Implement proper backup strategy
7. Monitor replication lag

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml if 5432-5434 are in use
2. **Memory issues**: Increase Docker memory allocation
3. **Permission errors**: Check Docker permissions and volume mounts
4. **Replication issues**: Check master/slave connectivity and credentials

### View Database Stats
```sql
-- Connect to master database
\c votp_db

-- View comment statistics
SELECT * FROM comment_stats;

-- View popular URLs
SELECT * FROM popular_urls LIMIT 10;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public';
```

## Development vs Production

This setup is optimized for development. For production deployment, see the `../deployment/kubernetes/` directory for Kubernetes manifests with proper:
- Resource limits
- Security contexts
- Persistent volumes
- Load balancing
- SSL/TLS configuration
- Monitoring and alerting