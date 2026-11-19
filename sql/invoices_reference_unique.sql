-- BrainCareDZ — Correctif BUG-08
-- Une référence de facture ne peut être ni vide ni dupliquée.
--
-- Idempotent.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_reference_unique
  ON invoices (lower(btrim(reference)))
  WHERE btrim(reference) <> '';

COMMIT;
