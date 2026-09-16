UPDATE activity_logs SET resource_name = (
  CASE
    WHEN resource = 'appointment' THEN (
      SELECT string_agg(p.first_name || ' ' || p.last_name, ', ')
      FROM appointment_patients ap
      JOIN patients p ON p.id = ap.patient_id
      WHERE ap.appointment_id::text = activity_logs.resource_id
    )
    WHEN resource = 'appointment-patient' THEN (
      SELECT p.first_name || ' ' || p.last_name
      FROM appointment_patients ap
      JOIN patients p ON p.id = ap.patient_id
      WHERE ap.id::text = activity_logs.resource_id
    )
    WHEN resource = 'patient' THEN (SELECT first_name || ' ' || last_name FROM patients WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'user' THEN (SELECT name FROM users WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'service' THEN (SELECT name FROM services WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'company' THEN (SELECT name FROM companies WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'payment' THEN (SELECT p.first_name || ' ' || p.last_name FROM payments pay JOIN patients p ON p.id = pay.patient_id WHERE pay.id::text = activity_logs.resource_id)
    WHEN resource = 'expense' THEN (SELECT title FROM expenses WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'patient-pack' THEN (SELECT p.first_name || ' ' || p.last_name || ' - ' || s.name FROM patient_packs pp JOIN patients p ON p.id = pp.patient_id LEFT JOIN services s ON s.id = pp.service_id WHERE pp.id::text = activity_logs.resource_id)
    WHEN resource = 'company-invoice' THEN (SELECT i.reference || ' - ' || c.name FROM invoices i LEFT JOIN companies c ON c.id = i.company_id WHERE i.id::text = activity_logs.resource_id)
    WHEN resource = 'session-note' THEN (SELECT p.first_name || ' ' || p.last_name FROM session_notes sn LEFT JOIN appointment_patients ap ON ap.id = sn.appointment_patient_id LEFT JOIN patients p ON p.id = ap.patient_id WHERE sn.id::text = activity_logs.resource_id LIMIT 1)
    WHEN resource = 'profession' THEN (SELECT label FROM professions WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'motif' THEN (SELECT label FROM motifs WHERE id::text = activity_logs.resource_id)
    WHEN resource = 'waiting-list' THEN (SELECT p.first_name || ' ' || p.last_name FROM waiting_list wl JOIN patients p ON p.id = wl.patient_id WHERE wl.id::text = activity_logs.resource_id)
    WHEN resource = 'auth' THEN (SELECT name FROM users WHERE id::text = activity_logs.resource_id)
    ELSE resource_name
  END
) WHERE resource_name IS NULL OR resource_name = '';
