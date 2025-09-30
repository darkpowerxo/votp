#!/bin/bash

# VOTP Kubernetes Deployment Script
# This script automates the deployment of VOTP to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="votp"
IMAGE_NAME="votp-backend"
IMAGE_TAG="latest"
DOMAIN="api.votp.com"
EMAIL="admin@example.com"

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

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    print_status "kubectl is configured and cluster is accessible"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_header "Checking prerequisites..."
    
    check_kubectl
    
    # Check if docker is available for building
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. You'll need to build the image separately."
    else
        print_status "Docker is available"
    fi
    
    # Check if ingress-nginx is installed
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        print_warning "ingress-nginx namespace not found. NGINX Ingress Controller might not be installed."
        read -p "Do you want to install NGINX Ingress Controller? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_nginx_ingress
        fi
    else
        print_status "NGINX Ingress Controller appears to be installed"
    fi
    
    # Check if cert-manager is installed
    if ! kubectl get namespace cert-manager &> /dev/null; then
        print_warning "cert-manager namespace not found. cert-manager might not be installed."
        read -p "Do you want to install cert-manager? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_cert_manager
        fi
    else
        print_status "cert-manager appears to be installed"
    fi
}

# Function to install NGINX Ingress Controller
install_nginx_ingress() {
    print_header "Installing NGINX Ingress Controller..."
    
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
    
    print_status "Waiting for NGINX Ingress Controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s
    
    print_status "NGINX Ingress Controller installed successfully"
}

# Function to install cert-manager
install_cert_manager() {
    print_header "Installing cert-manager..."
    
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    print_status "Waiting for cert-manager to be ready..."
    kubectl wait --namespace cert-manager \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/name=cert-manager \
        --timeout=300s
    
    print_status "cert-manager installed successfully"
}

# Function to collect configuration
collect_config() {
    print_header "Collecting configuration..."
    
    echo "Please provide the following information:"
    
    read -p "Docker registry/image name [$IMAGE_NAME]: " input
    IMAGE_NAME=${input:-$IMAGE_NAME}
    
    read -p "Image tag [$IMAGE_TAG]: " input
    IMAGE_TAG=${input:-$IMAGE_TAG}
    
    read -p "Domain name [$DOMAIN]: " input
    DOMAIN=${input:-$DOMAIN}
    
    read -p "Email for Let's Encrypt [$EMAIL]: " input
    EMAIL=${input:-$EMAIL}
    
    echo
    print_status "Configuration collected:"
    print_status "  Image: $IMAGE_NAME:$IMAGE_TAG"
    print_status "  Domain: $DOMAIN"
    print_status "  Email: $EMAIL"
    echo
}

# Function to build and push Docker image
build_image() {
    if [[ "$1" == "--skip-build" ]]; then
        print_status "Skipping Docker image build"
        return
    fi
    
    print_header "Building Docker image..."
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not available. Skipping image build."
        print_warning "Please build and push the image manually:"
        print_warning "  cd backend && docker build -t $IMAGE_NAME:$IMAGE_TAG ."
        print_warning "  docker push $IMAGE_NAME:$IMAGE_TAG"
        return
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "backend/Dockerfile" ]]; then
        print_error "backend/Dockerfile not found. Please run this script from the project root."
        exit 1
    fi
    
    cd backend
    docker build -t $IMAGE_NAME:$IMAGE_TAG .
    
    read -p "Do you want to push the image to registry? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker push $IMAGE_NAME:$IMAGE_TAG
        print_status "Image pushed successfully"
    else
        print_warning "Image not pushed. Make sure to push it before deploying."
    fi
    
    cd ..
}

# Function to update deployment manifest
update_manifest() {
    print_header "Updating deployment manifest..."
    
    # Create a temporary copy of the manifest
    cp deployment/kubernetes/votp-deployment.yaml deployment/kubernetes/votp-deployment.yaml.tmp
    
    # Update image name
    sed -i.bak "s|image: votp-backend:latest|image: $IMAGE_NAME:$IMAGE_TAG|g" deployment/kubernetes/votp-deployment.yaml.tmp
    
    # Update domain
    sed -i.bak "s|api.votp.com|$DOMAIN|g" deployment/kubernetes/votp-deployment.yaml.tmp
    
    print_status "Manifest updated with your configuration"
}

# Function to create ClusterIssuer
create_cluster_issuer() {
    print_header "Creating ClusterIssuer for Let's Encrypt..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $EMAIL
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    print_status "ClusterIssuer created successfully"
}

# Function to generate secrets
generate_secrets() {
    print_header "Generating secure secrets..."
    
    # Generate random passwords
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    REPL_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
    
    print_status "Secrets generated successfully"
    print_warning "Please save these passwords securely:"
    echo "  Database Password: $DB_PASSWORD"
    echo "  Admin Password: $ADMIN_PASSWORD"
    echo "  Replication Password: $REPL_PASSWORD"
    echo "  Redis Password: $REDIS_PASSWORD"
    echo "  JWT Secret: $JWT_SECRET"
    echo
    
    # Update the manifest with generated secrets
    sed -i.bak "s|your-secure-database-password|$DB_PASSWORD|g" deployment/kubernetes/votp-deployment.yaml.tmp
    sed -i.bak "s|your-secure-admin-password|$ADMIN_PASSWORD|g" deployment/kubernetes/votp-deployment.yaml.tmp
    sed -i.bak "s|your-secure-replication-password|$REPL_PASSWORD|g" deployment/kubernetes/votp-deployment.yaml.tmp
    sed -i.bak "s|your-secure-redis-password|$REDIS_PASSWORD|g" deployment/kubernetes/votp-deployment.yaml.tmp
    sed -i.bak "s|your-super-secure-jwt-secret-key-change-in-production-min-32-chars|$JWT_SECRET|g" deployment/kubernetes/votp-deployment.yaml.tmp
    
    # Prompt for SMTP credentials
    echo "Please provide SMTP credentials for email functionality:"
    read -p "SMTP Username (email): " SMTP_USERNAME
    read -s -p "SMTP Password (app password): " SMTP_PASSWORD
    echo
    
    sed -i.bak "s|your-email@gmail.com|$SMTP_USERNAME|g" deployment/kubernetes/votp-deployment.yaml.tmp
    sed -i.bak "s|your-app-password|$SMTP_PASSWORD|g" deployment/kubernetes/votp-deployment.yaml.tmp
}

# Function to deploy to Kubernetes
deploy() {
    print_header "Deploying to Kubernetes..."
    
    # Apply the updated manifest
    kubectl apply -f deployment/kubernetes/votp-deployment.yaml.tmp
    
    print_status "Deployment manifest applied successfully"
    
    # Wait for deployments to be ready
    print_status "Waiting for deployments to be ready..."
    
    kubectl wait --for=condition=ready pod -l app=postgres-master -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=votp-backend -n $NAMESPACE --timeout=300s
    
    print_status "All deployments are ready!"
}

# Function to verify deployment
verify_deployment() {
    print_header "Verifying deployment..."
    
    echo "Checking pods:"
    kubectl get pods -n $NAMESPACE
    
    echo
    echo "Checking services:"
    kubectl get services -n $NAMESPACE
    
    echo
    echo "Checking ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo
    echo "Checking certificate:"
    kubectl get certificate -n $NAMESPACE
    
    echo
    print_status "Deployment verification complete"
    
    # Test connectivity
    print_status "Testing connectivity..."
    
    # Port forward test
    kubectl port-forward -n $NAMESPACE service/votp-backend-service 8080:8000 &
    PORT_FORWARD_PID=$!
    
    sleep 5
    
    if curl -s http://localhost:8080/playground > /dev/null; then
        print_status "✓ Backend is responding locally"
    else
        print_warning "✗ Backend is not responding locally"
    fi
    
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    echo
    print_status "You can access the API at: https://$DOMAIN"
    print_status "GraphQL Playground: https://$DOMAIN/playground"
}

# Function to show next steps
show_next_steps() {
    print_header "Next Steps"
    
    cat <<EOF

🎉 VOTP has been successfully deployed to Kubernetes!

📋 What you can do now:

1. 📊 Monitor the deployment:
   kubectl get pods -n $NAMESPACE -w

2. 📝 View logs:
   kubectl logs -n $NAMESPACE -l app=votp-backend -f

3. 🔍 Access the API:
   - GraphQL Playground: https://$DOMAIN/playground
   - API Endpoint: https://$DOMAIN/api

4. 🛠️ Troubleshoot if needed:
   kubectl describe pods -n $NAMESPACE

5. 📈 Check auto-scaling:
   kubectl get hpa -n $NAMESPACE

6. 🔐 Manage secrets:
   kubectl get secret votp-secrets -n $NAMESPACE -o yaml

📚 For more information, see:
   - deployment/kubernetes/README.md
   - Project documentation

⚠️  Important reminders:
   - Save the generated passwords in a secure location
   - Monitor resource usage and adjust limits as needed
   - Set up regular backups for your data
   - Configure monitoring and alerting for production use

EOF
}

# Function to clean up temporary files
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -f deployment/kubernetes/votp-deployment.yaml.tmp
    rm -f deployment/kubernetes/votp-deployment.yaml.tmp.bak
}

# Main deployment function
main() {
    echo -e "${BLUE}"
    cat <<EOF
╔══════════════════════════════════════════════════════════════╗
║                    VOTP Kubernetes Deployment                ║
║                                                              ║
║  This script will deploy Voice of the People to Kubernetes  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    # Parse command line arguments
    SKIP_BUILD=false
    SKIP_CONFIG=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-config)
                SKIP_CONFIG=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build    Skip Docker image building"
                echo "  --skip-config   Skip configuration collection"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Trap to cleanup on exit
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    
    if [[ "$SKIP_CONFIG" != true ]]; then
        collect_config
    fi
    
    if [[ "$SKIP_BUILD" != true ]]; then
        build_image
    fi
    
    update_manifest
    generate_secrets
    create_cluster_issuer
    deploy
    verify_deployment
    show_next_steps
    
    print_status "Deployment completed successfully! 🚀"
}

# Run main function
main "$@"