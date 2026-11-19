-- BUG-34 — Désactivation d'un utilisateur au lieu d'une suppression physique.
-- La suppression réelle échouait (500) dès qu'un rendez-vous, un compte rendu ou un
-- paiement référençait l'utilisateur, et elle détruisait son historique.
-- Les écrans (liste des utilisateurs, sélecteurs de praticien) ne lisent que les comptes actifs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index partiel : les lectures ne portent que sur les comptes actifs.
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active) WHERE is_active = TRUE;
