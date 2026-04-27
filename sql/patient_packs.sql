-- Ajouter les colonnes pour le suivi des packs à la table patients (optionnel - colonnes dénormalisées pour affichage rapide)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS active_pack_id UUID REFERENCES patient_packs(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pack_service_id UUID REFERENCES services(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pack_total_sessions INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pack_remaining_sessions INTEGER;

-- Table patient_packs pour suivre les packs de séances
CREATE TABLE IF NOT EXISTS patient_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  total_sessions INTEGER NOT NULL DEFAULT 1,
  remaining_sessions INTEGER NOT NULL DEFAULT 1,
  practitioner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_packs_patient_id ON patient_packs(patient_id);

-- Ajouter colonne pour lier les appointments aux packs
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_pack_id UUID REFERENCES patient_packs(id);