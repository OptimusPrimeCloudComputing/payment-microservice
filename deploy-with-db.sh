#!/bin/bash

# Deployment script for Payment Microservice to Google Cloud Run with Cloud SQL
# Usage: ./deploy-with-db.sh

set -e

echo "🚀 Payment Microservice - Cloud Run Deployment with Cloud SQL"
echo "================================================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not logged into gcloud"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No project set"
    echo "Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📦 Project: $PROJECT_ID"
echo ""

# Configuration
SERVICE_NAME="payment-microservice"
REGION="${REGION:-us-central1}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"

# Cloud SQL Configuration (from screenshot)
# Update these if your Cloud SQL instance is different
CLOUD_SQL_INSTANCE="ecommerce-app-473920:us-central1:payments-db"
DB_NAME="payments"
DB_USER="service"

echo "⚙️  Configuration:"
echo "  Service Name: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Max Instances: $MAX_INSTANCES"
echo "  Cloud SQL Instance: $CLOUD_SQL_INSTANCE"
echo ""

# Prompt for database password
echo "🔐 Database Configuration"
echo "Please enter the database password for user '$DB_USER':"
read -s DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: Database password cannot be empty"
    exit 1
fi

echo ""
echo "Password received (hidden)"
echo ""

# Prompt for confirmation
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Enable required services
echo "🔧 Enabling required Google Cloud services..."
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet
gcloud services enable sqladmin.googleapis.com --quiet

echo ""
echo "🏗️  Building and deploying to Cloud Run..."
echo ""

# Deploy to Cloud Run with Cloud SQL connection
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory $MEMORY \
  --cpu $CPU \
  --timeout 300 \
  --max-instances $MAX_INSTANCES \
  --add-cloudsql-instances $CLOUD_SQL_INSTANCE \
  --set-env-vars "INSTANCE_UNIX_SOCKET=/cloudsql/$CLOUD_SQL_INSTANCE" \
  --set-env-vars "DB_NAME=$DB_NAME" \
  --set-env-vars "DB_USER=$DB_USER" \
  --set-env-vars "DB_PASSWORD=$DB_PASSWORD" \
  --set-env-vars "AUTO_INIT_DB=true" \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo ""
echo "🌐 Service URL: $SERVICE_URL"
echo "📚 API Docs: $SERVICE_URL/api-docs"
echo "🏥 Health Check: $SERVICE_URL/health"
echo ""
echo "Test your API:"
echo "  # Health check"
echo "  curl $SERVICE_URL/health"
echo ""
echo "  # Create a payment"
echo "  curl -X POST $SERVICE_URL/payments/initiate \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"orderId\":\"test_001\",\"amount\":5000,\"currency\":\"USD\"}'"
echo ""
echo "View logs:"
echo "  gcloud run logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "View Cloud SQL connection:"
echo "  gcloud sql instances describe payments-db --project ecommerce-app-473920"
echo ""

