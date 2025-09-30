# VOTP Kubernetes Deployment Script (PowerShell)
# This script automates the deployment of VOTP to Kubernetes

param(
    [switch]$SkipBuild,
    [switch]$SkipConfig,
    [switch]$Help
)

# Configuration
$NAMESPACE = "votp"
$IMAGE_NAME = "votp-backend"
$IMAGE_TAG = "latest"
$DOMAIN = "api.votp.com"
$EMAIL = "admin@example.com"

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

function Write-Header {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

# Function to show help
function Show-Help {
    @"
Usage: .\deploy.ps1 [OPTIONS]

Options:
  -SkipBuild      Skip Docker image building
  -SkipConfig     Skip configuration collection
  -Help           Show this help message

Examples:
  .\deploy.ps1
  .\deploy.ps1 -SkipBuild
  .\deploy.ps1 -SkipConfig -SkipBuild
"@
}

# Function to check if kubectl is available
function Test-Kubectl {
    try {
        $null = kubectl version --client 2>$null
        $null = kubectl cluster-info 2>$null
        Write-Status "kubectl is configured and cluster is accessible"
        return $true
    }
    catch {
        Write-Error "kubectl is not installed, configured, or cluster is not accessible"
        return $false
    }
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Header "Checking prerequisites..."
    
    if (-not (Test-Kubectl)) {
        exit 1
    }
    
    # Check if docker is available
    try {
        $null = docker version 2>$null
        Write-Status "Docker is available"
    }
    catch {
        Write-Warning "Docker is not installed. You'll need to build the image separately."
    }
    
    # Check if ingress-nginx is installed
    try {
        $null = kubectl get namespace ingress-nginx 2>$null
        Write-Status "NGINX Ingress Controller appears to be installed"
    }
    catch {
        Write-Warning "ingress-nginx namespace not found. NGINX Ingress Controller might not be installed."
        $response = Read-Host "Do you want to install NGINX Ingress Controller? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Install-NginxIngress
        }
    }
    
    # Check if cert-manager is installed
    try {
        $null = kubectl get namespace cert-manager 2>$null
        Write-Status "cert-manager appears to be installed"
    }
    catch {
        Write-Warning "cert-manager namespace not found. cert-manager might not be installed."
        $response = Read-Host "Do you want to install cert-manager? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Install-CertManager
        }
    }
}

# Function to install NGINX Ingress Controller
function Install-NginxIngress {
    Write-Header "Installing NGINX Ingress Controller..."
    
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
    
    Write-Status "Waiting for NGINX Ingress Controller to be ready..."
    kubectl wait --namespace ingress-nginx `
        --for=condition=ready pod `
        --selector=app.kubernetes.io/component=controller `
        --timeout=300s
    
    Write-Status "NGINX Ingress Controller installed successfully"
}

# Function to install cert-manager
function Install-CertManager {
    Write-Header "Installing cert-manager..."
    
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    Write-Status "Waiting for cert-manager to be ready..."
    kubectl wait --namespace cert-manager `
        --for=condition=ready pod `
        --selector=app.kubernetes.io/name=cert-manager `
        --timeout=300s
    
    Write-Status "cert-manager installed successfully"
}

# Function to collect configuration
function Get-Configuration {
    Write-Header "Collecting configuration..."
    
    Write-Host "Please provide the following information:" -ForegroundColor Cyan
    
    $input = Read-Host "Docker registry/image name [$IMAGE_NAME]"
    if ($input) { $script:IMAGE_NAME = $input }
    
    $input = Read-Host "Image tag [$IMAGE_TAG]"
    if ($input) { $script:IMAGE_TAG = $input }
    
    $input = Read-Host "Domain name [$DOMAIN]"
    if ($input) { $script:DOMAIN = $input }
    
    $input = Read-Host "Email for Let's Encrypt [$EMAIL]"
    if ($input) { $script:EMAIL = $input }
    
    Write-Host ""
    Write-Status "Configuration collected:"
    Write-Status "  Image: $IMAGE_NAME`:$IMAGE_TAG"
    Write-Status "  Domain: $DOMAIN"
    Write-Status "  Email: $EMAIL"
    Write-Host ""
}

# Function to build Docker image
function Build-DockerImage {
    if ($SkipBuild) {
        Write-Status "Skipping Docker image build"
        return
    }
    
    Write-Header "Building Docker image..."
    
    try {
        $null = docker version 2>$null
    }
    catch {
        Write-Warning "Docker not available. Skipping image build."
        Write-Warning "Please build and push the image manually:"
        Write-Warning "  cd backend && docker build -t $IMAGE_NAME`:$IMAGE_TAG ."
        Write-Warning "  docker push $IMAGE_NAME`:$IMAGE_TAG"
        return
    }
    
    # Check if we're in the right directory
    if (-not (Test-Path "backend\Dockerfile")) {
        Write-Error "backend\Dockerfile not found. Please run this script from the project root."
        exit 1
    }
    
    Push-Location backend
    try {
        docker build -t "$IMAGE_NAME`:$IMAGE_TAG" .
        
        $response = Read-Host "Do you want to push the image to registry? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            docker push "$IMAGE_NAME`:$IMAGE_TAG"
            Write-Status "Image pushed successfully"
        }
        else {
            Write-Warning "Image not pushed. Make sure to push it before deploying."
        }
    }
    finally {
        Pop-Location
    }
}

# Function to update deployment manifest
function Update-Manifest {
    Write-Header "Updating deployment manifest..."
    
    # Read the original manifest
    $manifestContent = Get-Content "deployment\kubernetes\votp-deployment.yaml" -Raw
    
    # Update image name
    $manifestContent = $manifestContent -replace "image: votp-backend:latest", "image: $IMAGE_NAME`:$IMAGE_TAG"
    
    # Update domain
    $manifestContent = $manifestContent -replace "api\.votp\.com", $DOMAIN
    
    # Save to temporary file
    $manifestContent | Set-Content "deployment\kubernetes\votp-deployment.yaml.tmp"
    
    Write-Status "Manifest updated with your configuration"
}

# Function to create ClusterIssuer
function New-ClusterIssuer {
    Write-Header "Creating ClusterIssuer for Let's Encrypt..."
    
    $clusterIssuer = @"
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
"@
    
    $clusterIssuer | kubectl apply -f -
    
    Write-Status "ClusterIssuer created successfully"
}

# Function to generate random string
function New-RandomString {
    param([int]$Length = 32)
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $random = New-Object System.Random
    $result = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $result += $chars[$random.Next($chars.Length)]
    }
    return $result
}

# Function to generate secrets
function New-Secrets {
    Write-Header "Generating secure secrets..."
    
    # Generate random passwords
    $DB_PASSWORD = New-RandomString -Length 25
    $ADMIN_PASSWORD = New-RandomString -Length 25
    $REPL_PASSWORD = New-RandomString -Length 25
    $REDIS_PASSWORD = New-RandomString -Length 25
    $JWT_SECRET = New-RandomString -Length 64
    
    Write-Status "Secrets generated successfully"
    Write-Warning "Please save these passwords securely:"
    Write-Host "  Database Password: $DB_PASSWORD" -ForegroundColor Yellow
    Write-Host "  Admin Password: $ADMIN_PASSWORD" -ForegroundColor Yellow
    Write-Host "  Replication Password: $REPL_PASSWORD" -ForegroundColor Yellow
    Write-Host "  Redis Password: $REDIS_PASSWORD" -ForegroundColor Yellow
    Write-Host "  JWT Secret: $JWT_SECRET" -ForegroundColor Yellow
    Write-Host ""
    
    # Update the manifest with generated secrets
    $manifestContent = Get-Content "deployment\kubernetes\votp-deployment.yaml.tmp" -Raw
    $manifestContent = $manifestContent -replace "your-secure-database-password", $DB_PASSWORD
    $manifestContent = $manifestContent -replace "your-secure-admin-password", $ADMIN_PASSWORD
    $manifestContent = $manifestContent -replace "your-secure-replication-password", $REPL_PASSWORD
    $manifestContent = $manifestContent -replace "your-secure-redis-password", $REDIS_PASSWORD
    $manifestContent = $manifestContent -replace "your-super-secure-jwt-secret-key-change-in-production-min-32-chars", $JWT_SECRET
    
    # Prompt for SMTP credentials
    Write-Host "Please provide SMTP credentials for email functionality:" -ForegroundColor Cyan
    $SMTP_USERNAME = Read-Host "SMTP Username (email)"
    $SMTP_PASSWORD = Read-Host "SMTP Password (app password)" -AsSecureString
    $SMTP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SMTP_PASSWORD))
    
    $manifestContent = $manifestContent -replace "your-email@gmail\.com", $SMTP_USERNAME
    $manifestContent = $manifestContent -replace "your-app-password", $SMTP_PASSWORD
    
    # Save updated manifest
    $manifestContent | Set-Content "deployment\kubernetes\votp-deployment.yaml.tmp"
}

# Function to deploy to Kubernetes
function Start-Deployment {
    Write-Header "Deploying to Kubernetes..."
    
    # Apply the updated manifest
    kubectl apply -f "deployment\kubernetes\votp-deployment.yaml.tmp"
    
    Write-Status "Deployment manifest applied successfully"
    
    # Wait for deployments to be ready
    Write-Status "Waiting for deployments to be ready..."
    
    kubectl wait --for=condition=ready pod -l app=postgres-master -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=votp-backend -n $NAMESPACE --timeout=300s
    
    Write-Status "All deployments are ready!"
}

# Function to verify deployment
function Test-Deployment {
    Write-Header "Verifying deployment..."
    
    Write-Host "Checking pods:" -ForegroundColor Cyan
    kubectl get pods -n $NAMESPACE
    
    Write-Host ""
    Write-Host "Checking services:" -ForegroundColor Cyan
    kubectl get services -n $NAMESPACE
    
    Write-Host ""
    Write-Host "Checking ingress:" -ForegroundColor Cyan
    kubectl get ingress -n $NAMESPACE
    
    Write-Host ""
    Write-Host "Checking certificate:" -ForegroundColor Cyan
    kubectl get certificate -n $NAMESPACE
    
    Write-Host ""
    Write-Status "Deployment verification complete"
    
    # Test connectivity
    Write-Status "Testing connectivity..."
    
    # Port forward test
    $job = Start-Job -ScriptBlock {
        kubectl port-forward -n $using:NAMESPACE service/votp-backend-service 8080:8000
    }
    
    Start-Sleep -Seconds 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/playground" -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Status "✓ Backend is responding locally"
        }
    }
    catch {
        Write-Warning "✗ Backend is not responding locally"
    }
    finally {
        Stop-Job $job -Force
        Remove-Job $job -Force
    }
    
    Write-Host ""
    Write-Status "You can access the API at: https://$DOMAIN"
    Write-Status "GraphQL Playground: https://$DOMAIN/playground"
}

# Function to show next steps
function Show-NextSteps {
    Write-Header "Next Steps"
    
    @"

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
   - deployment\kubernetes\README.md
   - Project documentation

⚠️  Important reminders:
   - Save the generated passwords in a secure location
   - Monitor resource usage and adjust limits as needed
   - Set up regular backups for your data
   - Configure monitoring and alerting for production use

"@
}

# Function to clean up temporary files
function Remove-TempFiles {
    Write-Status "Cleaning up temporary files..."
    if (Test-Path "deployment\kubernetes\votp-deployment.yaml.tmp") {
        Remove-Item "deployment\kubernetes\votp-deployment.yaml.tmp" -Force
    }
}

# Main function
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║                    VOTP Kubernetes Deployment                ║
║                                                              ║
║  This script will deploy Voice of the People to Kubernetes  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Blue
    
    try {
        # Run deployment steps
        Test-Prerequisites
        
        if (-not $SkipConfig) {
            Get-Configuration
        }
        
        Build-DockerImage
        Update-Manifest
        New-Secrets
        New-ClusterIssuer
        Start-Deployment
        Test-Deployment
        Show-NextSteps
        
        Write-Status "Deployment completed successfully! 🚀"
    }
    finally {
        Remove-TempFiles
    }
}

# Run main function
Main