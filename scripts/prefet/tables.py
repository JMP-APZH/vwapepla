"""Tables loaded by scripts/core/load_supabase.py --domain prefet, from data/build/prefet/<table>.json.

Order respects foreign keys; value = conflict target. Core tables (institutions, bodies, seats, persons, mandates,
terms, sources, media) for this domain's own rows, and pref_* tables only.
"""
TABLES = {}
