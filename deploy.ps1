# AI Code Review Dashboard - Deployment Script (PowerShell)
# This script helps deploy the application using Docker Compose

Write-Host "🚀 AI Code Review Dashboard - Deployment Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-Not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your configuration."
    Write-Host "See README.md for required environment variables."
    exit 1
}

# Check if Docker is installed
try {
    docker --version | Out-Null
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Ask for deployment action
Write-Host "What would you like to do?"
Write-Host "1) Build and start all services"
Write-Host "2) Start existing services"
Write-Host "3) Stop all services"
Write-Host "4) View logs"
Write-Host "5) Restart services"
Write-Host "6) Remove all containers and volumes (WARNING: deletes data)"
$choice = Read-Host "Enter choice [1-6]"

switch ($choice) {
    "1" {
        Write-Host "🔨 Building and starting all services..." -ForegroundColor Yellow
        docker-compose up -d --build
        Write-Host "✅ Services started!" -ForegroundColor Green
        Write-Host "Frontend: http://localhost"
        Write-Host "Backend API: http://localhost:5000"
        Write-Host ""
        Write-Host "View logs with: docker-compose logs -f"
    }
    "2" {
        Write-Host "▶️  Starting services..." -ForegroundColor Yellow
        docker-compose up -d
        Write-Host "✅ Services started!" -ForegroundColor Green
    }
    "3" {
        Write-Host "⏹️  Stopping services..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "✅ Services stopped!" -ForegroundColor Green
    }
    "4" {
        Write-Host "📋 Viewing logs (Press Ctrl+C to exit)..." -ForegroundColor Yellow
        docker-compose logs -f
    }
    "5" {
        Write-Host "🔄 Restarting services..." -ForegroundColor Yellow
        docker-compose restart
        Write-Host "✅ Services restarted!" -ForegroundColor Green
    }
    "6" {
        $confirm = Read-Host "⚠️  This will delete all data. Are you sure? [y/N]"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Write-Host "🗑️  Removing all containers and volumes..." -ForegroundColor Yellow
            docker-compose down -v
            Write-Host "✅ All containers and volumes removed!" -ForegroundColor Green
        } else {
            Write-Host "❌ Cancelled." -ForegroundColor Red
        }
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}
