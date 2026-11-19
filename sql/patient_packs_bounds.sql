-- BrainCareDZ — Correctif BUG-06
-- Un pack ne peut pas avoir un nombre de séances nul/négatif, ni un reste
-- supérieur au total ou inférieur à zéro.
--
-- Idempotent.

BEGIN;

ALTER TABLE patient_packs DROP CONSTRAINT IF EXISTS patient_packs_total_sessions_check;
ALTER TABLE patient_packs
  ADD CONSTRAINT patient_packs_total_sessions_check CHECK (total_sessions > 0);

ALTER TABLE patient_packs DROP CONSTRAINT IF EXISTS patient_packs_remaining_check;
ALTER TABLE patient_packs
  ADD CONSTRAINT patient_packs_remaining_check
  CHECK (remaining_sessions >= 0 AND remaining_sessions <= total_sessions);

COMMIT;
