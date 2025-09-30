#!/bin/bash

# VOTP Platform - Complete Setup Script
# This script sets up the entire VOTP platform for development

set -e

echo "🗣️  VOTP - Voice of the People Platform Setup"
echo "============================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Rust is not installed. Please install Rust from https://rustup.rs/"
        exit 1
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi
    
    print_success "All prerequisites are installed!"
}

# Setup database
setup_database() {
    print_status "Setting up PostgreSQL database with sharding..."
    
    cd database
    
    # Stop any existing containers
    docker-compose down 2>/dev/null || true
    
    # Start database cluster
    docker-compose up -d
    
    # Wait for databases to be ready
    print_status "Waiting for databases to be ready..."
    sleep 30
    
    # Check if databases are healthy
    if docker-compose ps | grep -q "healthy"; then
        print_success "Database cluster is running and healthy!"
    else
        print_warning "Database containers are starting up. Check 'docker-compose logs' if issues persist."
    fi
    
    cd ..
}

# Setup backend environment
setup_backend() {
    print_status "Setting up Rust backend..."
    
    cd backend
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/votp_db

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)

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
EOF
        print_warning "Created .env file. Please update SMTP credentials before running the backend!"
    fi
    
    # Install dependencies
    print_status "Installing Rust dependencies..."
    cargo build
    
    print_success "Backend dependencies installed!"
    
    cd ..
}

# Display instructions
show_instructions() {
    echo
    echo "🎉 VOTP Platform Setup Complete!"
    echo "================================"
    echo
    echo "Next steps:"
    echo
    echo "1. 📧 Configure Email (Required for authentication):"
    echo "   - Edit backend/.env file"
    echo "   - Update SMTP_USERNAME and SMTP_PASSWORD"
    echo "   - For Gmail: Use App Passwords (not your regular password)"
    echo
    echo "2. 🚀 Start the Backend Server:"
    echo "   cd backend"
    echo "   cargo run"
    echo "   # Server will start at http://localhost:8000"
    echo
    echo "3. 🌐 Install Chrome Extension:"
    echo "   - Open Chrome and go to chrome://extensions/"
    echo "   - Enable 'Developer mode' (top right toggle)"
    echo "   - Click 'Load unpacked' and select the 'extension' folder"
    echo
    echo "4. 🧪 Test the Platform:"
    echo "   - Visit any website"
    echo "   - Click the VOTP extension icon"
    echo "   - Sign up with your email"
    echo "   - Start commenting!"
    echo
    echo "📖 Documentation:"
    echo "   - API Playground: http://localhost:8000/playground"
    echo "   - Database docs: database/README.md"
    echo "   - Deployment docs: deployment/kubernetes/README.md"
    echo
    echo "🔧 Development Commands:"
    echo "   - View database status: cd database && docker-compose ps"
    echo "   - View logs: cd database && docker-compose logs -f"
    echo "   - Connect to database: cd database && ./manage-db.sh connect"
    echo "   - Backend with auto-reload: cd backend && cargo watch -x run"
    echo
    echo "❓ Need Help?"
    echo "   - Check README.md for detailed documentation"
    echo "   - Review mvp.md for requirements"
    echo "   - Email: support@votp.com"
    echo
}

# Main setup process
main() {
    echo "Starting VOTP platform setup..."
    echo
    
    check_prerequisites
    echo
    
    setup_database
    echo
    
    setup_backend
    echo
    
    show_instructions
}

# Handle Ctrl+C
trap 'echo -e "\n${RED}Setup interrupted by user${NC}"; exit 1' INT

# Run main function
main

echo "✨ Setup script completed successfully!"
echo "Happy coding! 🎯"