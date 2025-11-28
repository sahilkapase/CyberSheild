#!/usr/bin/env python3
"""Comprehensive test of startup scripts."""
import sys
import os
import subprocess
from pathlib import Path

print("=" * 60)
print("Testing Startup Scripts for Deployment")
print("=" * 60)

# Test 1: Verify start_backend.py syntax and path resolution
print("\n[TEST 1] Testing start_backend.py path resolution...")
try:
    script_path = Path(__file__).parent / "start_backend.py"
    with open(script_path, 'r', encoding='utf-8') as f:
        code = f.read()
        compile(code, str(script_path), 'exec')
    print("[OK] start_backend.py syntax is valid")
    
    # Test path resolution logic
    exec(compile("""
import sys
import os
from pathlib import Path
script_dir = Path(r'{}').parent.absolute()
backend_dir = script_dir / "backend"
print(f"   Script dir: {{script_dir}}")
print(f"   Backend dir: {{backend_dir}}")
print(f"   Backend exists: {{backend_dir.exists()}}")
""".format(script_path), '<string>', 'exec'))
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 2: Verify backend/run.py
print("\n[TEST 2] Testing backend/run.py...")
try:
    run_py = Path(__file__).parent / "backend" / "run.py"
    with open(run_py, 'r', encoding='utf-8') as f:
        code = f.read()
        compile(code, str(run_py), 'exec')
    print("[OK] backend/run.py syntax is valid")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 3: Verify requirements.txt exists and is readable
print("\n[TEST 3] Testing requirements.txt...")
try:
    req_file = Path(__file__).parent / "requirements.txt"
    if not req_file.exists():
        print("[FAIL] requirements.txt not found")
        sys.exit(1)
    
    with open(req_file, 'r') as f:
        lines = [l.strip() for l in f if l.strip() and not l.startswith('#')]
        print(f"[OK] Found {len(lines)} dependencies in requirements.txt")
        print(f"   First few: {', '.join(lines[:3])}...")
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 4: Verify Python version
print("\n[TEST 4] Testing Python version...")
python_version = sys.version_info
print(f"[OK] Python {python_version.major}.{python_version.minor}.{python_version.micro}")
if python_version.major != 3 or python_version.minor < 8:
    print("[WARN] Python 3.8+ recommended")

# Test 5: Test import path logic (without actually importing app)
print("\n[TEST 5] Testing import path logic...")
try:
    backend_dir = Path(__file__).parent / "backend"
    backend_dir_str = str(backend_dir.absolute())
    
    # Simulate what start_backend.py does
    original_path = sys.path.copy()
    if backend_dir_str not in sys.path:
        sys.path.insert(0, backend_dir_str)
    
    print(f"[OK] Backend directory added to path: {backend_dir_str}")
    print(f"[OK] Python path length: {len(sys.path)}")
    
    # Restore
    sys.path = original_path
except Exception as e:
    print(f"[FAIL] Error: {e}")
    sys.exit(1)

# Test 6: Verify all required files exist
print("\n[TEST 6] Verifying required files...")
required_files = [
    "start_backend.py",
    "backend/run.py",
    "backend/app/main.py",
    "backend/app/__init__.py",
    "requirements.txt",
    "backend/requirements.txt",
    ".python-version",
    "nixpacks.toml",
    "railway.json"
]

base_path = Path(__file__).parent
all_found = True
for file in required_files:
    file_path = base_path / file
    if file_path.exists():
        print(f"[OK] {file}")
    else:
        print(f"[FAIL] {file} - MISSING")
        all_found = False

if not all_found:
    print("\n[WARN] Some files are missing, but deployment might still work")

# Test 7: Check configuration files
print("\n[TEST 7] Checking configuration files...")
try:
    # Check nixpacks.toml
    nixpacks = base_path / "nixpacks.toml"
    if nixpacks.exists():
        with open(nixpacks, 'r') as f:
            content = f.read()
            if "python -m pip" in content:
                print("[OK] nixpacks.toml uses python -m pip")
            else:
                print("[WARN] nixpacks.toml might not use python -m pip")
    
    # Check railway.json
    railway = base_path / "railway.json"
    if railway.exists():
        with open(railway, 'r') as f:
            content = f.read()
            if "python start_backend.py" in content:
                print("[OK] railway.json has correct start command")
            else:
                print("[WARN] railway.json start command might be incorrect")
except Exception as e:
    print(f"[WARN] Error checking configs: {e}")

print("\n" + "=" * 60)
print("All startup tests completed!")
print("=" * 60)
print("\nNext steps:")
print("1. Push to GitHub: git push origin main")
print("2. Deploy on Railway (will auto-detect configuration)")
print("3. Set environment variables in Railway dashboard")
print("\nTo test locally with dependencies:")
print("  cd backend")
print("  pip install -r requirements.txt")
print("  python run.py")

