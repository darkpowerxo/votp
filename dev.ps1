# VOTP Local Development Setup Script
# Quick setup for local testing

param(
    [switch]$Stop,
    [switch]$Reset,
    [switch]$Status,
    [switch]$Help
)

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

if ($Help) {
    Write-Host @"
VOTP Local Development Helper

Usage: .\dev.ps1 [options]

Options:
  -Help     Show this help message
  -Status   Show status of containers and backend
  -Stop     Stop all containers
  -Reset    Stop containers and remove all data
  (no args) Start development environment

Commands:
  .\dev.ps1           # Start everything
  .\dev.ps1 -Status   # Check status
  .\dev.ps1 -Stop     # Stop containers
  .\dev.ps1 -Reset    # Reset and clean data
"@
    exit 0
}

Write-ColorOutput Green "🗣️  VOTP Local Development"
Write-ColorOutput Green "=========================="

if ($Status) {
    Write-ColorOutput Cyan "📊 Container Status:"
    docker-compose -f docker-compose.dev.yml ps
    
    Write-ColorOutput Cyan "`n🗄️  Database Status:"
    try {
        $result = docker exec votp-postgres-dev pg_isready -U postgres -d votp_db 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✅ PostgreSQL is ready"
        } else {
            Write-ColorOutput Red "❌ PostgreSQL is not ready"
        }
    } catch {
        Write-ColorOutput Red "❌ PostgreSQL container not running"
    }
    
    Write-ColorOutput Cyan "`n📝 Backend Status:"
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/playground" -Method Head -TimeoutSec 5 -ErrorAction Stop
        Write-ColorOutput Green "✅ Backend server is running at http://localhost:8000"
    } catch {
        Write-ColorOutput Yellow "⚠️  Backend server is not running"
    }
    
    exit 0
}

if ($Stop) {
    Write-ColorOutput Yellow "🛑 Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    Write-ColorOutput Green "✅ Containers stopped"
    exit 0
}

if ($Reset) {
    Write-ColorOutput Yellow "🔄 Resetting development environment (this will delete all data)..."
    docker-compose -f docker-compose.dev.yml down -v
    Write-ColorOutput Green "✅ Containers stopped and data removed"
    exit 0
}

# Default: Start development environment
Write-ColorOutput Cyan "🚀 Starting VOTP development environment..."

# Check prerequisites
Write-ColorOutput Cyan "`n📋 Checking prerequisites..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ColorOutput Red "❌ Docker is not installed or not in PATH"
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-ColorOutput Red "❌ Docker Compose is not installed or not in PATH"
    exit 1
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-ColorOutput Red "❌ Rust/Cargo is not installed or not in PATH"
    Write-ColorOutput Yellow "Install from: https://rustup.rs/"
    exit 1
}

Write-ColorOutput Green "✅ All prerequisites found"

# Start containers
Write-ColorOutput Cyan "`n🐳 Starting Docker containers..."
docker-compose -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "❌ Failed to start containers"
    exit 1
}

# Wait for database to be ready
Write-ColorOutput Cyan "`n⏳ Waiting for database to be ready..."
$maxAttempts = 30
$attempt = 0

do {
    $attempt++
    try {
        $result = docker exec votp-postgres-dev pg_isready -U postgres -d votp_db 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✅ Database is ready!"
            break
        }
    } catch {}
    
    if ($attempt -ge $maxAttempts) {
        Write-ColorOutput Red "❌ Database failed to start after $maxAttempts attempts"
        Write-ColorOutput Yellow "Try running: docker-compose -f docker-compose.dev.yml logs postgres"
        exit 1
    }
    
    Write-Host "⏳ Attempt $attempt/$maxAttempts..." -NoNewline
    Start-Sleep -Seconds 2
    Write-Host " waiting..."
} while ($true)

# Setup backend environment
Write-ColorOutput Cyan "`n⚙️  Setting up backend environment..."

if (-not (Test-Path "backend\.env")) {
    if (Test-Path "backend\.env.dev") {
        Copy-Item "backend\.env.dev" "backend\.env"
        Write-ColorOutput Green "✅ Created backend\.env from template"
    } else {
        Write-ColorOutput Red "❌ No environment template found"
        exit 1
    }
}

# Build backend (if not already built)
Write-ColorOutput Cyan "`n🦀 Checking Rust backend..."
Push-Location backend
try {
    if (-not (Test-Path "target\debug\votp-backend.exe") -and -not (Test-Path "target\debug\backend.exe")) {
        Write-ColorOutput Cyan "🔨 Building backend (first time)..."
        cargo build
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput Red "❌ Failed to build backend"
            exit 1
        }
    }
    Write-ColorOutput Green "✅ Backend is ready"
} finally {
    Pop-Location
}

# Show success message and next steps
Write-ColorOutput Green "`n🎉 Development environment is ready!"
Write-ColorOutput Cyan "=================================="

Write-ColorOutput Yellow "`n📡 Services running:"
Write-ColorOutput White "  • PostgreSQL: localhost:5432"
Write-ColorOutput White "  • Redis: localhost:6379"
Write-ColorOutput White "  • PgAdmin (optional): http://localhost:8080"

Write-ColorOutput Yellow "`n🚀 Start the backend server:"
Write-ColorOutput White "  cd backend"
Write-ColorOutput White "  cargo run"

Write-ColorOutput Yellow "`n🌐 Then load the Chrome extension:"
Write-ColorOutput White "  1. Open chrome://extensions/"
Write-ColorOutput White "  2. Enable 'Developer mode'"
Write-ColorOutput White "  3. Click 'Load unpacked' and select 'extension' folder"

Write-ColorOutput Yellow "`n🧪 Test URLs:"
Write-ColorOutput White "  • GraphQL Playground: http://localhost:8000/playground"
Write-ColorOutput White "  • API Endpoint: http://localhost:8000/api"

Write-ColorOutput Cyan "`n💡 Helpful commands:"
Write-ColorOutput White "  .\dev.ps1 -Status   # Check status"
Write-ColorOutput White "  .\dev.ps1 -Stop     # Stop containers"
Write-ColorOutput White "  .\dev.ps1 -Reset    # Reset all data"

Write-ColorOutput Green "`nHappy coding! 🎯"