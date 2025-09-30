# VOTP Platform - Complete Setup Script (PowerShell)
# This script sets up the entire VOTP platform for development

param(
    [switch]$Help
)

if ($Help) {
    Write-Host @"
VOTP Platform Setup Script

Usage: .\setup.ps1

This script will:
1. Check prerequisites (Docker, Rust, Git)
2. Set up PostgreSQL database with sharding
3. Configure backend environment
4. Provide next steps for running the platform

Prerequisites:
- Docker Desktop for Windows
- Rust (from rustup.rs)
- Git for Windows
- PowerShell 5.0+
"@
    exit 0
}

Write-Host "🗣️  VOTP - Voice of the People Platform Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Function to print colored output
function Write-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param($Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check Docker
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    }
    
    # Check Docker Compose
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }
    
    # Check Rust
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Error "Rust is not installed. Please install Rust from https://rustup.rs/"
        exit 1
    }
    
    # Check Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error "Git is not installed. Please install Git first."
        exit 1
    }
    
    Write-Success "All prerequisites are installed!"
}

# Setup database
function Set-DatabaseUp {
    Write-Status "Setting up PostgreSQL database with sharding..."
    
    Push-Location database
    
    try {
        # Stop any existing containers
        docker-compose down 2>$null
        
        # Start database cluster
        docker-compose up -d
        
        # Wait for databases to be ready
        Write-Status "Waiting for databases to be ready..."
        Start-Sleep -Seconds 30
        
        # Check if databases are healthy
        $healthyContainers = docker-compose ps | Select-String "healthy"
        if ($healthyContainers) {
            Write-Success "Database cluster is running and healthy!"
        }
        else {
            Write-Warning "Database containers are starting up. Check 'docker-compose logs' if issues persist."
        }
    }
    finally {
        Pop-Location
    }
}

# Setup backend environment
function Set-BackendUp {
    Write-Status "Setting up Rust backend..."
    
    Push-Location backend
    
    try {
        # Create .env file if it doesn't exist
        if (-not (Test-Path .env)) {
            Write-Status "Creating .env file..."
            
            # Generate JWT secret
            $jwtSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
            
            $envContent = @"
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/votp_db

# JWT Configuration
JWT_SECRET=$jwtSecret

# SMTP Configuration (Update with your credentials)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Server Configuration
HOST=127.0.0.1
PORT=8000

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment
RUST_LOG=info
"@
            
            $envContent | Out-File -FilePath .env -Encoding UTF8
            Write-Warning "Created .env file. Please update SMTP credentials before running the backend!"
        }
        
        # Install dependencies
        Write-Status "Installing Rust dependencies..."
        cargo build
        
        Write-Success "Backend dependencies installed!"
    }
    finally {
        Pop-Location
    }
}

# Display instructions
function Show-Instructions {
    Write-Host ""
    Write-Host "🎉 VOTP Platform Setup Complete!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 📧 Configure Email (Required for authentication):" -ForegroundColor Yellow
    Write-Host "   - Edit backend\.env file"
    Write-Host "   - Update SMTP_USERNAME and SMTP_PASSWORD"
    Write-Host "   - For Gmail: Use App Passwords (not your regular password)"
    Write-Host ""
    Write-Host "2. 🚀 Start the Backend Server:" -ForegroundColor Yellow
    Write-Host "   cd backend"
    Write-Host "   cargo run"
    Write-Host "   # Server will start at http://localhost:8000"
    Write-Host ""
    Write-Host "3. 🌐 Install Chrome Extension:" -ForegroundColor Yellow
    Write-Host "   - Open Chrome and go to chrome://extensions/"
    Write-Host "   - Enable 'Developer mode' (top right toggle)"
    Write-Host "   - Click 'Load unpacked' and select the 'extension' folder"
    Write-Host ""
    Write-Host "4. 🧪 Test the Platform:" -ForegroundColor Yellow
    Write-Host "   - Visit any website"
    Write-Host "   - Click the VOTP extension icon"
    Write-Host "   - Sign up with your email"
    Write-Host "   - Start commenting!"
    Write-Host ""
    Write-Host "📖 Documentation:" -ForegroundColor Cyan
    Write-Host "   - API Playground: http://localhost:8000/playground"
    Write-Host "   - Database docs: database\README.md"
    Write-Host "   - Deployment docs: deployment\kubernetes\README.md"
    Write-Host ""
    Write-Host "🔧 Development Commands:" -ForegroundColor Cyan
    Write-Host "   - View database status: cd database; docker-compose ps"
    Write-Host "   - View logs: cd database; docker-compose logs -f"
    Write-Host "   - Connect to database: cd database; .\manage-db.ps1 connect"
    Write-Host "   - Backend with auto-reload: cd backend; cargo install cargo-watch; cargo watch -x run"
    Write-Host ""
    Write-Host "❓ Need Help?" -ForegroundColor Cyan
    Write-Host "   - Check README.md for detailed documentation"
    Write-Host "   - Review mvp.md for requirements"
    Write-Host "   - Email: support@votp.com"
    Write-Host ""
}

# Main setup process
function Main {
    try {
        Write-Host "Starting VOTP platform setup..." -ForegroundColor Cyan
        Write-Host ""
        
        Test-Prerequisites
        Write-Host ""
        
        Set-DatabaseUp
        Write-Host ""
        
        Set-BackendUp
        Write-Host ""
        
        Show-Instructions
        
        Write-Host "✨ Setup script completed successfully!" -ForegroundColor Green
        Write-Host "Happy coding! 🎯" -ForegroundColor Green
    }
    catch {
        Write-Error "Setup failed: $($_.Exception.Message)"
        exit 1
    }
}

# Handle Ctrl+C
$null = Register-EngineEvent PowerShell.Exiting -Action {
    Write-Host "`n[ERROR] Setup interrupted by user" -ForegroundColor Red
}

# Run main function
Main