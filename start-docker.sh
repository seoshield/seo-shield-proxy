#!/bin/bash

# SEO Shield Proxy - Docker Start Script

echo "🐳 SEO Shield Proxy - Docker Deployment"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "📦 Building and starting containers..."
echo ""

# Use docker compose (v2) or docker-compose (v1)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Stop and remove existing containers
$COMPOSE_CMD down

# Build and start containers
$COMPOSE_CMD up --build -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "📊 Service Status:"
$COMPOSE_CMD ps

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Access Points:"
echo "   Demo SPA:        http://localhost:3000"
echo "   SEO Proxy:       http://localhost:8080"
echo "   Admin Dashboard: http://localhost:8080/admin or http://localhost:3001"
echo ""
echo "🧪 Test Commands:"
echo "   Bot request:   curl -A \"Googlebot\" http://localhost:8080/"
echo "   Human request: curl http://localhost:8080/"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:      $COMPOSE_CMD logs -f"
echo "   Stop services:  $COMPOSE_CMD down"
echo "   Restart:        $COMPOSE_CMD restart"
echo ""
