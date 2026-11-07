"""Tables loaded by scripts/core/load_supabase.py --domain ctm, from data/build/ctm/<table>.json.

Order respects foreign keys; value = conflict target of the upsert. Core tables (sources, institutions, bodies, seats,
terms, persons, mandates) for the CTM's own rows, and ctm_* tables only. The ctm_* tables come from migration
<ts>_ctm_people_budget.sql (to apply after JM's review).
"""
TABLES = {
    # core rows of this domain
    "sources": "id",
    "institutions": "id",
    "bodies": "id",
    "seats": "id",
    "terms": "id",
    "persons": "id",
    "mandates": "person_id,seat_id,start_date",
    # ctm domain
    "ctm_metric_definitions": "key",
    "ctm_actuals": "entity_siren,year,metric_key",
    "ctm_electoral_lists": "id",
    "ctm_list_members": "id",
    "ctm_section_members": "person_id,term_id",
    "ctm_functional_actuals": "year,section,fonction",  # migration <ts>_ctm_functions_acts.sql
    "ctm_acts": "id",
    "ctm_ca_lines": "year,budget,line_key",  # migration <ts>_ctm_ca_lines.sql
}
