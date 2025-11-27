#!/bin/bash

# SEO Shield Proxy - Quick Start Script
# This script starts all three services in separate terminal sessions

echo "🛡️  SEO Shield Proxy - Quick Start"
echo "===================================="
echo ""

# Check if dependencies are installed
echo "📦 Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo "Installing main proxy dependencies..."
    npm install
fi

if [ ! -d "admin-dashboard/node_modules" ]; then
    echo "Installing admin dashboard dependencies..."
    cd admin-dashboard && npm install && cd ..
fi

if [ ! -d "demo-spa/node_modules" ]; then
    echo "Installing demo SPA dependencies..."
    cd demo-spa && npm install && cd ..
fi

echo ""
echo "✅ All dependencies installed!"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "TARGET_URL=http://localhost:3000" >> .env
    echo "✅ .env file created. Please review the settings."
fi

echo ""
echo "🚀 Starting services..."
echo ""
echo "This will open 3 terminal windows:"
echo "  1. Demo SPA (Port 3000)"
echo "  2. SEO Shield Proxy (Port 8080)"
echo "  3. Admin Dashboard (Port 3001)"
echo ""

# Function to start in new terminal based on OS
start_service() {
    local name=$1
    local command=$2

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell app \"Terminal\" to do script \"cd '$PWD' && echo '🚀 Starting $name...' && $command\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux with gnome-terminal
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "cd '$PWD' && echo '🚀 Starting $name...' && $command; exec bash"
        # Linux with xterm
        elif command -v xterm &> /dev/null; then
            xterm -e "cd '$PWD' && echo '🚀 Starting $name...' && $command; bash" &
        else
            echo "⚠️  Could not find terminal emulator. Please run manually:"
            echo "   $command"
        fi
    else
        echo "⚠️  Unsupported OS. Please run manually:"
        echo "   $command"
    fi
}

# Start services
start_service "Demo SPA" "cd demo-spa && npm run dev"
sleep 2
start_service "SEO Proxy" "npm start"
sleep 2
start_service "Admin Dashboard" "cd admin-dashboard && npm run dev"

echo ""
echo "✅ Services started!"
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
echo "Press Ctrl+C in each terminal to stop the services."
