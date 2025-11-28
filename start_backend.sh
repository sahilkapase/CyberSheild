#!/bin/bash
# Root-level startup script for Render
# This ensures we're always in the backend directory

cd "$(dirname "$0")/backend" || exit 1
export PYTHONPATH="$(pwd):$PYTHONPATH"
python run.py

