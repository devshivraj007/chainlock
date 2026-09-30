"""
Vercel serverless entry point for ForensicDVR FastAPI backend.
Vercel's @vercel/python runtime expects the ASGI `app` object here.
"""

import sys
import os

# Make sure the root of the repo is on the path so we can import backend.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import app  # re-export the FastAPI app
