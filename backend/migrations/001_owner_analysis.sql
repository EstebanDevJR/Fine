-- Migration: add owner_id/s3_uri to datasets/models and create analysis table
-- Target: PostgreSQL
-- Note: for SQLite local dev, it is easier to recreate the DB file with these fields.

BEGIN;

ALTER TABLE dataset
    ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'dev_user';

ALTER TABLE dataset
    ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE dataset
    ADD COLUMN IF NOT EXISTS s3_uri TEXT;

ALTER TABLE modelartifact
    ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL DEFAULT 'dev_user';

ALTER TABLE modelartifact
    ALTER COLUMN owner_id DROP DEFAULT;

ALTER TABLE modelartifact
    ADD COLUMN IF NOT EXISTS s3_uri TEXT;

CREATE TABLE IF NOT EXISTS analysis (
    id SERIAL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    dataset_id INTEGER NOT NULL REFERENCES dataset(id),
    model_id INTEGER NOT NULL REFERENCES modelartifact(id),
    status TEXT NOT NULL,
    result_json TEXT,
    report_path TEXT,
    pdf_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_owner_created ON analysis(owner_id, created_at DESC);

COMMIT;

