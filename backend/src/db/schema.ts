import { query } from './index.js';

/**
 * Idempotent schema bootstrap (tables, indexes, triggers, functions).
 * Runs once at server startup. Safe to re-run: every statement uses
 * CREATE ... IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
 */
export async function ensureSchema(): Promise<void> {
  // practitioner_services (junction)
  await query(
    `CREATE TABLE IF NOT EXISTS practitioner_services (
      practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (practitioner_id, service_id)
    )`
  );

  // Reference lists: professions, motifs, patient_motifs
  await query(
    `CREATE TABLE IF NOT EXISTS professions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS motifs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS patient_motifs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      motif_id UUID NOT NULL REFERENCES motifs(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (patient_id, motif_id)
    )`
  );

  // Pack usages (one usage per appointment_patient junction)
  await query(
    `CREATE TABLE IF NOT EXISTS patient_pack_usages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pack_id UUID NOT NULL REFERENCES patient_packs(id) ON DELETE CASCADE,
      appointment_patient_id UUID NOT NULL UNIQUE REFERENCES appointment_patients(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query(`CREATE INDEX IF NOT EXISTS patient_pack_usages_pack_idx ON patient_pack_usages (pack_id)`);

  // Pack shares (a pack can be shared with other patients)
  await query(`
    CREATE TABLE IF NOT EXISTS patient_pack_shares (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pack_id UUID NOT NULL REFERENCES patient_packs(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(pack_id, patient_id)
    )`
  );
  await query(`CREATE INDEX IF NOT EXISTS patient_pack_shares_pack_idx ON patient_pack_shares (pack_id)`);
  await query(`CREATE INDEX IF NOT EXISTS patient_pack_shares_patient_idx ON patient_pack_shares (patient_id)`);
  await query(`
    CREATE OR REPLACE FUNCTION check_pack_share_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      total_ses INTEGER;
      current_shares INTEGER;
    BEGIN
      SELECT pp.total_sessions INTO total_ses
      FROM patient_packs pp WHERE pp.id = NEW.pack_id;
      SELECT COUNT(*) INTO current_shares
      FROM patient_pack_shares WHERE pack_id = NEW.pack_id;
      IF current_shares >= total_ses THEN
        RAISE EXCEPTION 'Nombre maximum de bénéficiaires atteint';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`
  );
  await query(`DROP TRIGGER IF EXISTS trg_check_pack_share_limit ON patient_pack_shares`);
  await query(`
    CREATE TRIGGER trg_check_pack_share_limit
    BEFORE INSERT ON patient_pack_shares
    FOR EACH ROW EXECUTE FUNCTION check_pack_share_limit()`
  );

  // Sync pack sessions + patient aggregates on appointment status change
  await query(`
    CREATE OR REPLACE FUNCTION sync_pack_on_appointment_status()
    RETURNS TRIGGER AS $$
    DECLARE
      ap_row RECORD;
      usage_row RECORD;
      chosen UUID;
    BEGIN
      IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
        FOR ap_row IN
          SELECT ap.id AS ap_id, ap.patient_id
          FROM appointment_patients ap
          WHERE ap.appointment_id = NEW.id
        LOOP
          IF EXISTS (SELECT 1 FROM patient_pack_usages u WHERE u.appointment_patient_id = ap_row.ap_id) THEN
            CONTINUE;
          END IF;
          -- Cherche d'abord un pack du patient lui-même, sinon un pack partagé avec lui.
          SELECT pp.id INTO chosen
          FROM patient_packs pp
          WHERE pp.patient_id = ap_row.patient_id
            AND pp.service_id = NEW.service_id
            AND pp.remaining_sessions > 0
          ORDER BY pp.created_at ASC
          LIMIT 1;
          IF chosen IS NULL THEN
            SELECT pps.pack_id INTO chosen
            FROM patient_pack_shares pps
            JOIN patient_packs pp ON pp.id = pps.pack_id
            WHERE pps.patient_id = ap_row.patient_id
              AND pp.service_id = NEW.service_id
              AND pp.remaining_sessions > 0
            ORDER BY pp.created_at ASC
            LIMIT 1;
          END IF;
          IF chosen IS NOT NULL THEN
            UPDATE patient_packs SET remaining_sessions = remaining_sessions - 1, updated_at = NOW()
            WHERE id = chosen;
            INSERT INTO patient_pack_usages (pack_id, appointment_patient_id)
            VALUES (chosen, ap_row.ap_id);
          END IF;
        END LOOP;
      ELSIF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
        FOR usage_row IN
          SELECT u.pack_id, ap.id AS ap_id
          FROM patient_pack_usages u
          JOIN appointment_patients ap ON ap.id = u.appointment_patient_id
          WHERE ap.appointment_id = NEW.id
        LOOP
          UPDATE patient_packs SET remaining_sessions = remaining_sessions + 1, updated_at = NOW()
          WHERE id = usage_row.pack_id;
          DELETE FROM patient_pack_usages WHERE appointment_patient_id = usage_row.ap_id;
        END LOOP;
      END IF;

      UPDATE patients p
      SET session_count = (
            SELECT COUNT(*)
            FROM appointment_patients ap
            JOIN appointments a ON a.id = ap.appointment_id
            WHERE ap.patient_id = p.id AND a.status = 'completed'
          ),
          last_session_date = (
            SELECT MAX(a.start_time)
            FROM appointment_patients ap
            JOIN appointments a ON a.id = ap.appointment_id
            WHERE ap.patient_id = p.id AND a.status = 'completed'
          )
      WHERE p.id IN (
        SELECT ap.patient_id FROM appointment_patients ap WHERE ap.appointment_id = NEW.id
      );

      PERFORM recalc_patient_balance(ap.patient_id)
      FROM appointment_patients ap
      WHERE ap.appointment_id = NEW.id;

      -- Recalc aussi le solde du patient principal si un pack partagé a été consommé.
      PERFORM recalc_patient_balance(pp.patient_id)
      FROM patient_pack_usages u
      JOIN patient_packs pp ON pp.id = u.pack_id
      JOIN appointment_patients ap ON ap.id = u.appointment_patient_id
      WHERE ap.appointment_id = NEW.id
        AND pp.patient_id <> ap.patient_id;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`DROP TRIGGER IF EXISTS trg_pack_sync_status ON appointments`);
  await query(`
    CREATE TRIGGER trg_pack_sync_status
    AFTER UPDATE OF status ON appointments
    FOR EACH ROW EXECUTE FUNCTION sync_pack_on_appointment_status()`
  );

  // activity_logs
  await query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      user_name VARCHAR(255),
      user_email VARCHAR(255),
      user_role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      resource_name VARCHAR(255),
      changes JSONB,
      status VARCHAR(50) DEFAULT 'success',
      error_message TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource)');
  await query('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)');

  // Drop any CHECK constraint on activity_logs.action (pre-existing constraint blocks new action types)
  try {
    const constraints = await query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'activity_logs'::regclass AND contype = 'c'`
    );
    for (const row of constraints.rows) {
      await query(`ALTER TABLE activity_logs DROP CONSTRAINT "${row.conname}"`);
    }
  } catch { /* ignore */ }

  // patient_outcomes (history of evaluations)
  await query(
    `CREATE TABLE IF NOT EXISTS patient_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      perceived_improvement INTEGER,
      observed_changes TEXT,
      global_satisfaction INTEGER,
      would_recommend BOOLEAN,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS patient_outcomes_patient_idx ON patient_outcomes (patient_id, evaluated_at DESC)');

  // waiting_list (ordered per practitioner)
  await query(
    `CREATE TABLE IF NOT EXISTS waiting_list (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (practitioner_id, patient_id),
      UNIQUE (practitioner_id, position)
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS waiting_list_practitioner_idx ON waiting_list (practitioner_id, position)');
  await query('CREATE INDEX IF NOT EXISTS waiting_list_patient_idx ON waiting_list (patient_id)');

  // Stored (denormalized) patient balance + triggers
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await query(`
    CREATE OR REPLACE FUNCTION recalc_patient_balance(p_id UUID)
    RETURNS VOID AS $$
    BEGIN
      UPDATE patients c
      SET balance = (
            COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              WHERE p.patient_id = c.id AND p.status = 'completed'
            ), 0)
            -
            COALESCE((
              SELECT SUM(
                CASE
                  WHEN u.id IS NOT NULL AND pp.id IS NOT NULL THEN pp.price / NULLIF(pp.total_sessions, 0)
                  ELSE COALESCE(s.price, 0)
                END
              )
              FROM appointments a
              LEFT JOIN services s ON s.id = a.service_id
              JOIN appointment_patients ap ON ap.appointment_id = a.id AND ap.patient_id = c.id
              LEFT JOIN patient_pack_usages u ON u.appointment_patient_id = ap.id
              LEFT JOIN patient_packs pp ON pp.id = u.pack_id
              WHERE a.status = 'completed'
                AND (u.id IS NULL OR pp.patient_id = c.id)
            ), 0)
          ),
          updated_at = NOW()
      WHERE c.id = p_id;
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`
    CREATE OR REPLACE FUNCTION recalc_patient_balance_on_payment()
    RETURNS TRIGGER AS $$
    DECLARE
      pid UUID;
    BEGIN
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        pid := NEW.patient_id;
      ELSE
        pid := OLD.patient_id;
      END IF;
      IF pid IS NOT NULL THEN
        PERFORM recalc_patient_balance(pid);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`DROP TRIGGER IF EXISTS trg_payment_balance ON payments`);
  await query(`
    CREATE TRIGGER trg_payment_balance
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION recalc_patient_balance_on_payment()
  `);
  await query(`
    CREATE OR REPLACE FUNCTION recalc_patient_balance_on_usage()
    RETURNS TRIGGER AS $$
    DECLARE
      pid UUID;
      principal UUID;
    BEGIN
      SELECT ap.patient_id INTO pid
      FROM appointment_patients ap
      WHERE ap.id = COALESCE(NEW.appointment_patient_id, OLD.appointment_patient_id);
      IF pid IS NOT NULL THEN
        PERFORM recalc_patient_balance(pid);
        -- Si le patient n'est pas le propriétaire du pack, recalc aussi le solde du principal.
        SELECT pp.patient_id INTO principal
        FROM patient_packs pp
        WHERE pp.id = COALESCE(NEW.pack_id, OLD.pack_id);
        IF principal IS NOT NULL AND principal <> pid THEN
          PERFORM recalc_patient_balance(principal);
        END IF;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`DROP TRIGGER IF EXISTS trg_usage_balance ON patient_pack_usages`);
  await query(`
    CREATE TRIGGER trg_usage_balance
    AFTER INSERT OR DELETE ON patient_pack_usages
    FOR EACH ROW EXECUTE FUNCTION recalc_patient_balance_on_usage()
  `);

  // Column additions / relaxations
  await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'consultation'`);
  await query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS pack_deferred BOOLEAN NOT NULL DEFAULT FALSE`);

  // appointment_patients junction (multi-patient sessions)
  await query(
    `CREATE TABLE IF NOT EXISTS appointment_patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (appointment_id, patient_id)
    )`
  );
  await query('CREATE INDEX IF NOT EXISTS idx_appointment_patients_appointment_id ON appointment_patients(appointment_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_appointment_patients_patient_id ON appointment_patients(patient_id)');

  // patients are no longer assigned to a fixed practitioner
  await query(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS clients_practitioner_id_fkey`);
  await query(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_practitioner_id_fkey`);
  await query(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS clients_practitioner_id_not_null`);
  await query(`ALTER TABLE patients ALTER COLUMN practitioner_id DROP NOT NULL`);

  // Missing patient columns
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS children_count INTEGER`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS profession_id UUID REFERENCES professions(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_type VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS difficulty_duration VARCHAR(50)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS commune VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_consultation BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_neurofeedback BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_type VARCHAR(255)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_follow_up BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_of_acquisition VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_details TEXT`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_sub VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS source_account VARCHAR(100)`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_contact_date DATE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_appointment_date DATE`);
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS abandon_reason TEXT`);
}
