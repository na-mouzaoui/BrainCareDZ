-- Audit trigger v2: looks up entity names from related tables
-- Applied over v1: adds JOIN lookups for tables without a direct name column

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_user_role TEXT;
  v_user_pseudo TEXT;
  v_resource VARCHAR(100);
  v_resource_id VARCHAR(255);
  v_resource_name VARCHAR(255);
  v_action VARCHAR(100);
  v_old JSONB;
  v_new JSONB;
  v_row RECORD;
BEGIN
  BEGIN
    v_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  v_user_name := NULLIF(current_setting('app.user_name', true), '');
  v_user_email := NULLIF(current_setting('app.user_email', true), '');
  v_user_role := NULLIF(current_setting('app.user_role', true), '');
  v_user_pseudo := NULLIF(current_setting('app.user_pseudo', true), '');

  v_resource := CASE TG_TABLE_NAME
    WHEN 'patients' THEN 'patient'
    WHEN 'users' THEN 'user'
    WHEN 'services' THEN 'service'
    WHEN 'appointments' THEN 'appointment'
    WHEN 'payments' THEN 'payment'
    WHEN 'expenses' THEN 'expense'
    WHEN 'session_notes' THEN 'session-note'
    WHEN 'patient_packs' THEN 'patient-pack'
    WHEN 'patient_pack_usages' THEN 'patient-pack-usage'
    WHEN 'patient_outcomes' THEN 'patient-outcome'
    WHEN 'invoices' THEN 'company-invoice'
    WHEN 'invoice_items' THEN 'invoice-item'
    WHEN 'companies' THEN 'company'
    WHEN 'waiting_list' THEN 'waiting-list'
    WHEN 'professions' THEN 'profession'
    WHEN 'motifs' THEN 'motif'
    WHEN 'patient_motifs' THEN 'patient-motif'
    WHEN 'practitioner_services' THEN 'practitioner-service'
    WHEN 'appointment_patients' THEN 'appointment-patient'
    WHEN 'calendar_settings' THEN 'calendar-setting'
    ELSE TG_TABLE_NAME
  END;

  v_action := TG_OP;

  IF TG_OP = 'DELETE' THEN
    v_resource_id := OLD.id::TEXT;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_resource_id := NEW.id::TEXT;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_resource_id := NEW.id::TEXT;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  -- Look up resource_name based on table type
  BEGIN
    CASE TG_TABLE_NAME
      WHEN 'patients' THEN
        v_row := (SELECT ROW(first_name || ' ' || last_name) FROM patients WHERE id = COALESCE(NEW.id, OLD.id));
        v_resource_name := (SELECT first_name || ' ' || last_name FROM patients WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'users' THEN
        v_resource_name := (SELECT name FROM users WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'services' THEN
        v_resource_name := (SELECT name FROM services WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'appointments' THEN
        v_resource_name := (
          SELECT s.name || ' — ' || string_agg(p.first_name || ' ' || p.last_name, ', ')
          FROM appointments a
          LEFT JOIN services s ON s.id = a.service_id
          LEFT JOIN appointment_patients ap ON ap.appointment_id = a.id
          LEFT JOIN patients p ON p.id = ap.patient_id
          WHERE a.id = COALESCE(NEW.id, OLD.id)
          GROUP BY s.name
        );

      WHEN 'payments' THEN
        v_resource_name := (
          SELECT p.first_name || ' ' || p.last_name
          FROM payments pay
          JOIN patients p ON p.id = pay.patient_id
          WHERE pay.id = COALESCE(NEW.id, OLD.id)
        );

      WHEN 'expenses' THEN
        v_resource_name := (SELECT title FROM expenses WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'session_notes' THEN
        v_resource_name := (
          SELECT p.first_name || ' ' || p.last_name
          FROM session_notes sn
          LEFT JOIN appointment_patients ap ON ap.id = sn.appointment_patient_id
          LEFT JOIN patients p ON p.id = ap.patient_id
          WHERE sn.id = COALESCE(NEW.id, OLD.id)
          LIMIT 1
        );

      WHEN 'patient_packs' THEN
        v_resource_name := (
          SELECT p.first_name || ' ' || p.last_name || ' — ' || s.name
          FROM patient_packs pp
          JOIN patients p ON p.id = pp.patient_id
          LEFT JOIN services s ON s.id = pp.service_id
          WHERE pp.id = COALESCE(NEW.id, OLD.id)
        );

      WHEN 'invoices' THEN
        v_resource_name := (
          SELECT i.reference || ' — ' || c.name
          FROM invoices i
          LEFT JOIN companies c ON c.id = i.company_id
          WHERE i.id = COALESCE(NEW.id, OLD.id)
        );

      WHEN 'companies' THEN
        v_resource_name := (SELECT name FROM companies WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'waiting_list' THEN
        v_resource_name := (
          SELECT p.first_name || ' ' || p.last_name
          FROM waiting_list wl
          JOIN patients p ON p.id = wl.patient_id
          WHERE wl.id = COALESCE(NEW.id, OLD.id)
        );

      WHEN 'patient_outcomes' THEN
        v_resource_name := (
          SELECT p.first_name || ' ' || p.last_name
          FROM patient_outcomes po
          JOIN patients p ON p.id = po.patient_id
          WHERE po.id = COALESCE(NEW.id, OLD.id)
        );

      WHEN 'professions' THEN
        v_resource_name := (SELECT label FROM professions WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'motifs' THEN
        v_resource_name := (SELECT label FROM motifs WHERE id = COALESCE(NEW.id, OLD.id));

      WHEN 'calendar_settings' THEN
        v_resource_name := (SELECT calendar_role FROM calendar_settings WHERE id = COALESCE(NEW.id, OLD.id));

      ELSE
        -- Fallback: try common columns
        v_resource_name := COALESCE(
          (NEW.name)::TEXT,
          CASE WHEN NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL
               THEN (NEW.first_name)::TEXT || ' ' || (NEW.last_name)::TEXT END,
          (NEW.title)::TEXT,
          (NEW.label)::TEXT,
          NULL
        );
    END CASE;
  EXCEPTION WHEN OTHERS THEN
    v_resource_name := NULL;
  END;

  INSERT INTO activity_logs (
    user_id, user_name, user_pseudo, user_email, user_role,
    action, resource, resource_id, resource_name,
    changes, status
  ) VALUES (
    v_user_id, v_user_name, v_user_pseudo, v_user_email, v_user_role,
    v_action, v_resource, v_resource_id, v_resource_name,
    jsonb_build_object('old', v_old, 'new', v_new),
    'success'
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Audit log failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
