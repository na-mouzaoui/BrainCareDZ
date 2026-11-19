-- BrainCareDZ — Correctif BUG-15
-- Unicité du nom des services (packs) actifs + recherche de similarité.
--
-- Idempotent.

BEGIN;

-- Recherche "floue" par trigrammes (similarity / opérateur %)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Unicité du nom parmi les services ACTIFS (casse et espaces ignorés)
CREATE UNIQUE INDEX IF NOT EXISTS services_name_active_unique
  ON services (lower(btrim(name)))
  WHERE is_active;

COMMIT;
