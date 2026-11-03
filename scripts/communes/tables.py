"""Tables loaded by scripts/core/load_supabase.py --domain communes, from data/build/communes/<table>.json.

Order respects foreign keys. Value = conflict target of the upsert (primary or natural key).
A domain may write core tables (no prefix) for its own rows, and only its own prefixed tables (com_).
"""
TABLES = {
    # core rows of this domain
    "sources": "id",
    "institutions": "id",
    "bodies": "id",
    "seats": "id",
    "persons": "id",
    "terms": "id",
    "mandates": "person_id,seat_id,start_date",
    # commune domain
    "com_communes": "code",
    "media": "id",  # references com_communes (commune_code) until the compatibility views are dropped
    "com_audit_criteria": "key",
    "com_site_audits": "id",
    "com_site_audit_items": "audit_id,criterion_key",
    "com_commune_years": "commune_code,year",
    "com_metric_definitions": "key",
    "com_actuals": "commune_code,year,metric_key",
    "com_entities": "siren",
    "com_entity_actuals": "siren,year,agregat",
    "com_forecast_documents": "id",
    "com_forecast_figures": "document_id,metric_key",
}
