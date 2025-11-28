# Render Deployment Instructions

## Critical Settings in Render Dashboard

1. **Root Directory**: Leave empty (use repo root) OR set to `backend`
2. **Build Command**: `cd backend && pip install -r requirements.txt`
3. **Start Command**: `python start_backend.py`

## Environment Variables

Make sure these are set in Render Dashboard → Environment:
- `GROQ_API_KEY`
- `HF_TOKEN`
- `SECRET_KEY`
- `PORT` (automatically set by Render)

## Alternative Start Commands

If `python start_backend.py` doesn't work, try:
- `cd backend && python run.py`
- `bash start_backend.sh`

## Troubleshooting

If you see "ModuleNotFoundError: No module named 'app'":
1. Check that Root Directory is either empty or set to `backend`
2. Verify Start Command is `python start_backend.py`
3. Check build logs to ensure dependencies installed correctly

