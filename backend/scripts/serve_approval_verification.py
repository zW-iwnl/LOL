"""Serve the isolated rehearsal DB for browser tests; never changes live config."""
import argparse
import os

from sqlalchemy.engine import make_url

from app.core.config import settings


parser = argparse.ArgumentParser()
parser.add_argument("--database", required=True)
args = parser.parse_args()
live = make_url(settings.database_url)
if not args.database.startswith("approval_verify_") or args.database == live.database:
    raise SystemExit("Isolated approval_verify_ database required")
env = {**os.environ, "DATABASE_URL": live.set(database=args.database).render_as_string(hide_password=False)}
os.execvpe("uvicorn", ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"], env)
