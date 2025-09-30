# VOTP Database Management Script (PowerShell)
# Usage: .\manage-db.ps1 [command]

param(
    [Parameter(Position=0)]
    [string]$Command,
    
    [Parameter(Position=1)]
    [string]$Parameter
)

# Configuration
$ComposeFile = "docker-compose.yml"
$MasterContainer = "votp-postgres-master"
$DBName = "votp_db"
$DBUser = "postgres"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker first."
        exit 1
    }
}

# Function to start database services
function Start-Database {
    Write-Status "Starting VOTP database cluster..."
    docker-compose up -d
    
    Write-Status "Waiting for services to be healthy..."
    Start-Sleep -Seconds 10
    
    # Check health
    docker-compose ps
}

# Function to start with development tools
function Start-Development {
    Write-Status "Starting VOTP database cluster with development tools..."
    docker-compose --profile dev up -d
    
    Write-Status "Waiting for services to be healthy..."
    Start-Sleep -Seconds 10
    
    Write-Status "Services started. PgAdmin available at: http://localhost:8080"
    Write-Status "PgAdmin credentials: admin@votp.com / admin123"
    
    docker-compose ps
}

# Function to stop database services
function Stop-Database {
    Write-Status "Stopping VOTP database cluster..."
    docker-compose down
}

# Function to restart database services
function Restart-Database {
    Write-Status "Restarting VOTP database cluster..."
    docker-compose restart
}

# Function to view logs
function Show-Logs {
    param([string]$ServiceName)
    
    if ($ServiceName) {
        docker-compose logs -f $ServiceName
    } else {
        docker-compose logs -f
    }
}

# Function to connect to master database
function Connect-Database {
    Write-Status "Connecting to master database..."
    docker exec -it $MasterContainer psql -U $DBUser -d $DBName
}

# Function to backup database
function Backup-Database {
    $BackupFile = "votp_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    Write-Status "Creating backup: $BackupFile"
    
    docker exec $MasterContainer pg_dump -U $DBUser $DBName | Out-File -FilePath $BackupFile -Encoding UTF8
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Backup created successfully: $BackupFile"
    } else {
        Write-Error "Backup failed"
        exit 1
    }
}

# Function to restore database
function Restore-Database {
    param([string]$BackupFile)
    
    if (-not $BackupFile) {
        Write-Error "Please provide backup file path"
        Write-Error "Usage: .\manage-db.ps1 restore <backup_file>"
        exit 1
    }
    
    if (-not (Test-Path $BackupFile)) {
        Write-Error "Backup file not found: $BackupFile"
        exit 1
    }
    
    Write-Warning "This will replace all data in the database. Are you sure? (y/N)"
    $confirmation = Read-Host
    
    if ($confirmation -ne "y" -and $confirmation -ne "Y") {
        Write-Status "Restore cancelled"
        exit 0
    }
    
    Write-Status "Restoring from backup: $BackupFile"
    Get-Content $BackupFile | docker exec -i $MasterContainer psql -U $DBUser $DBName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Restore completed successfully"
    } else {
        Write-Error "Restore failed"
        exit 1
    }
}

# Function to reset database (WARNING: Deletes all data)
function Reset-Database {
    Write-Warning "This will DELETE ALL DATA in the database. Are you sure? (y/N)"
    $confirmation = Read-Host
    
    if ($confirmation -ne "y" -and $confirmation -ne "Y") {
        Write-Status "Reset cancelled"
        exit 0
    }
    
    Write-Status "Stopping services..."
    docker-compose down
    
    Write-Status "Removing volumes..."
    docker-compose down -v
    
    Write-Status "Starting fresh database..."
    docker-compose up -d
    
    Write-Status "Database reset completed"
}

# Function to show status
function Show-Status {
    Write-Status "Database cluster status:"
    docker-compose ps
    
    Write-Host ""
    Write-Status "Container health:"
    
    try {
        docker-compose exec postgres-master pg_isready -U postgres -d votp_db
    } catch {
        Write-Error "Master database not ready"
    }
    
    try {
        docker-compose exec redis redis-cli --no-auth-warning -a redis_password ping
    } catch {
        Write-Error "Redis not ready"
    }
}

# Function to run SQL query
function Invoke-Query {
    param([string]$SqlQuery)
    
    if (-not $SqlQuery) {
        Write-Error "Please provide SQL query"
        Write-Error "Usage: .\manage-db.ps1 query `"SELECT * FROM users;`""
        exit 1
    }
    
    Write-Status "Executing query: $SqlQuery"
    docker exec $MasterContainer psql -U $DBUser -d $DBName -c $SqlQuery
}

# Function to show help
function Show-Help {
    @"
VOTP Database Management Script (PowerShell)

Usage: .\manage-db.ps1 [command] [options]

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
    .\manage-db.ps1 start
    .\manage-db.ps1 start-dev
    .\manage-db.ps1 logs postgres-master
    .\manage-db.ps1 backup
    .\manage-db.ps1 restore votp_backup_20241001_120000.sql
    .\manage-db.ps1 query "SELECT COUNT(*) FROM users;"

For more information, see README.md
"@
}

# Main script logic
Test-Docker

switch ($Command) {
    "start" { Start-Database }
    "start-dev" { Start-Development }
    "stop" { Stop-Database }
    "restart" { Restart-Database }
    "logs" { Show-Logs -ServiceName $Parameter }
    "connect" { Connect-Database }
    "backup" { Backup-Database }
    "restore" { Restore-Database -BackupFile $Parameter }
    "reset" { Reset-Database }
    "status" { Show-Status }
    "query" { Invoke-Query -SqlQuery $Parameter }
    "help" { Show-Help }
    "" { 
        Write-Error "No command specified"
        Write-Host ""
        Show-Help
        exit 1
    }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}