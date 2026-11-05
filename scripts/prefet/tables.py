"""Tables loaded by scripts/core/load_supabase.py --domain prefet, from data/build/prefet/<table>.json.

Order respects foreign keys; value = conflict target of the upsert. Core tables (institutions, bodies, seats, persons,
mandates, sources) for this domain's own rows, and pref_* tables only.
"""
TABLES = {
    # core rows of this domain
    "sources": "id",
    "institutions": "id",
    "bodies": "id",
    "seats": "id",
    # postings (JORF decrees, scripts/prefet/postings.py)
    "persons": "id",
    "mandates": "person_id,seat_id,start_date",
    "pref_posting_events": "id",
    "pref_career_steps": "id",
    # préfet domain
    "pref_investment_grants": "id",
    "pref_dpt_credits": "id",
}
