-- BrainCareDZ — Correctif BUG-02
-- Trigger sync_patient_practitioner : la branche DELETE était inopérante pour deux raisons :
--   1) elle référençait appointments.patient_id, colonne supprimée (erreur 42703) ;
--   2) en AFTER DELETE, la cascade appointment_patients → appointments a déjà supprimé
--      les lignes de jonction : la sous-requête ne trouvait donc plus aucun patient.
--
-- Correctif :
--   - INSERT / UPDATE : conservés en AFTER (la ligne est visible) et recalculés sur
--     l'ensemble des RDV du patient (corrige aussi l'absence de retour arrière à l'annulation) ;
--   - DELETE : déplacé dans un trigger BEFORE DELETE, seul moment où la jonction existe encore.
--
-- Idempotent : peut être rejoué sans risque.

BEGIN;

-- ============================================================
-- 1. INSERT / UPDATE (AFTER)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_patient_practitioner()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcule le praticien de chaque patient du RDV à partir de TOUS ses RDV
  -- non annulés (et non plus seulement du RDV modifié).
  UPDATE patients p SET practitioner_id = r.new_prac
  FROM (
    SELECT ap.patient_id,
           (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE a.status <> 'cancelled'
      AND ap.patient_id IN (
        SELECT patient_id FROM appointment_patients WHERE appointment_id = NEW.id
      )
    GROUP BY ap.patient_id
  ) r
  WHERE p.id = r.patient_id
    AND p.practitioner_id IS DISTINCT FROM r.new_prac;

  -- Patients du RDV qui n'ont plus aucun rendez-vous actif -> NULL
  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id IN (
      SELECT patient_id FROM appointment_patients WHERE appointment_id = NEW.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = p.id
        AND a.status <> 'cancelled'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner();

-- ============================================================
-- 2. DELETE (BEFORE — la jonction existe encore)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_patient_practitioner_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Nouveau praticien = dernier RDV restant (hors celui que l'on supprime)
  UPDATE patients p SET practitioner_id = r.new_prac
  FROM (
    SELECT ap.patient_id,
           (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE a.status <> 'cancelled'
      AND a.id <> OLD.id
      AND ap.patient_id IN (
        SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id
      )
    GROUP BY ap.patient_id
  ) r
  WHERE p.id = r.patient_id
    AND p.practitioner_id IS DISTINCT FROM r.new_prac;

  -- Patients qui n'ont plus aucun RDV actif -> NULL
  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id IN (
      SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = p.id
        AND a.id <> OLD.id
        AND a.status <> 'cancelled'
    );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner_del ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner_del
  BEFORE DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner_on_delete();

-- ============================================================
-- 3. Liaison patient ↔ rendez-vous
--    Le trigger sur `appointments` ne peut rien faire à la création : au moment
--    de l'INSERT du RDV, la ligne de `appointment_patients` n'existe pas encore.
--    Ce trigger comble le trou (création / retrait d'un patient sur un RDV).
-- ============================================================
CREATE OR REPLACE FUNCTION sync_patient_practitioner_from_link()
RETURNS TRIGGER AS $$
DECLARE
  pid uuid := COALESCE(NEW.patient_id, OLD.patient_id);
BEGIN
  UPDATE patients p SET practitioner_id = r.new_prac
  FROM (
    SELECT (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE ap.patient_id = pid
      AND a.status <> 'cancelled'
  ) r
  WHERE p.id = pid
    AND p.practitioner_id IS DISTINCT FROM r.new_prac;

  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id = pid
    AND NOT EXISTS (
      SELECT 1
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = pid
        AND a.status <> 'cancelled'
    );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_practitioner_link ON appointment_patients;
CREATE TRIGGER trg_sync_practitioner_link
  AFTER INSERT OR DELETE ON appointment_patients
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner_from_link();

COMMIT;
