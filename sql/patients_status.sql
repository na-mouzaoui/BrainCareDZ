-- BrainCareDZ — Correctif BUG-07
-- Rétablit la colonne `patients.status` (supprimée par erreur) pour que le
-- sélecteur « Statut patient » du compte rendu soit réellement persisté.
--
-- Idempotent. Les dossiers existants restent à NULL (= statut non renseigné) :
-- on ne les marque pas artificiellement « En cours ».

BEGIN;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS status varchar(20);

ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_status_check;
ALTER TABLE patients
  ADD CONSTRAINT patients_status_check
  CHECK (status IS NULL OR status IN ('En cours', 'Terminé', 'Abandon'));

COMMIT;
