-- BrainCareDZ — Correctif BUG-03
-- Mot de passe par défaut conservé (123456789) mais changement OBLIGATOIRE
-- à la première connexion.
--
-- Idempotent.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Les comptes existants ne sont pas bloqués : ils gardent leur mot de passe actuel.
-- Seuls les comptes créés après ce correctif porteront le drapeau (voir users.ts).

COMMIT;
