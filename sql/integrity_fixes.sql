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
-- ============================================================
CREATE OR REPLACE FUNCTION sync_patient_practitioner()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    UPDATE patients p SET practitioner_id = sub.new_prac
    FROM (
      SELECT ap.patient_id,
             (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE a.status NOT IN ('cancelled')
        AND a.id = NEW.id
      GROUP BY ap.patient_id
    ) sub
    WHERE p.id = sub.patient_id
      AND p.practitioner_id IS DISTINCT FROM sub.new_prac;
  END IF;

  -- Also recalculate when an appointment is deleted
  IF TG_OP = 'DELETE' THEN
    UPDATE patients p SET practitioner_id = sub.new_prac
    FROM (
      SELECT ap.patient_id,
             (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
      FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE a.status NOT IN ('cancelled')
        AND a.patient_id IN (SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id)
      GROUP BY ap.patient_id
    ) sub
    WHERE p.id = sub.patient_id
      AND p.practitioner_id IS DISTINCT FROM sub.new_prac;

    -- If no more appointments, set NULL
    UPDATE patients p SET practitioner_id = NULL
    WHERE p.id IN (SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id)
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        JOIN appointment_patients ap2 ON ap2.appointment_id = a.id
        WHERE ap2.patient_id = p.id AND a.status NOT IN ('cancelled')
      );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner
  AFTER INSERT OR UPDATE OF status OR DELETE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_practitioner();

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
