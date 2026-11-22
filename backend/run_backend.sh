#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Installing required packages..."
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install fastapi uvicorn python-multipart pydantic numpy opencv-python-headless
fi

echo "========================================================"
echo " Starting Smart Classroom Analytics Python FastAPI Server"
echo " Target API: http://localhost:8000"
echo " Docs:       http://localhost:8000/docs"
echo "========================================================"

exec ./venv/bin/python main.py
