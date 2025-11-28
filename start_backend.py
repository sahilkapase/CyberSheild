#!/usr/bin/env python3
"""Root-level entry point that works from anywhere."""
import sys
import os
from pathlib import Path

# Find the backend directory relative to this script
script_dir = Path(__file__).parent.absolute()
backend_dir = script_dir / "backend"

# Change to backend directory
os.chdir(str(backend_dir))

# Add backend to Python path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Verify we can import app
try:
    import app.main
    print(f"✓ Successfully imported app.main")
    print(f"✓ Working directory: {os.getcwd()}")
except ImportError as e:
    print(f"✗ Failed to import app.main: {e}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Backend directory: {backend_dir}")
    print(f"Python path: {sys.path}")
    sys.exit(1)

# Run uvicorn
import uvicorn
port = int(os.environ.get("PORT", 10000))
print(f"Starting server on port {port}")
uvicorn.run("app.main:app", host="0.0.0.0", port=port)

