# Audit fonctionnel & robustesse — BrainCareDZ

> **Nature** : audit **dynamique** (application réelle pilotée dans un navigateur + sondage direct de l'API + vérification en base PostgreSQL). Tous les constats ci-dessous ont été **reproduits**, pas seulement déduits du code.
> **Lecture** : chaque problème est présenté sous forme de **scénario raconté** (qui agit, à quel moment, ce qu'il fait, ce qu'il voit, ce que cela provoque), suivi de l'impact, du correctif technique et de l'effort estimé.
> **État** : **2 problèmes ouverts**. Les 31 bugs traités (27 corrigés + 4 vérifiés conformes) ont été retirés du détail ; leurs commits sont conservés au **§ 3** (poussés sur `main` le 19/11/2026).
> **Date** : 19/11/2026
> **Environnement** : front `http://localhost:3003` (Next 16.3.6 — ports 3000/3001/3002 occupés par d'autres projets), API `http://localhost:5002`, PostgreSQL `braincare` (port 5433).
> **Compte utilisé** : `admin` (rôle admin) + un compte `psy` temporaire créé puis supprimé.
> **État des données** : toutes les données de test créées pendant l'audit ont été supprimées (vérifié : 0 trace). Un seul effet de bord subsiste : le solde de *nazim mouzaoui* a été recalculé (16 020 → 16 200), voir **BUG-16**.

---

## 0. Fiche documentaire

| Champ | Valeur |
|---|---|
| Projet | BrainCareDZ — gestion de cabinet psychologie & neurofeedback |
| Domaine | Données de santé + données financières (soldes, packs, factures) |
| Stack | Next.js 16 / React 19 / TypeScript / Tailwind 4 → Express 4 / PostgreSQL |
| Périmètre testé | 11 écrans (dashboard, patients + détail + édition + notes, RDV + calendrier + compte rendu, paiements, packs, dépenses, factures entreprises, entreprises, analytics, admin), formulaires, API REST, triggers SQL |
| Hors périmètre | Montée en charge réelle, test d'intrusion réseau, rendu mobile natif, envoi d'e-mails, impression PDF (survolée) |

### Échelle de gravité

| Niveau | Signification |
|---|---|
| **Critique** | Empêche d'utiliser une fonctionnalité, provoque une perte/falsification de données, ou crée une faille de sécurité |
| **Majeur** | Résultat métier faux, erreur non gérée, incohérence visible en production |
| **Moyen** | UX trompeuse, accessibilité, incohérence de libellé, dette |
| **Robustesse** | Cas limite / montée en charge / hygiène, à traiter avant la croissance |

### Effort de correction

`XS` < 30 min · `S` < 2 h · `M` 0,5–1 j · `L` 1–3 j · `XL` > 3 j

---

## 1. Synthèse

| Gravité | Nombre |
|---|---|
| 🔴 Critique | 0 |
| 🟠 Majeur | 0 |
| 🟡 Moyen | 2 |
| ⚪ Robustesse | 0 |
| **Total** | **2** |

> **État au 19/11/2026** : les 31 bugs traités (BUG-01 → BUG-36) ont été **retirés de ce document**. Il ne reste que les points ouverts. L'historique des corrections est conservé au **§ 3**, et les commits sont sur `main`.

**Priorités restantes**

1. **BUG-30 / BUG-31** — RDV orphelin et données de test à nettoyer.

---

## 2. Tableau récapitulatif

> Ce tableau ne liste que les **points encore ouverts**. Les bugs traités (BUG-01 → BUG-36) ont été retirés du rapport ; leurs commits figurent au **§ 3**.

| ID | Problème | Gravité | Zone | Effort |
|---|---|---|---|---|
| BUG-30 | RDV orphelin (sans patient, sans service) en base | 🟡 Moyen | Données | XS |
| BUG-31 | Données de test résiduelles en base | 🟡 Moyen | Données | XS |

---

# 🟡 MOYEN

## BUG-30 — RDV orphelin en base

**Constat** : `c34b2c93-f53d-4a30-849d-2fb27759590f` — `status = 'scheduled'`, `service_id = NULL`, **aucun patient** dans `appointment_patients`, `pack_deferred = false`.

**Scénario de reproduction**

Lors d'un contrôle, l'équipe constate qu'un rendez-vous apparaît dans les compteurs sans patient associé : la carte s'affiche dans le calendrier avec un libellé vide, et il est impossible de l'ouvrir, de le clôturer ou de savoir à qui il appartenait. Il provient d'une création interrompue lors d'un test. Il fausse les statistiques de séances planifiées et reste indéfiniment dans l'agenda, sans qu'aucune alerte ne signale son existence.

**Impact** : RDV fantôme affiché dans les compteurs, impossible à clôturer correctement.
**Correctif** :
```sql
DELETE FROM appointments a
WHERE NOT EXISTS (SELECT 1 FROM appointment_patients ap WHERE ap.appointment_id = a.id);
```
+ contrainte applicative : un RDV doit avoir ≥ 1 patient (sauf RDV personnel avec `title`).
**Effort** : XS

---

## BUG-31 — Données de test résiduelles

**Constat** : services « test », « test 2 », « TEST2 » (4 000 000 DZD), patients « test demo », « test definir2 », « test pcks »…

**Scénario de reproduction**

Une nouvelle praticienne prend ses fonctions et ouvre la liste des services pour préparer son planning. Elle y trouve « test », « test 2 » et « TEST2 » à 4 000 000 DZD, mêlés aux vrais services. Elle ne sait pas lesquels sont réellement utilisés et risque de sélectionner un service de démonstration lors de la création d'un rendez-vous, ce qui fausserait le prix, le pack et le solde du patient. Les patients de test apparaissent également dans les listes et dans les statistiques de fréquentation, qui ne reflètent donc plus l'activité réelle.

**Impact** : bruit dans les listes, risque de sélectionner un faux patient/service, KPI pollués.
**Correctif** : script de purge (désactivation des services, suppression des patients sans RDV ni paiement), à exécuter avant la mise en production.
**Effort** : XS

---

## 3. Suivi des corrections appliquées

Les bugs traités ont été corrigés (ou vérifiés conformes / non reproduits lorsqu'aucun défaut n'était présent) et poussés sur `main` le **19/11/2026**, un commit par bug. Ils ne figurent plus dans le détail du rapport : ce tableau conserve l'historique.

| Bug | Commit | Correctif | Vérification effectuée |
|---|---|---|---|
| BUG-01 | `52fae77` | Filtre `type === 'psy'` supprimé | Services affichés sur Admin, Psy et Coach |
| BUG-02 | `e02ef1f` | Trigger scindé `AFTER` / `BEFORE DELETE` + sync sur la jonction | 6 scénarios SQL |
| BUG-03 | `354db31` | `must_change_password` + middleware 403 + écran bloquant | login → 403 → changement → 200 |
| BUG-04 | `9a117d5` | `/payments/summary` + total exact + indicateur de troncature | total identique à l'écran |
| BUG-05 | `d61887a` | 409 `PACK_REQUIRED` + popup rouverte | `complete` sans pack → 409 |
| BUG-06 | `0f34e4c` | Packs épuisés masqués + décrément conditionnel + CHECK | `total_sessions = -3` refusé |
| BUG-07 | `41b872f` | `status` rétabli, cohérence abandon, évaluations | Abandon sans motif → 400 |
| BUG-08 | `6a46e3f` | Référence obligatoire + index unique | doublon → 409, vide → 400 |
| BUG-09 | `79cec89` | « Pack vendu » = au moins une séance terminée | pack sans séance non compté |
| BUG-10 | `632e7ec` | `sendDbError` : traduction des codes PostgreSQL | 7 cas → 400/404/409 |
| BUG-11 | `66dc48d` | Refus des valeurs invalides au lieu de les ignorer | 5 cas → 400 |
| BUG-12 | `290b744` | Bornes SQL + validation API (DOB, packs, remise, évaluations) | 6 cas → 400 |
| BUG-13 | `c95e5c7` | Longueurs maximales (API + `maxLength`) | nom de 5 000 caractères → 400 |
| BUG-14 | `a7d1021` | Libellé « patients » sous le total du donut | centre : « 17 / patients » |
| BUG-15 | `2715fba` | Unicité du nom + recherche de similarité | doublon → 409, recherche « consult » |
| BUG-17 | `8ab638f` | `mustPay` en état React (plus une ref) | navigation libre après paiement |
| BUG-18 | `d46d77a` | Confirmation si le créneau n'a pas commencé | popup + journalisation `earlyCompletion` |
| BUG-19 | `205401f` | Message français + clé `message` | 400 « Un montant de 0 nécessite des notes. » |
| BUG-20 | `64d4a40` | État vide distinct lorsque des filtres sont actifs | filtre sans résultat → « Aucun patient ne correspond… » + bouton de réinitialisation |
| BUG-21 | — | **Vérifié conforme** (réinitialisation appliquée) | « Réinitialiser » → liste restaurée (17 patients) |
| BUG-22 | `73edcc5` | Message distinct si date de naissance future | 31/12/2099 → « ne peut pas être dans le futur » |
| BUG-16 | `3164b4f` | Réconciliation : usages invalides, `remaining_sessions`, `session_count`, soldes | 16 packs → **0**, 2 compteurs → **0** |
| BUG-23 | — | **Non reproduit** : message « Maximum N patient(s) pour ce rendez-vous » déjà spécifique | 5 patients coach → « Maximum 4 patient(s) » |
| BUG-24 | `86c8e30` | Date préremplie + libellé « Montant TVA (DZD) » | date = jour, libellé explicite |
| BUG-25 | — | **Non reproduit** : les gardes d'auth empêchent les appels avant résolution | chargement authentifié : 11 requêtes, **0 × 401** |
| BUG-26 | `3136437` | Squelette pendant le chargement de la page d'édition | plus de formulaire vide/éditable |
| BUG-27 | — | **Non reproduit** : la « pastille » recouvrante est l'indicateur de développement Next.js (`nextjs-portal`), absent en production | à 912 px et 1000 px : bouton « Nouveau patient » entier, non tronqué, et seul élément sous le curseur ; avatar utilisateur en bas de la barre latérale |
| BUG-28 | `590e34c` | 90 messages API traduits en français | « Patient introuvable. », « Rendez-vous créé. »… |
| BUG-29 | `f00967b` | Noms accessibles : liens, boutons d'action, labels, toggles | nav `aria-label`, labels liés (`htmlFor`/`id`), `autocomplete` |
| BUG-34 | `1cb5f76` | Désactivation logique (`users.is_active`) au lieu d'une suppression physique | DELETE → 200, compte retiré des listes et des praticiens, reconnexion 403 `ACCOUNT_DISABLED`, ancien cookie 401 |
| BUG-36 | `6bedf82` | Archivage logique (`patients.is_deleted`) + suppression des RDV `scheduled` ; historique (paiements, séances, notes, packs, évaluations) conservé | patient retiré des listes et sélecteurs, fiche accessible avec bandeau « Dossier archivé », 2 RDV à venir supprimés, RDV partagé Coach conservé pour l'autre patient, RDV terminé conservé, paiement intact, restauration 200 |

### 3.1 Migrations SQL appliquées en base

| Fichier | Objet |
|---|---|
| `sql/fix_sync_patient_practitioner.sql` | Trigger praticien (BUG-02) |
| `sql/must_change_password.sql` | Colonne `users.must_change_password` (BUG-03) |
| `sql/patient_packs_bounds.sql` | Bornes `total_sessions` / `remaining_sessions` (BUG-06) |
| `sql/patients_status.sql` | Colonne `patients.status` + CHECK (BUG-07) |
| `sql/invoices_reference_unique.sql` | Index unique sur la référence de facture (BUG-08) |
| `sql/business_bounds.sql` | Bornes métier : enfants, packs, remise, évaluations (BUG-12) |
| `sql/services_name_unique.sql` | `pg_trgm` + unicité du nom des services actifs (BUG-15) |
| `sql/data_reconciliation.sql` | Réconciliation packs / `session_count` / soldes (BUG-16) |
| `sql/users_soft_delete.sql` | Colonne `users.is_active` + index partiel (BUG-34) |
| `sql/patients_soft_delete.sql` | Colonnes `patients.is_deleted` / `deleted_at` / `deleted_by` + index partiel (BUG-36) |

> `sql/integrity_fixes.sql` a également été mis à jour : une installation neuve obtient directement la version corrigée du trigger.

### 3.2 Ce qui reste ouvert après ce lot

| Élément | Référence | Statut |
|---|---|---|
| Affichage du mot de passe provisoire à l'admin | correctif BUG-03 | Amélioration non bloquante |
| Lien évaluation ↔ rendez-vous (`patient_outcomes.appointment_id`) | correctif BUG-07 | Amélioration non bloquante |
| Lien pack ↔ paiement (`payments.pack_id`) | correctif BUG-09 | Amélioration non bloquante (distinguer « vendu » et « encaissé ») |
| Pack auto-créé d'un RDV annulé conservé | correctif BUG-09 | Amélioration non bloquante (nettoyage à décider) |
| `DELETE` de RDV depuis l'interface | — | Toujours impossible côté UI (par conception) |

---

## 4. Plan de correction recommandé

### Lot unique — Nettoyage des données (≈1 h)
`BUG-30` · `BUG-31`

### Ordre d'application des migrations SQL restantes

Toutes les migrations des bugs corrigés sont appliquées en base (voir § 3.1) ; aucune n'est en attente.

> Chaque migration doit être répercutée dans `backend/src/db/schema.ts` (bloc `ensureSchema`), sinon elle sera écrasée au redémarrage du serveur.

---

## 5. Annexe — Méthodologie et traçabilité

### Tests réalisés
- Navigation complète des 11 écrans (console + réseau surveillés à chaque étape).
- Création/édition/suppression sur patients, RDV, paiements, packs, factures, utilisateurs.
- Sondage API : 40+ requêtes limites (valeurs extrêmes, UUID invalides, enums inconnus, injections).
- Vérification en base : schéma, index, contraintes, triggers, cohérence des données.
- Scénarios de session : expiration, révocation, rôle non-admin, URL profonde inexistante.

### Ce qui n'a pas été testé
- Montée en charge réelle (> 2 000 RDV), test de concurrence multi-postes.
- Rendu mobile natif (fenêtre non redimensionnable dans l'environnement d'audit).
- Impression / génération PDF des factures (survolée, pas d'export réel).
- Envoi d'e-mails (aucun code d'envoi identifié).
- Sauvegarde / restauration PostgreSQL.

### Nettoyage effectué
Tous les enregistrements créés pour l'audit ont été supprimés et vérifiés :
patients, RDV, packs, usages, notes, évaluations, factures, paiements, utilisateur `audit_psy`.
Seul changement persistant : recalcul du solde de *nazim mouzaoui* (voir BUG-16).

---

*Rapport généré le 19/11/2026 — à conserver dans `docs/` avec `audit-de-code.md` et `rapport-de-tests.md`.*
