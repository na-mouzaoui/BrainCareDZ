import type { Response } from 'express';

/**
 * Traduction des erreurs PostgreSQL en réponses HTTP utiles.
 *
 * Sans cela, une saisie invalide (mode de paiement inconnu, UUID mal formé,
 * montant hors limites, clé étrangère absente) remontait en 500 « Erreur
 * interne du serveur », ce qui masquait la cause et polluait les métriques.
 */
const CONSTRAINT_MESSAGES: Record<string, { status: number; message: string }> = {
  payments_payment_method_check: { status: 400, message: 'Mode de paiement invalide.' },
  payments_status_check: { status: 400, message: 'Statut de paiement invalide.' },
  payments_amount_check: { status: 400, message: 'Le montant doit être positif ou nul.' },
  services_type_check: { status: 400, message: 'Type de service invalide.' },
  services_name_active_unique: { status: 409, message: 'Un service porte déjà ce nom. Choisissez un autre nom.' },
  services_category_check: { status: 400, message: 'Catégorie de service invalide.' },
  services_price_check: { status: 400, message: 'Le prix doit être positif ou nul.' },
  services_duration_check: { status: 400, message: 'La durée doit être supérieure à zéro.' },
  users_role_check: { status: 400, message: 'Rôle invalide.' },
  appointments_status_check: { status: 400, message: 'Statut de rendez-vous invalide.' },
  appointment_time_check: { status: 400, message: "L'heure de fin doit être postérieure à l'heure de début." },
  patients_marital_status_check: { status: 400, message: 'Situation familiale invalide.' },
  patients_patient_type_check: { status: 400, message: 'Type de patient invalide.' },
  patients_children_count_check: { status: 400, message: "Le nombre d'enfants ne peut pas être négatif." },
  expenses_amount_check: { status: 400, message: 'Le montant doit être supérieur à zéro.' },
  invoices_discount_check: { status: 400, message: 'La remise ne peut pas être négative.' },
  invoices_discount_lte_subtotal_check: { status: 400, message: 'La remise ne peut pas dépasser le total HT.' },
  patient_packs_total_sessions_check: { status: 400, message: 'Le nombre de séances doit être supérieur à zéro.' },
  patient_packs_remaining_check: { status: 400, message: 'Nombre de séances restantes invalide.' },
  patient_packs_total_max_check: { status: 400, message: 'Le nombre de séances ne peut pas dépasser 1000.' },
  patient_packs_price_check: { status: 400, message: 'Le prix du pack doit être positif ou nul.' },
  outcomes_improvement_range: { status: 400, message: "L'amélioration perçue doit être comprise entre 0 et 10." },
  outcomes_satisfaction_range: { status: 400, message: 'La satisfaction globale doit être comprise entre 0 et 10.' },
};

const PG_CODE_MESSAGES: Record<string, { status: number; message: string }> = {
  '22P02': { status: 400, message: 'Identifiant invalide.' },
  '22003': { status: 400, message: 'Valeur numérique hors limites.' },
  '23502': { status: 400, message: 'Champ obligatoire manquant.' },
  '23503': { status: 404, message: 'Élément référencé introuvable.' },
  '23505': { status: 409, message: 'Cet enregistrement existe déjà.' },
  '23514': { status: 400, message: 'Valeur non autorisée.' },
};

export function sendDbError(res: Response, error: unknown, fallback = 'Erreur interne du serveur') {
  const err = error as { code?: string; constraint?: string; detail?: string } | undefined;

  if (err?.constraint && CONSTRAINT_MESSAGES[err.constraint]) {
    const mapped = CONSTRAINT_MESSAGES[err.constraint];
    return res.status(mapped.status).json({ success: false, code: err.code, message: mapped.message });
  }

  if (err?.code && PG_CODE_MESSAGES[err.code]) {
    const mapped = PG_CODE_MESSAGES[err.code];
    return res.status(mapped.status).json({ success: false, code: err.code, message: mapped.message });
  }

  console.error('[api]', error);
  return res.status(500).json({ success: false, message: fallback });
}
