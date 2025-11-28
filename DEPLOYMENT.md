# Render Deployment Instructions

## ⚠️ CRITICAL: Update Start Command in Render Dashboard

**The error "ModuleNotFoundError: No module named 'app'" happens because Render is using the OLD start command.**

## Required Settings in Render Dashboard

1. Go to your Render service → **Settings** tab
2. **Root Directory**: Leave **EMPTY** (repo root) - DO NOT set to `backend`
3. **Build Command**: `cd backend && pip install -r requirements.txt`
4. **Start Command**: `python start_backend.py` ⚠️ **MUST BE THIS EXACTLY**
5. Click **Save Changes**
6. Click **Manual Deploy** → **Deploy latest commit**

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

