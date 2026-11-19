-- BrainCareDZ — Correctif BUG-12
-- Bornes métier en base (défense en profondeur, en complément de la validation API).
--
-- Idempotent.

BEGIN;

-- Enfants : pas de valeur négative ni absurde
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_children_count_check;
ALTER TABLE patients
  ADD CONSTRAINT patients_children_count_check
  CHECK (children_count IS NULL OR children_count BETWEEN 0 AND 50);

-- Packs : total plafonné et prix positif
ALTER TABLE patient_packs DROP CONSTRAINT IF EXISTS patient_packs_total_max_check;
ALTER TABLE patient_packs
  ADD CONSTRAINT patient_packs_total_max_check CHECK (total_sessions <= 1000);

ALTER TABLE patient_packs DROP CONSTRAINT IF EXISTS patient_packs_price_check;
ALTER TABLE patient_packs
  ADD CONSTRAINT patient_packs_price_check CHECK (price >= 0);

-- Factures : la remise ne peut pas dépasser le total HT
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_discount_lte_subtotal_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_discount_lte_subtotal_check CHECK (discount <= subtotal);

-- Évaluations : échelle 0–10 (comme les champs du compte rendu)
ALTER TABLE patient_outcomes DROP CONSTRAINT IF EXISTS outcomes_improvement_range;
ALTER TABLE patient_outcomes
  ADD CONSTRAINT outcomes_improvement_range
  CHECK (perceived_improvement IS NULL OR perceived_improvement BETWEEN 0 AND 10);

ALTER TABLE patient_outcomes DROP CONSTRAINT IF EXISTS outcomes_satisfaction_range;
ALTER TABLE patient_outcomes
  ADD CONSTRAINT outcomes_satisfaction_range
  CHECK (global_satisfaction IS NULL OR global_satisfaction BETWEEN 0 AND 10);

COMMIT;
