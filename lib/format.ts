const amountFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formate un montant à la française : séparateur de milliers et jusqu'à
 * 2 décimales. Intl utilise une espace fine insécable (U+202F), peu visible
 * selon les polices ; on la remplace par une espace insécable classique.
 */
export function formatAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return amountFormatter.format(Number.isFinite(amount) ? amount : 0).replace(/\u202f/g, '\u00a0');
}

export function formatDZD(value: number | string | null | undefined): string {
  return `${formatAmount(value)} DZD`;
}
