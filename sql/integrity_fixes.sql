-- BrainCareDZ — Integrity fixes
-- Point 1: Remove duplicated evaluation columns from patients (keep only in patient_outcomes)
-- Point 2: Add trigger to sync patients.practitioner_id from latest appointment
-- Point 3: invoices.created_by CASCADE → SET NULL
-- Point 6: CHECK constraint on calendar_settings.calendar_role

BEGIN;

-- ============================================================
-- POINT 1: Drop duplicated eval columns from patients
-- ============================================================
ALTER TABLE patients DROP COLUMN IF EXISTS perceived_improvement;
ALTER TABLE patients DROP COLUMN IF EXISTS observed_changes;
ALTER TABLE patients DROP COLUMN IF EXISTS global_satisfaction;
ALTER TABLE patients DROP COLUMN IF EXISTS would_recommend;

-- ============================================================
-- POINT 2: Trigger to keep patients.practitioner_id in sync
--   (corrigé — voir sql/fix_sync_patient_practitioner.sql pour le détail :
--    DELETE déplacé en BEFORE, recalcul sur tous les RDV du patient)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_patient_practitioner()
RETURNS TRIGGER AS $$
BEGIN
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

  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id IN (
      SELECT patient_id FROM appointment_patients WHERE appointment_id = NEW.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = p.id AND a.status <> 'cancelled'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_patient_practitioner_on_delete()
RETURNS TRIGGER AS $$
BEGIN
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

  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id IN (
      SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = p.id AND a.id <> OLD.id AND a.status <> 'cancelled'
    );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner();

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner_del ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner_del
  BEFORE DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner_on_delete();

-- ============================================================
-- POINT 3: invoices.created_by CASCADE → SET NULL
-- ============================================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- POINT 6: CHECK constraint on calendar_settings.calendar_role
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_settings_role_check'
  ) THEN
    ALTER TABLE calendar_settings ADD CONSTRAINT calendar_settings_role_check
      CHECK (calendar_role IN ('admin', 'psy', 'coach'));
  END IF;
END $$;

COMMIT;
