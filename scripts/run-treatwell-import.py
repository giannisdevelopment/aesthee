#!/usr/bin/env python3
"""Run Treatwell SQL chunks against Supabase Postgres.

Usage:
  export DATABASE_URL='postgresql://postgres....:PASSWORD@....pooler.supabase.com:6543/postgres'
  python3 scripts/run-treatwell-import.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2


ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "supabase" / "treatwell-import"


def main() -> int:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("Set DATABASE_URL first (Supabase → Settings → Database → URI).")
        print("  export DATABASE_URL='postgresql://postgres....:PASSWORD@....pooler.supabase.com:6543/postgres'")
        print("  python3 scripts/run-treatwell-import.py")
        return 1

    files = sorted(DIR.glob("00-clients-*.sql"))
    files += [DIR / "01-extra-clients.sql"]
    files += sorted(DIR.glob("02-visits-*.sql"))
    files += sorted(DIR.glob("03-appts-*.sql"))
    files += [DIR / "99-summary.sql"]
    files = [f for f in files if f.exists()]

    if len(files) < 2:
        print(f"No chunk files in {DIR}")
        return 1

    # Prefer transaction-mode pooler port 6543; sslmode require
    connect_url = url
    if "sslmode=" not in connect_url:
        connect_url += ("&" if "?" in connect_url else "?") + "sslmode=require"

    print(f"Connecting… ({len(files)} files)")
    conn = psycopg2.connect(connect_url)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        for i, path in enumerate(files, 1):
            sql = path.read_text(encoding="utf-8")
            print(f"[{i}/{len(files)}] {path.name} ({path.stat().st_size // 1024} KB)")
            cur.execute(sql)
            # print last result set if any
            try:
                if cur.description:
                    rows = cur.fetchall()
                    if rows:
                        print("   →", rows[0])
            except psycopg2.ProgrammingError:
                pass
    finally:
        cur.close()
        conn.close()

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
