#!/bin/bash

# VOTP Database Management Script
# Usage: ./manage-db.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
MASTER_CONTAINER="votp-postgres-master"
DB_NAME="votp_db"
DB_USER="postgres"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to start database services
start_db() {
    print_status "Starting VOTP database cluster..."
    docker-compose up -d
    
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    docker-compose ps
}

# Function to start with development tools
start_dev() {
    print_status "Starting VOTP database cluster with development tools..."
    docker-compose --profile dev up -d
    
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    print_status "Services started. PgAdmin available at: http://localhost:8080"
    print_status "PgAdmin credentials: admin@votp.com / admin123"
    
    docker-compose ps
}

# Function to stop database services
stop_db() {
    print_status "Stopping VOTP database cluster..."
    docker-compose down
}

# Function to restart database services
restart_db() {
    print_status "Restarting VOTP database cluster..."
    docker-compose restart
}

# Function to view logs
logs() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Function to connect to master database
connect() {
    print_status "Connecting to master database..."
    docker exec -it $MASTER_CONTAINER psql -U $DB_USER -d $DB_NAME
}

# Function to backup database
backup() {
    BACKUP_FILE="votp_backup_$(date +%Y%m%d_%H%M%S).sql"
    print_status "Creating backup: $BACKUP_FILE"
    
    docker exec $MASTER_CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_status "Backup created successfully: $BACKUP_FILE"
    else
        print_error "Backup failed"
        exit 1
    fi
}

# Function to restore database
restore() {
    if [ -z "$2" ]; then
        print_error "Please provide backup file path"
        print_error "Usage: ./manage-db.sh restore <backup_file>"
        exit 1
    fi
    
    BACKUP_FILE="$2"
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    print_warning "This will replace all data in the database. Are you sure? (y/N)"
    read -r confirmation
    
    if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
        print_status "Restore cancelled"
        exit 0
    fi
    
    print_status "Restoring from backup: $BACKUP_FILE"
    docker exec -i $MASTER_CONTAINER psql -U $DB_USER $DB_NAME < "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_status "Restore completed successfully"
    else
        print_error "Restore failed"
        exit 1
    fi
}

# Function to reset database (WARNING: Deletes all data)
reset() {
    print_warning "This will DELETE ALL DATA in the database. Are you sure? (y/N)"
    read -r confirmation
    
    if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
        print_status "Reset cancelled"
        exit 0
    fi
    
    print_status "Stopping services..."
    docker-compose down
    
    print_status "Removing volumes..."
    docker-compose down -v
    
    print_status "Starting fresh database..."
    docker-compose up -d
    
    print_status "Database reset completed"
}

# Function to show status
status() {
    print_status "Database cluster status:"
    docker-compose ps
    
    echo ""
    print_status "Container health:"
    docker-compose exec postgres-master pg_isready -U postgres -d votp_db || print_error "Master database not ready"
    docker-compose exec redis redis-cli --no-auth-warning -a redis_password ping || print_error "Redis not ready"
}

# Function to run SQL query
query() {
    if [ -z "$2" ]; then
        print_error "Please provide SQL query"
        print_error "Usage: ./manage-db.sh query \"SELECT * FROM users;\""
        exit 1
    fi
    
    SQL_QUERY="$2"
    print_status "Executing query: $SQL_QUERY"
    
    docker exec $MASTER_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$SQL_QUERY"
}

# Function to show help
show_help() {
    cat << EOF
VOTP Database Management Script

Usage: ./manage-db.sh [command] [options]

Commands:
    start       Start the database cluster
    start-dev   Start with development tools (PgAdmin)
    stop        Stop the database cluster
    restart     Restart the database cluster
    logs        View logs (optional: specify service name)
    connect     Connect to master database
    backup      Create database backup
    restore     Restore from backup file
    reset       Reset database (WARNING: Deletes all data)
    status      Show cluster status
    query       Execute SQL query
    help        Show this help message

Examples:
    ./manage-db.sh start
    ./manage-db.sh start-dev
    ./manage-db.sh logs postgres-master
    ./manage-db.sh backup
    ./manage-db.sh restore votp_backup_20241001_120000.sql
    ./manage-db.sh query "SELECT COUNT(*) FROM users;"

For more information, see README.md
EOF
}

# Main script logic
check_docker

case "$1" in
    start)
        start_db
        ;;
    start-dev)
        start_dev
        ;;
    stop)
        stop_db
        ;;
    restart)
        restart_db
        ;;
    logs)
        logs "$@"
        ;;
    connect)
        connect
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$@"
        ;;
    reset)
        reset
        ;;
    status)
        status
        ;;
    query)
        query "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac