#!/bin/bash

# AI Code Review Dashboard - Deployment Script
# This script helps deploy the application using Docker Compose

set -e

echo "🚀 AI Code Review Dashboard - Deployment Script"
echo "================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your configuration."
    echo "See README.md for required environment variables."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Ask for deployment action
echo "What would you like to do?"
echo "1) Build and start all services"
echo "2) Start existing services"
echo "3) Stop all services"
echo "4) View logs"
echo "5) Restart services"
echo "6) Remove all containers and volumes (WARNING: deletes data)"
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo "🔨 Building and starting all services..."
        docker-compose up -d --build
        echo "✅ Services started!"
        echo "Frontend: http://localhost"
        echo "Backend API: http://localhost:5000"
        echo ""
        echo "View logs with: docker-compose logs -f"
        ;;
    2)
        echo "▶️  Starting services..."
        docker-compose up -d
        echo "✅ Services started!"
        ;;
    3)
        echo "⏹️  Stopping services..."
        docker-compose down
        echo "✅ Services stopped!"
        ;;
    4)
        echo "📋 Viewing logs (Press Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    5)
        echo "🔄 Restarting services..."
        docker-compose restart
        echo "✅ Services restarted!"
        ;;
    6)
        read -p "⚠️  This will delete all data. Are you sure? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            echo "🗑️  Removing all containers and volumes..."
            docker-compose down -v
            echo "✅ All containers and volumes removed!"
        else
            echo "❌ Cancelled."
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
