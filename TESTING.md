# Local Testing Guide

## Quick Test

Run the comprehensive test suite:
```bash
python test_startup.py
python test_script_logic.py
python test_deployment.py
```

## What Gets Tested

1. **File Structure** - All required files exist
2. **Script Syntax** - Python scripts compile without errors
3. **Path Resolution** - Scripts can find backend directory
4. **Import Logic** - Python path setup works correctly
5. **Configuration** - Railway/Nixpacks configs are correct

## Testing the Server Locally

If you want to actually run the server locally:

1. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Set environment variables (create `.env` file in `backend/`):
   ```
   GROQ_API_KEY=your_key_here
   HF_TOKEN=your_token_here
   SECRET_KEY=your_secret_here
   ```

3. Run the server:
   ```bash
   # From root directory
   python start_backend.py
   
   # OR from backend directory
   cd backend
   python run.py
   ```

## Expected Results

All tests should pass with `[OK]` status. If you see `[WARN]` about missing dependencies, that's normal - they'll be installed on Railway.

## Deployment Readiness

✅ All files present
✅ Scripts syntactically correct
✅ Path resolution works
✅ Configuration files correct
✅ Ready for Railway deployment

