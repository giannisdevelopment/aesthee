#!/usr/bin/env python3
"""Parse Habitol / Google Calendar .ics → Aesthée appointments SQL.

Usage:
  python3 scripts/import-google-calendar.py ~/Downloads/thetanbar23@gmail.com.ics

Writes:
  supabase/import-habitol-calendar.sql
  (chunked under supabase/habitol-import/ if very large)
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo

    ATHENS = ZoneInfo("Europe/Athens")
except Exception:  # pragma: no cover
    ATHENS = timezone(timedelta(hours=3))

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "supabase" / "import-habitol-calendar.sql"
CHUNK_DIR = ROOT / "supabase" / "habitol-import"
CHUNK_SIZE = 800

PHONE_RE = re.compile(
    r"(?:\+30|0030)?[\s\-.]*(?:69\d[\s\-.]*){8}|"
    r"(?:\+30|0030)?[\s\-.]*(?:\d[\s\-.]*){10}"
)
# Only small amounts (1–5 digits) before € / ευρώ / (12ε) — never phone numbers
PRICE_RE = re.compile(
    r"\(?\s*(\d{1,5})\s*(?:€|ευρώ|ευρω|[EeΕε](?![a-zα-ω]))\.?\s*\)?",
    re.I,
)

SKIP_TITLE = re.compile(
    r"(έσοδα|εσοδα|έξοδα|εξοδα|εξόδα|"
    r"θα\s*φυγ|θα\s*φύγ|"
    r"\boff\b|0ff|ρεπ[οό]|αρρωστ|"
    r"ωρ[αά]ριο|κλειστ|"
    r"αλλαγη\s*(φιλτρ|νερα)|να\s*ενημερωσω|"
    r"σοσιαλ|social|"
    r"υδραυλικ|αφεντικ|"
    r"^βραβεια|"
    r"μαριλενα\s+\d)",
    re.I,
)

SERVICE_KW = re.compile(
    r"(σολ|sol\b|πρεσσο|presso|vacum|vacuum|bbl|"
    r"μ[άα]δερο|madero|endosphere|endospheres|morpheus|"
    r"μασ[αά]ζ|χαλαρωτικ|μυοχαλαρ|αθλητικ|"
    r"βλεφαριδ|φρυδι|μουστακ|αποτριχ|ριζικ|"
    r"laser|λειζερ|κρυολιπ|lemon\s*bottle|"
    r"υδρο|hydra|meso|hifu|rf\b|"
    r"συντηρ|τοποθετ|αξιολογ|"
    r"\d+\s*[hη]\s)",
    re.I,
)


def sql_str(s: str | None) -> str:
    if s is None or s == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def unfold_ics(text: str) -> str:
    return re.sub(r"\r?\n[ \t]", "", text)


def parse_ics_events(text: str) -> list[dict]:
    text = unfold_ics(text)
    blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", text, flags=re.S)
    events = []
    for block in blocks:
        fields: dict[str, str] = {}
        for line in block.splitlines():
            if ":" not in line:
                continue
            key, val = line.split(":", 1)
            base = key.split(";", 1)[0].upper()
            fields[base] = val.strip()
            fields[f"_{base}_params"] = key
        if "DTSTART" in fields and "SUMMARY" in fields:
            events.append(fields)
    return events


def parse_dt(raw: str) -> datetime | None:
    """Parse ICS datetime.

    Habitol / Outlook exports wall-clock Athens times with a trailing Z
    (fake UTC). Treat Z like local Europe/Athens — do NOT convert UTC→Athens.
    """
    raw = (raw or "").strip()
    if re.fullmatch(r"\d{8}", raw):
        return datetime.strptime(raw, "%Y%m%d").replace(tzinfo=ATHENS)
    m = re.fullmatch(r"(\d{8})T(\d{6})(Z?)", raw)
    if not m:
        return None
    dt = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
    # Z and floating both = Athens local wall clock for this export
    return dt.replace(tzinfo=ATHENS)


def extract_phone(text: str) -> str | None:
    compact = re.sub(r"[\s\-./()]", "", text)
    m = re.search(r"(?:\+30|0030)?(69\d{8})", compact)
    if not m:
        m = re.search(r"(?:\+30|0030)?(\d{10})", compact)
    if not m:
        return None
    digits = m.group(1)
    if len(digits) >= 10:
        return digits[-10:]
    return digits if len(digits) >= 8 else None


def strip_noise(title: str) -> str:
    t = PRICE_RE.sub("", title)
    t = re.sub(r"(?:\+30|0030)?[\s\-.]*(?:69\d[\s\-.]*){8}", "", t)
    t = re.sub(r"\s{2,}", " ", t).strip(" -–,()")
    return t


def guess_service_and_name(title: str) -> tuple[str, str]:
    clean = strip_noise(title)
    m = SERVICE_KW.search(clean)
    if m and m.start() >= 2:
        name = clean[: m.start()].strip(" -–,")
        service = clean[m.start() :].strip(" -–,")
        if len(name) >= 2 and len(service) >= 2:
            return name, service
    parts = clean.split()
    if len(parts) >= 3:
        return " ".join(parts[:2]), " ".join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1]
    return clean or "Walk-in", clean or "Ραντεβού"


def should_skip(title: str, description: str) -> bool:
    blob = f"{title}\n{description}"
    if SKIP_TITLE.search(title) or SKIP_TITLE.search(blob):
        return True
    # bare staff first-name shifts without price/phone
    if not extract_phone(blob) and not PRICE_RE.search(blob):
        if re.match(
            r"^\s*(μαριλενα|ευγενεια|ευγενια|βασια|χαρα|ελευθερια)\b",
            title,
            re.I,
        ):
            return True
    return False


def event_to_row(ev: dict) -> dict | None:
    title = ev.get("SUMMARY", "").strip()
    # Google escapes commas
    title = title.replace("\\,", ",").replace("\\n", " ").replace("\\;", ";")
    desc = (
        ev.get("DESCRIPTION", "")
        .replace("\\n", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .strip()
    )
    uid = ev.get("UID", "").strip()
    if should_skip(title, desc):
        return None

    start = parse_dt(ev.get("DTSTART", ""))
    end = parse_dt(ev.get("DTEND", "")) if ev.get("DTEND") else None
    if not start:
        return None

    # all-day (date-only or midnight span ≥ 1 day) without booking signals
    params = ev.get("_DTSTART_params", "")
    is_date_only = "VALUE=DATE" in params.upper() or (
        "T" not in ev.get("DTSTART", "")
    )
    if is_date_only:
        if not extract_phone(title + desc) and not PRICE_RE.search(title):
            return None

    if end and end > start:
        duration = int(round((end - start).total_seconds() / 60))
    else:
        duration = 60
    duration = max(5, min(240, duration))

    blob = f"{title}\n{desc}"
    phone = extract_phone(blob)
    price_m = PRICE_RE.search(blob)
    # skip pure till lines mis-detected
    if price_m and re.search(r"έσοδα|εσοδα|έξοδα|εξοδα", title, re.I):
        return None
    price_cents = None
    if price_m:
        euros = int(price_m.group(1))
        # guard: phones misread as prices (schema int max ~2.1e9)
        if 0 < euros <= 100_000:
            price_cents = euros * 100

    guest, service = guess_service_and_name(title)
    if len(guest) < 2:
        guest = "Walk-in"
    if len(service) < 2:
        service = title or "Ραντεβού"

    notes = f"Google Calendar · {title}"
    if uid:
        notes = f"{notes} · gcal:{uid}"

    return {
        "service": service[:200],
        "date": start.strftime("%Y-%m-%d"),
        "time": start.strftime("%H:%M:%S"),
        "duration": duration,
        "price_cents": price_cents,
        "guest_name": guest[:120],
        "guest_phone": phone or "00000000",
        "status": "confirmed",
        "notes": notes[:900],
        "uid": uid or f"{start.isoformat()}|{guest}|{service}",
    }


def staging_header() -> str:
    return """create table if not exists public._gcal_staging (
  service text not null,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes int not null,
  price_cents int,
  guest_name text not null,
  guest_phone text not null,
  status text not null,
  notes text,
  gcal_uid text
);

truncate table public._gcal_staging;
"""


def merge_sql() -> str:
    return r"""
create or replace function public._client_name_key(raw text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select string_agg(w, ' ' order by w)
      from unnest(
        string_to_array(
          regexp_replace(
            translate(
              lower(trim(coalesce(raw, ''))),
              'άέήίόύώϊΰΐϋὰὲὴὶὸὺὼᾶῆῖῦῶΆΈΉΊΌΎΏ',
              'αεηιουωιυιυαεηιουωαηιυωαεηιουω'
            ),
            '[^a-z0-9α-ω\s]',
            ' ',
            'g'
          ),
          ' '
        )
      ) as w
      where w <> ''
    ),
    ''
  );
$$;

-- Prefer real client phone when staging has placeholder
update public._gcal_staging s
set guest_phone = c.phone
from public.clients c
where (s.guest_phone is null or s.guest_phone like '000%')
  and c.phone is not null
  and c.phone not like '000%'
  and public._client_name_key(c.full_name) = public._client_name_key(s.guest_name);

insert into public.appointments (
  service, appointment_date, appointment_time, duration_minutes, price_cents,
  guest_name, guest_phone, guest_email, status, notes, client_id
)
select distinct on (s.appointment_date, s.appointment_time, public._client_name_key(s.guest_name), s.service)
  s.service,
  s.appointment_date,
  s.appointment_time,
  s.duration_minutes,
  s.price_cents,
  s.guest_name,
  coalesce(nullif(s.guest_phone, ''), '00000000'),
  null,
  'confirmed'::public.appointment_status,
  s.notes,
  c.id
from public._gcal_staging s
left join lateral (
  select id from public.clients c
  where (
    (c.phone is not null and c.phone not like '000%'
      and regexp_replace(c.phone, '\D', '', 'g')
        = regexp_replace(s.guest_phone, '\D', '', 'g'))
    or public._client_name_key(c.full_name) = public._client_name_key(s.guest_name)
  )
  order by
    case when c.phone is not null and c.phone not like '000%' then 0 else 1 end,
    c.updated_at desc nulls last
  limit 1
) c on true
where not exists (
  select 1 from public.appointments a
  where s.gcal_uid is not null
    and position(s.gcal_uid in coalesce(a.notes, '')) > 0
)
and not exists (
  select 1 from public.appointments a
  where a.appointment_date = s.appointment_date
    and a.appointment_time = s.appointment_time
    and public._client_name_key(a.guest_name) = public._client_name_key(s.guest_name)
)
order by s.appointment_date, s.appointment_time, public._client_name_key(s.guest_name), s.service;

select
  (select count(*) from public._gcal_staging) as staged,
  (select count(*) from public.appointments where notes ilike '%gcal:%') as appts_with_gcal_uid,
  (select count(*) from public.appointments) as total_appointments;
"""


def values_sql(rows: list[dict]) -> str:
    vals = []
    for r in rows:
        vals.append(
            "  ("
            f"{sql_str(r['service'])}, "
            f"'{r['date']}', "
            f"'{r['time']}', "
            f"{r['duration']}, "
            f"{r['price_cents'] if r['price_cents'] is not None else 'NULL'}, "
            f"{sql_str(r['guest_name'])}, "
            f"{sql_str(r['guest_phone'])}, "
            f"{sql_str(r['status'])}, "
            f"{sql_str(r['notes'])}, "
            f"{sql_str(r['uid'])}"
            ")"
        )
    return (
        "insert into public._gcal_staging "
        "(service, appointment_date, appointment_time, duration_minutes, price_cents, "
        "guest_name, guest_phone, status, notes, gcal_uid) values\n"
        + ",\n".join(vals)
        + ";\n"
    )


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import-google-calendar.py path/to/calendar.ics")
        return 2
    ics_path = Path(sys.argv[1]).expanduser()
    if not ics_path.exists():
        print(f"Missing file: {ics_path}")
        return 1

    print(f"Reading {ics_path} …")
    events = parse_ics_events(ics_path.read_text(encoding="utf-8", errors="replace"))
    print(f"VEVENT blocks: {len(events)}")

    rows: list[dict] = []
    skipped = 0
    for ev in events:
        row = event_to_row(ev)
        if row is None:
            skipped += 1
            continue
        rows.append(row)

    seen: set[str] = set()
    unique: list[dict] = []
    for r in rows:
        key = r["uid"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)

    print(f"Candidates: {len(unique)} · skipped: {skipped}")

    header = [
        "-- Habitol / Google Calendar → Aesthée appointments",
        f"-- Source: {ics_path.name}",
        f"-- Events: {len(unique)} (skipped {skipped})",
        "-- Run ORDER in Supabase SQL Editor:",
        "--   1) This file (or 00-setup.sql + each 01-chunk-*.sql + 99-merge.sql)",
        "-- Safe to re-run: skips gcal:UID already in appointment notes.",
        "",
        staging_header(),
    ]

    if len(unique) <= CHUNK_SIZE:
        body = values_sql(unique) + "\n" + merge_sql()
        OUT.write_text("\n".join(header) + "\n" + body)
        print(f"Wrote single file {OUT} ({OUT.stat().st_size:,} bytes)")
        return 0

    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    for old in CHUNK_DIR.glob("*.sql"):
        old.unlink()

    setup = CHUNK_DIR / "00-setup.sql"
    setup.write_text(
        "\n".join(header)
        + "\n-- Next: run 01-chunk-*.sql in order, then 99-merge.sql\n"
    )

    for i in range(0, len(unique), CHUNK_SIZE):
        chunk = unique[i : i + CHUNK_SIZE]
        n = i // CHUNK_SIZE + 1
        path = CHUNK_DIR / f"01-chunk-{n:02d}.sql"
        path.write_text(
            f"-- Habitol chunk {n} · rows {i + 1}–{i + len(chunk)}\n"
            + values_sql(chunk)
        )
        print(f"  {path.name}: {len(chunk)} rows")

    merge = CHUNK_DIR / "99-merge.sql"
    merge.write_text("-- Habitol merge into appointments\n" + merge_sql())

    # convenience pointer
    OUT.write_text(
        "\n".join(
            [
                "-- Habitol calendar import is chunked (file too large for one paste).",
                f"-- Folder: supabase/habitol-import/  ({len(unique)} events)",
                "-- Run in Supabase SQL Editor, in order:",
                "--   1) 00-setup.sql",
                f"--   2) 01-chunk-01.sql … 01-chunk-{(len(unique) - 1) // CHUNK_SIZE + 1:02d}.sql",
                "--   3) 99-merge.sql",
                "",
            ]
        )
    )
    print(f"Chunked into {CHUNK_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
