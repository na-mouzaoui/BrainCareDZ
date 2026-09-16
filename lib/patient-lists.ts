import { apiRequest } from '@/lib/api';

export interface PatientLists {
  professions: string[];
  motifs: string[];
}

export const DEFAULT_PROFESSIONS = [
  'Salarié(e)',
  'Fonctionnaire',
  'Indépendant(e)',
  'Commerçant(e)',
  'Artisan(e)',
  'Profession libérale',
  'Étudiant(e)',
  'Sans emploi',
  'Retraité(e)',
];

export const DEFAULT_MOTIFS = [
  'Anxiété',
  'Stress / burn-out',
  'Troubles du sommeil',
  "Troubles de l'attention (TDAH)",
  'Difficultés émotionnelles',
  'Problèmes scolaires',
  'Troubles du comportement',
  'TSA / Autisme',
  'Troubles psychosomatiques',
];

export const DEFAULT_LISTS: PatientLists = {
  professions: DEFAULT_PROFESSIONS,
  motifs: DEFAULT_MOTIFS,
};

export async function getPatientLists(): Promise<PatientLists> {
  try {
    const response = await apiRequest<PatientLists>('/settings/patient-lists', { method: 'GET' });
    if (response.success && response.data) {
      return {
        professions: Array.isArray(response.data.professions) ? response.data.professions : DEFAULT_PROFESSIONS,
        motifs: Array.isArray(response.data.motifs) ? response.data.motifs : DEFAULT_MOTIFS,
      };
    }
  } catch {
    // fall back to defaults below
  }
  return DEFAULT_LISTS;
}

export async function savePatientLists(lists: PatientLists): Promise<boolean> {
  try {
    const response = await apiRequest<PatientLists>('/settings/patient-lists', {
      method: 'PUT',
      body: { professions: lists.professions, motifs: lists.motifs },
    });
    return response.success;
  } catch {
    return false;
  }
}
