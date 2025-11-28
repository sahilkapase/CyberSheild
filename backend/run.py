#!/usr/bin/env python3
"""Entry point for Render deployment."""
import sys
import os

# Get the directory where this script is located (backend directory)
backend_dir = os.path.dirname(os.path.abspath(__file__))

# Change working directory to backend directory
os.chdir(backend_dir)

# Add backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Verify app module can be imported
try:
    import app.main
    print(f"✓ Successfully imported app.main from {backend_dir}")
except ImportError as e:
    print(f"✗ Failed to import app.main: {e}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    raise

# Now import and run uvicorn
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    print(f"Starting server on port {port} from directory: {os.getcwd()}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

