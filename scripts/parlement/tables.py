"""Tables loaded by scripts/core/load_supabase.py --domain parlement, from data/build/parlement/<table>.json.

Order respects foreign keys; value = conflict target. Core tables (institutions, bodies, seats, persons, mandates,
terms, sources, media) for this domain's own rows, and parl_* tables only.
"""
TABLES = {}
