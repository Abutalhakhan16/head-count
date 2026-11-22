#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================================="
echo "    Smart Classroom Analytics - Starting Full Stack"
echo "=========================================================="

# 1. Start Python FastAPI Backend
echo "1. Starting Python FastAPI YOLOv8 + Head Vision Backend on http://localhost:8000..."
cd "$DIR/backend"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

./venv/bin/python main.py &
BACKEND_PID=$!

cleanup() {
    echo ""
    echo "Stopping servers (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Backend started with PID $BACKEND_PID"
sleep 2

# 2. Start Frontend
echo "2. Starting React Vite Frontend on http://localhost:3000..."
cd "$DIR/frontend"
npm run dev
