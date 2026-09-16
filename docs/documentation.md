# BrainCareDZ — Documentation du projet

Application web de gestion pour un cabinet de psychologie et neurofeedback.
**Stack** : Next.js 14 (App Router) + TypeScript + PostgreSQL + Express.js + Tailwind CSS

---

## Table des matières

1. [Authentification & Utilisateurs](#1-authentification--utilisateurs)
2. [Patients](#2-patients)
3. [Rendez-vous](#3-rendez-vous)
4. [Services & Packs](#4-services--packs)
5. [Paiements](#5-paiements)
6. [Factures entreprises](#6-factures-entreprises)
7. [Dépenses](#7-dépenses)
8. [Comptes rendus](#8-comptes-rendus)
9. [Évaluations patients](#9-évaluations-patients)
10. [Liste d'attente](#10-liste-dattente)
11. [Tableau de bord](#11-tableau-de-bord)
12. [Administration](#12-administration)
13. [Paramètres](#13-paramètres)
14. [Schéma de la base de données](#14-schéma-de-la-base-de-données)

---

## 1. Authentification & Utilisateurs

### Connexion
- Connexion par **pseudo** (`prenom_nom`) et mot de passe
- JWT stocké dans `localStorage`, expire après 7 jours
- Redirection automatique vers `/dashboard` après connexion

### Inscription
- Champs : Prénom, Nom (séparés), mot de passe optionnel (défaut : `123456789`)
- Pseudo auto-généré : `prenom_nom` (minuscule, sans espace)
- Rôle : admin, psy, coach

### Rôles
| Rôle | Description |
|------|-------------|
| `admin` | Accès complet (tous les modules, admin, paramètres) |
| `psy` | Praticien — accès RDV, patients, comptes rendus, packs, services |
| `coach` | Coach — accès RDV, patients, comptes rendus, packs, services |

### Pages
- `/auth/login` — Connexion par pseudo
- `/auth/register` — Inscription

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion (pseudo + password) |
| POST | `/api/auth/register` | Inscription |
| GET | `/api/auth/me` | Profil utilisateur courant |

---

## 2. Patients

### Liste patients (`/patients`)
- **Tableau triable** (nom, email, téléphone, praticien, pack, solde)
- **Filtres multi-critères** : nom/email/tél, praticien, pack, nombre de séances, solde
- **Icône solde insuffisant** : alerte rouge si `balance < packPricePerSession`
- **Pack affiché** : `remaining/total` séances
- **Pagination** côté client
- Bouton "Nouveau patient" → dialog de création

### Détail patient (`/patients/[id]`)
- **Onglets imbriqués** :
  - **Informations** → sous-onglets : Identité, Situation, Motif, Historique, Source
  - **Rendez-vous** — table RDV du patient
  - **Packs** — packs possédés + partagés, bouton "Nouveau pack"
  - **Comptes rendus** — notes de séance
- **Édition inline** via `PatientForm` (même formulaire que la création)

### Champs patient
Identité : prénom*, nom*, date de naissance, âge (auto), sexe, téléphone*, email, commune
Situation : état civil, enfanst, profession, type patient (Adulte/Adolescent/Enfant)
Motif : raisons de consultation, durée des difficultés
Historique : déjà consulté, déjà testé neurofeedback, suivi en cours
Source : canal d'acquisition, détails, sous-compte, date premier contact, date premier RDV

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/patients` | Liste tous les patients |
| GET | `/api/patients/:id` | Détail d'un patient |
| POST | `/api/patients` | Créer un patient |
| PUT | `/api/patients/:id` | Modifier un patient |
| DELETE | `/api/patients/:id` | Supprimer un patient |
| GET | `/api/patients/search/:query` | Rechercher un patient |

---

## 3. Rendez-vous

### Calendrier (`/appointments`)
- **3 vues calendrier** : Admin, Psy, Coach — toggle par rôle (icônes)
- **Créneaux horaires** avec RDV affichés
- Bouton **"+"** sur créneaux occupés pour ajouter un RDV supplémentaire
- Navigation semaine précédente/suivante

### Liste RDV (`/appointments`)
- Vue **cartes** avec détails (patient, service, praticien, statut, pack)
- **Filtres** : statut, praticien, service, période

### Création RDV (`appointment-form`)
- Sélection **service** (détermine le type : neurofeedback ou non)
- Sélection **patient(s)** — max 4 patients par RDV si Coach
- Sélection **praticien** — pré-rempli selon le calendrier actif
- Checkbox **"Sélectionner le pack après la séance"** (pack différé)
- Service **optionnel** si pack différé coché

### Règles de conflit
- **Psy/Admin** : **1 RDV par créneau** (bloque même un autre patient) — praticien = créateur du RDV (immuable)
- **Coach** : **jusqu'à 4 RDV par créneau** (bloque le 5ᵉ), max 4 patients par RDV — praticien = celui qui rédige le compte-rendu (modifiable)
- Vérification par **rôle + patient commun** : 2 RDV possibles même créneau si rôle ou patient différent

### Statuts RDV
| Statut | Description |
|--------|-------------|
| `scheduled` | Planifié |
| `completed` | Effectué |
| `cancelled` | Annulé |

### Rapport RDV (`/appointments/[id]/report`)
- Compte rendu de séance via bouton **"Prendre en charge le RDV"**
- **Popup pack obligatoire** si pack différé — choisit le pack après la séance
- Pour les RDV Coach : rédiger le compte-rendu affecte automatiquement le praticien

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/appointments` | Liste RDV (filtres date) |
| GET | `/api/appointments/:id` | Détail RDV |
| POST | `/api/appointments` | Créer RDV |
| PUT | `/api/appointments/:id` | Modifier RDV |
| DELETE | `/api/appointments/:id` | Supprimer RDV |
| GET | `/api/appointments/availability/:date` | Disponibilité par date/rôle |

---

## 4. Services & Packs

### Services (`/services`)
- **CRUD complet** (nom, type, séances, prix, durée)
- **Filtres** : nom, type, nombre de séances, prix
- **Tri** par colonnes
- Types : `neurofeedback`, `consultation`, etc.

### Packs patients
- **Création** depuis la page patient (onglet Packs → "Nouveau pack")
- **Pack différé** : sélectionné après la 1ʳᵉ séance (popup obligatoire)
- **Débit automatique** : chaque RDV complété décrémente `remaining_sessions` de 1
- **Restauration** : si un RDV est dé-complété, la séance est rendue
- **Partage** : un pack peut être partagé avec d'autres patients

### Services Practitioner
- Les services sont associés aux utilisateurs via `practitioner_services`
- **Les deux rôles** (Psy et Coach) peuvent avoir des services associés
- L'admin gère les associations dans la page Admin → Utilisateurs

### Automatisation packs (trigger SQL)
- Trigger `trg_pack_sync_status` sur `appointments.status`
- Au passage en `completed` : décrémente le pack FIFO (patient + service)
- Au retour en arrière : restaure la séance

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/services` | Liste services |
| GET | `/api/services/:id` | Détail service |
| POST | `/api/services` | Créer service |
| PUT | `/api/services/:id` | Modifier service |
| DELETE | `/api/services/:id` | Supprimer service |
| GET | `/api/patient-packs` | Tous les packs |
| GET | `/api/patient-packs/patient/:id` | Packs d'un patient |
| POST | `/api/patient-packs` | Créer un pack |
| POST | `/api/patient-packs/select` | Pack pour séance différée |
| POST | `/api/patient-packs/:id/shares` | Partager un pack |
| DELETE | `/api/patient-packs/:id/shares/:patientId` | Retirer un partage |

---

## 5. Paiements

### Liste paiements (`/payments`)
- **Tableau triable** (patient, montant, mode, statut, date)
- **Filtres** : patient, mode de paiement, statut, montant, date
- **Filtre période** : aujourd'hui, semaine, mois, trimestre, année
- **Total** en bas de liste (réactif aux filtres)
- **Pagination**

### Champs paiement
- Montant (DZD), mode de paiement, statut (completed/pending/failed)
- Référence, notes
- Patient lié

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/payments` | Liste paiements |
| GET | `/api/payments/:id` | Détail paiement |
| POST | `/api/payments` | Créer paiement |
| PUT | `/api/payments/:id` | Modifier paiement |
| DELETE | `/api/payments/:id` | Supprimer paiement |

---

## 6. Factures entreprises

### Liste factures (`/company-invoices`)
- **Deux tableaux** : factures + entreprises
- **Tri par colonnes** sur les deux tables
- **Filtres** : référence, entreprise, date, total
- Lien vers la page d'édition entreprise

### Entreprises
- CRUD entreprise (nom, propriétaire, adresse, RC, NIF, NIS)
- Page édition `/company-invoices/companies/[id]/edit`

### Factures
- Création avec lignes (désignation, quantité, prix unitaire)
- Génération PDF (`company-invoice-pdf.ts`)
- Montants : subtotal, remise, TVA, total

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/companies` | Liste entreprises |
| POST | `/api/companies` | Créer entreprise |
| PUT | `/api/companies/:id` | Modifier entreprise |
| GET | `/api/company-invoices` | Liste factures |
| POST | `/api/company-invoices` | Créer facture |
| PUT | `/api/company-invoices/:id` | Modifier facture |

---

## 7. Dépenses

### Liste dépenses (`/expenses`)
- **Tableau triable** (libellé, catégorie, montant, date, créé par)
- **Filtres** : libellé, catégorie, créé par, montant, date
- **Pagination**
- Création via dialog

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/expenses` | Liste dépenses (admin) |
| POST | `/api/expenses` | Créer dépense (admin) |
| PUT | `/api/expenses/:id` | Modifier dépense (admin) |
| DELETE | `/api/expenses/:id` | Supprimer dépense (admin) |

---

## 8. Comptes rendus

### Page comptes rendus (`/reports`)
- Liste globale de toutes les notes de séance
- Tri et filtrage

### Comptes rendus par patient (`/patients/[id]`)
- Onglet "Comptes rendus" dans le détail patient
- Affiche service, praticien, date, contenu

### Compte rendu RDV (`/appointments/[id]/report`)
- Rédaction de la note de séance
- **Popup pack obligatoire** si pack différé
- Sauvegarde = enregistre la note + passe le RDV en "completed"

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/session-notes` | Toutes les notes |
| GET | `/api/session-notes/patient/:id` | Notes d'un patient |
| POST | `/api/session-notes` | Créer note |
| PUT | `/api/session-notes/:id` | Modifier note |
| DELETE | `/api/session-notes/:id` | Supprimer note |

---

## 9. Évaluations patients

- **Table** `patient_outcomes` : évaluation perçue, satisfaction, recommandation, changements observés
- **Backfill** : 11 lignes depuis les champs patients existants
- Historique des évaluations par patient

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/patient-outcomes/patient/:patientId` | Évaluations d'un patient |
| POST | `/api/patient-outcomes` | Créer évaluation |
| DELETE | `/api/patient-outcomes/:id` | Supprimer évaluation |

---

## 10. Liste d'attente

- **Table** `waiting_list` : patients en attente de RDV
- Endpoint CRUD pour gérer la liste d'attente

### API
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/waiting-list` | Liste d'attente |
| POST | `/api/waiting-list` | Ajouter à la liste |
| DELETE | `/api/waiting-list/:id` | Retirer de la liste |

---

## 11. Tableau de bord

### 12 tuiles KPI
| Rangée 1 | Rangée 2 | Rangée 3 |
|---|---|---|
| CA du mois | Annulations | Nouveaux clients aujourd'hui |
| Recettes du jour | Consultations Psy | Créances extérieures |
| Packs vendus | Liste d'attente Psy | Répartition par coach |
| Séances effectuées | Nouveaux clients | Répartition par genre |

### 4 graphiques
- **Pie** : Canal d'acquisition des patients
- **Bar** : Séances par jour (7 derniers jours)
- **Bar** : Nouveaux clients par mois (12 mois)
- **Bar** : RDV fixés vs patients venus (12 mois)

### Données
Tout calculé côté client depuis `patients.getAll()`, `appointments.getAll()`, `payments.getAll()`.

---

## 12. Administration

### Page admin (`/admin`)
- **Onglet Utilisateurs** : liste, création, édition, suppression
- **Onglet Activité** : logs d'activité paginés (50/page)
- **Onglet Listes** : gestion des listes déroulantes patients (professions, motifs)

### Utilisateurs
- Création : Prénom + Nom → pseudo auto-généré (`prenom_nom`), mot de passe auto `123456789`
- Édition : prénom, nom, rôle, téléphone, services associés
- Rôles affichés : **Admin / Psy / Coach**
- **Réinitialisation mot de passe** : bouton 🔑 pour réinitialiser à `123456789`

### Activité
- Historique des actions (création, modification, suppression, connexion, etc.)
- Pagination serveur

---

## 13. Paramètres

### Page settings (`/settings`)
- Gestion des paramètres du cabinet
- Informations générales

---

## 14. Schéma de la base de données

### Tables (19)
| Table | Description |
|-------|-------------|
| `users` | Utilisateurs (pseudo, name, first_name, last_name, role: admin/psy/coach) |
| `patients` | Patients (36+ champs, solde dénormalisé) |
| `services` | Prestations (neurofeedback, consultation...) |
| `practitioner_services` | Liaison utilisateur ↔ service (Psy et Coach) |
| `appointments` | Rendez-vous (practitioner_id nullable, role du calendrier, pack_deferred) |
| `appointment_patients` | Liaison RDV ↔ patient |
| `session_notes` | Comptes rendus de séance |
| `payments` | Paiements |
| `patient_packs` | Packs de séances |
| `patient_pack_usages` | Séances consommées (trigger FIFO) |
| `patient_pack_shares` | Partages de packs |
| `patient_motifs` | Motifs de consultation par patient |
| `patient_outcomes` | Évaluations patients |
| `professions` | Liste des professions |
| `motifs` | Liste des motifs |
| `companies` | Entreprises |
| `invoices` | Factures entreprises |
| `invoice_items` | Lignes de facture |
| `expenses` | Dépenses |
| `activity_logs` | Journal d'activité |
| `waiting_list` | Liste d'attente |

### Triggers
| Trigger | Table | Action |
|---------|-------|--------|
| `trg_pack_sync_status` | `appointments` | Débit/restauration FIFO des packs |
| `trg_payment_balance` | `payments` | Recalcul solde patient |
| `trg_usage_balance` | `patient_pack_usages` | Recalcul solde patient |

### Fonction
- `recalc_patient_balance(p_id)` — recalcule le solde d'un patient (payments − séances consommées)

---

*Documentation générée pour BrainCareDZ — Application de gestion cabinet psychologie/neurofeedback*
