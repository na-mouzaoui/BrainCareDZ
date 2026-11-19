-- BUG-36 — Archivage d'un dossier patient au lieu d'une suppression physique.
-- La suppression réelle effaçait les paiements, les rendez-vous, les comptes rendus,
-- les packs et les évaluations : l'historique comptable et clinique disparaissait.
-- Désormais la fiche est marquée supprimée : elle quitte les listes, son historique reste.
-- Seule exception : les rendez-vous à venir (status = 'scheduled') sont retirés pour
-- libérer les créneaux (géré par la route DELETE, pas par cette migration).

ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Index partiel : les listes ne lisent que les dossiers actifs.
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (created_at DESC) WHERE is_deleted = FALSE;
