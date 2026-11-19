-- BrainCareDZ — Correctif BUG-16
-- Réconciliation des données historiques (écarts créés entre le 06 et le 12/09/2026,
-- avant la table patient_pack_usages et le trigger sync_pack_on_appointment_status).
--
-- Principe retenu :
--   1. un usage ne peut exister que pour un rendez-vous TERMINÉ (règle du trigger) ;
--      les usages rattachés à un RDV non terminé sont supprimés ;
--   2. `remaining_sessions` est aligné sur les usages traçables
--      (`total_sessions - nombre d'usages`, borné à 0) ;
--   3. `session_count` est recalculé depuis les rendez-vous terminés ;
--   4. tous les soldes sont recalculés avec la fonction officielle.
--
-- ⚠️ Les séances consommées via l'ancien endpoint manuel (sans ligne d'usage) ne
-- peuvent pas être reconstituées : le compteur est aligné sur les traces réelles.
--
-- À exécuter APRÈS sauvegarde.

BEGIN;

-- 1. Supprimer les usages invalides (RDV non terminé)
DELETE FROM patient_pack_usages u
USING appointment_patients ap
JOIN appointments a ON a.id = ap.appointment_id
WHERE ap.id = u.appointment_patient_id
  AND a.status <> 'completed';

-- 2. Aligner remaining_sessions sur les usages traçables
UPDATE patient_packs pk
SET remaining_sessions = GREATEST(
      pk.total_sessions - (
        SELECT COUNT(*) FROM patient_pack_usages u WHERE u.pack_id = pk.id
      ), 0
    ),
    updated_at = NOW();

-- 3. Recalculer session_count depuis les RDV terminés
UPDATE patients p
SET session_count = (
  SELECT COUNT(*)
  FROM appointment_patients ap
  JOIN appointments a ON a.id = ap.appointment_id
  WHERE ap.patient_id = p.id
    AND a.status = 'completed'
);

-- 4. Recalculer tous les soldes
SELECT recalc_patient_balance(id) FROM patients;

COMMIT;
