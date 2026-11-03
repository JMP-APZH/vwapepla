"""Tables loaded by scripts/core/load_supabase.py --domain ctm, from data/build/ctm/<table>.json.

Order respects foreign keys; value = conflict target. Core tables (institutions, bodies, seats, persons, mandates,
terms, sources, media) for this domain's own rows, and ctm_* tables only.
"""
TABLES = {}
