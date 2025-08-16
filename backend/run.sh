#!/bin/bash

# Run script for gradient removal backend

echo "Starting gradient removal API server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Running setup first..."
    ./setup.sh
fi

# Activate virtual environment
source venv/bin/activate

# Start the server
echo "Starting Flask server on http://localhost:5000"
python app.py