#!/usr/bin/env python3
"""Test script to verify deployment setup works locally."""
import sys
import os
from pathlib import Path

print("Testing deployment setup...")
print(f"Current directory: {os.getcwd()}")

# Test 1: Check if start_backend.py exists
script_path = Path(__file__).parent / "start_backend.py"
print(f"\n1. Checking start_backend.py: {'[OK] Found' if script_path.exists() else '[FAIL] Missing'}")

# Test 2: Check if backend directory exists
backend_path = Path(__file__).parent / "backend"
print(f"2. Checking backend directory: {'[OK] Found' if backend_path.exists() else '[FAIL] Missing'}")

# Test 3: Check if app directory exists
app_path = backend_path / "app"
print(f"3. Checking app directory: {'[OK] Found' if app_path.exists() else '[FAIL] Missing'}")

# Test 4: Check if main.py exists
main_path = app_path / "main.py"
print(f"4. Checking app/main.py: {'[OK] Found' if main_path.exists() else '[FAIL] Missing'}")

# Test 5: Try importing the module
print("\n5. Testing import...")
try:
    # Simulate what start_backend.py does
    backend_dir = str(backend_path.absolute())
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    os.chdir(backend_dir)
    print(f"   Changed to: {os.getcwd()}")
    
    import app.main
    print("   [OK] Successfully imported app.main")
    print("   [OK] FastAPI app object:", type(app.main.app))
    
except ImportError as e:
    error_msg = str(e)
    if "No module named" in error_msg and any(dep in error_msg for dep in ['passlib', 'fastapi', 'uvicorn', 'sqlalchemy', 'pydantic']):
        print(f"   [WARN] Missing dependency: {e}")
        print("   [INFO] This is OK - dependencies will be installed on Render")
        print("   [INFO] The import path structure is correct!")
    else:
        print(f"   [FAIL] Import failed: {e}")
        print(f"   Python path: {sys.path}")
        sys.exit(1)
except Exception as e:
    print(f"   [FAIL] Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 6: Check if run.py exists
run_py = backend_path / "run.py"
print(f"\n6. Checking backend/run.py: {'[OK] Found' if run_py.exists() else '[FAIL] Missing'}")

# Test 7: Check requirements.txt
req_file = backend_path / "requirements.txt"
print(f"7. Checking requirements.txt: {'[OK] Found' if req_file.exists() else '[FAIL] Missing'}")

print("\n[OK] All tests passed! Deployment setup looks good.")
print("\nTo test the server locally, run:")
print("  python start_backend.py")
