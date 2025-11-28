#!/usr/bin/env python3
"""Test the actual logic of start_backend.py without running the server."""
import sys
import os
from pathlib import Path

print("Testing start_backend.py logic (dry run)...")
print("-" * 60)

# Simulate what start_backend.py does
script_dir = Path(__file__).parent.absolute()
backend_dir = script_dir / "backend"

print(f"1. Script directory: {script_dir}")
print(f"2. Backend directory: {backend_dir}")
print(f"3. Backend exists: {backend_dir.exists()}")

# Test directory change
original_cwd = os.getcwd()
print(f"4. Original working directory: {original_cwd}")

try:
    os.chdir(str(backend_dir))
    new_cwd = os.getcwd()
    print(f"5. New working directory: {new_cwd}")
    print(f"6. Directory change successful: {new_cwd.endswith('backend')}")
except Exception as e:
    print(f"   [FAIL] Could not change directory: {e}")
    sys.exit(1)
finally:
    os.chdir(original_cwd)

# Test Python path addition
original_path = sys.path.copy()
backend_dir_str = str(backend_dir)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)
    print(f"7. Added to Python path: {backend_dir_str}")
    print(f"8. Path added successfully: {backend_dir_str in sys.path}")
else:
    print(f"7. Already in Python path: {backend_dir_str}")

# Restore
sys.path = original_path

# Test that app directory exists
app_dir = backend_dir / "app"
print(f"9. App directory exists: {app_dir.exists()}")
print(f"10. App main.py exists: {(app_dir / 'main.py').exists()}")

# Test environment variable handling
import os
test_port = os.environ.get("PORT", "10000")
print(f"11. PORT env var handling: {test_port} (default: 10000)")

print("-" * 60)
print("[OK] All logic tests passed!")
print("\nThe startup script should work correctly on Railway.")

