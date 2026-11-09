"""Tables loaded by scripts/core/load_supabase.py --domain parlement, from data/build/parlement/<table>.json.

Order respects foreign keys; value = conflict target. Core tables (institutions, bodies, seats, persons, mandates,
sources, media) for this domain's own rows, and parl_* tables only (migration 20261107120000_parl_init.sql).
"""
TABLES = {
    # core rows of this domain (scripts/parlement/build.py)
    "sources": "id",
    "institutions": "id",
    "bodies": "id",
    "seats": "id",
    "persons": "id",
    "mandates": "person_id,seat_id,start_date",
    # parl_ tables
    "parl_mandate_details": "id",
    "parl_organes": "id",
    "parl_memberships": "id",
    "parl_texts": "id",
    "parl_scrutins": "id",
    "parl_votes": "scrutin_id,person_id",
    "parl_amendments": "id",
    "parl_questions": "id",
    "parl_interest_declarations": "id",
    "parl_interest_items": "id",
    "parl_data_gaps": "id",
    # core: same person in another domain, reviewed (migration 20261109180000_core_person_links.sql)
    "person_links": "person_id,same_as",
    # official portraits: python -I scripts/core/media.py --domain parlement [--upload]
    "media": "id",
}
