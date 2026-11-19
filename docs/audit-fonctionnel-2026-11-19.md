# Audit fonctionnel & robustesse — BrainCareDZ

> **Nature** : audit **dynamique** (application réelle pilotée dans un navigateur + sondage direct de l'API + vérification en base PostgreSQL). Tous les constats ci-dessous ont été **reproduits**, pas seulement déduits du code.
> **Lecture** : chaque problème est présenté sous forme de **scénario raconté** (qui agit, à quel moment, ce qu'il fait, ce qu'il voit, ce que cela provoque), suivi de l'impact, du correctif technique et de l'effort estimé.
> **État** : **5 problèmes ouverts**. Les 29 bugs traités (25 corrigés + 4 vérifiés conformes) ont été retirés du détail ; leurs commits sont conservés au **§ 3** (poussés sur `main` le 19/11/2026).
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
| 🟠 Majeur | 1 |
| 🟡 Moyen | 2 |
| ⚪ Robustesse | 2 |
| **Total** | **5** |

> **État au 19/11/2026** : les 29 bugs traités (BUG-01 → BUG-29) ont été **retirés de ce document**. Il ne reste que les points ouverts. L'historique des corrections est conservé au **§ 3**, et les commits sont sur `main`.

**Priorités restantes**

1. **BUG-36** — « Supprimer le patient » détruit les paiements : passer en suppression logique (`is_deleted`).
2. **BUG-30 / BUG-31** — RDV orphelin et données de test à nettoyer.
3. **BUG-33 / BUG-34** — « supprimer » trompeur, suppression d'utilisateur en 500.

---

## 2. Tableau récapitulatif

> Ce tableau ne liste que les **points encore ouverts**. Les bugs traités (BUG-01 → BUG-29) ont été retirés du rapport ; leurs commits figurent au **§ 3**.

| ID | Problème | Gravité | Zone | Effort |
|---|---|---|---|---|
| BUG-30 | RDV orphelin (sans patient, sans service) en base | 🟡 Moyen | Données | XS |
| BUG-31 | Données de test résiduelles en base | 🟡 Moyen | Données | XS |
| BUG-33 | « Supprimer » = suppression logique non signalée | ⚪ Robustesse | Front + Back | S |
| BUG-34 | Suppression d'un utilisateur lié à des RDV → 500 | ⚪ Robustesse | Back | S |
| BUG-36 | Suppression d'un patient : destructrice au lieu d'être logique (`is_deleted`) | 🟠 Majeur | SQL + Back + Front | M |

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

# ⚪ ROBUSTESSE

## BUG-33 — « Supprimer » = suppression logique non signalée

**Constat** : `DELETE /api/appointments/:id` → `UPDATE status='cancelled'` ; `DELETE /api/services/:id` → `is_active=false` ; `DELETE /api/users/:id` → suppression réelle. Trois comportements différents derrière le même verbe, et l'UI parle de « Supprimer » partout.

**Scénario de reproduction**

La gérante supprime un rendez-vous créé par erreur. Un message confirme la suppression et la ligne disparaît de la liste. Plus tard, en consultant le journal d'activité puis les statistiques, elle retrouve ce rendez-vous : il a en réalité été marqué « annulé », et il continue d'apparaître dans certains compteurs ainsi que dans l'historique du patient.

Le même malentendu existe sur les services : « supprimer » un service le désactive sans le retirer de la base, et il continue d'apparaître dans les anciens rendez-vous. Seul l'utilisateur est réellement supprimé. L'utilisateur croit donc à une suppression définitive qui n'a jamais eu lieu — un point problématique pour les demandes RGPD et pour l'interprétation des statistiques.

**Impact** : l'utilisateur croit avoir supprimé alors que l'enregistrement persiste (RGPD, facturation, doublons apparents).
**Correctif** : renommer les actions (« Annuler le RDV », « Désactiver le service ») et réserver « Supprimer » à la suppression réelle.
**Effort** : S

---

## BUG-34 — Suppression d'un utilisateur lié à des RDV → 500

**Constat** : `DELETE /api/users/:id` ne gère pas la violation de clé étrangère (`appointments.practitioner_id`, `session_notes.practitioner_id`, `payments.created_by`).

**Scénario de reproduction**

Un praticien quitte le cabinet. L'administrateur supprime son compte depuis l'écran Administration. L'opération échoue avec « Erreur interne du serveur », sans autre explication : le praticien avait des rendez-vous et des comptes rendus rattachés à son identifiant, et la clé étrangère empêche la suppression.

L'administrateur ne sait pas qu'il doit d'abord réaffecter les rendez-vous, et l'interface ne propose aucune action dans ce sens. Le compte reste actif avec tous ses accès, alors qu'il devrait être neutralisé le jour même du départ.

**Correctif** : soit `ON DELETE SET NULL` sur les FK concernées, soit un 409 explicite (« Ce praticien possède des rendez-vous : réaffectez-les d'abord »).
**Effort** : S

---

# 🟠 MAJEUR

## BUG-36 — « Supprimer le patient » détruit l'historique au lieu de l'archiver

**Zone** : `backend/src/modules/patients.ts` (`DELETE /patients/:id`), schéma `patients`, écrans Patients / Paiements / RDV

**Comportement actuel (mesuré)**

> ⚠️ Depuis la correction de **BUG-02** (commit `e02ef1f`), la suppression de rendez-vous **fonctionne**. La route va donc jusqu'au bout : elle **efface réellement tout** l'historique du patient, sans erreur ni confirmation.

La route serveur supprime les paiements, puis les rendez-vous, puis la fiche — **sans transaction** :

```ts
await query('DELETE FROM payments WHERE patient_id = $1', [id]);      // 1. encaissements effacés
await query('DELETE FROM appointments WHERE id IN (...)', [id]);      // 2. RDV supprimés (OK depuis e02ef1f)
await query('DELETE FROM patients WHERE id = $1', [id]);              // 3. fiche supprimée
```

| Situation du patient | Réponse | Ce qui se passe réellement |
|---|---|---|
| Paiements **+** rendez-vous | **200** | Tout est supprimé : fiche, paiements, RDV, packs, notes, évaluations, motifs, liste d'attente |
| Paiements, **aucun** rendez-vous | **200** | Idem |
| Aucun paiement, des rendez-vous | **200** | Idem |
| Aucun paiement, aucun rendez-vous | **200** | Fiche supprimée |

Simulation complète (transaction annulée) sur un patient sans rendez-vous :

```
AVANT : patient 1 · paiements 1 · packs 1 · évaluations 1 · motifs 1 · liste d'attente 1
APRÈS : patient 0 · paiements 0 · packs 0 · évaluations 0 · motifs 0 · liste d'attente 0
```

Test réel via l'API (patient avec 1 paiement de 1 000 DZD + 1 rendez-vous) :

```
DELETE /api/patients/:id → 200 {"success":true,"message":"Patient deleted successfully"}
patient → 404 · paiements restants → 0 · RDV restants → 0
```

La contrainte `payments_patient_id_fkey` est en `RESTRICT` : la base **protège** normalement les écritures comptables, mais l'application contourne cette protection en supprimant les paiements elle-même.

**Comportement attendu (spécification validée)**

> **Supprimer un patient ne doit rien supprimer.** L'action doit seulement **marquer la fiche comme supprimée**, et le patient disparaît des listes — mais **tout son historique reste en base et reste visible là où il sert de référence.**

**Colonne à créer** : `patients.is_deleted` (booléen, `false` par défaut).

| Module | Comportement attendu |
|---|---|
| **Liste des patients** (`/patients`) | le patient **n'apparaît plus** (filtre `is_deleted = false`) |
| **Sélecteurs de patient** (formulaire RDV, formulaire paiement, liste d'attente) | le patient **n'est plus proposé** (on ne crée pas de nouveaux actes pour un dossier supprimé) |
| **Liste des paiements** | le paiement **reste affiché avec le nom du patient** — le JOIN sur `patients` n'est **pas** filtré |
| **Rendez-vous** (calendrier, liste, compte rendu) | les RDV **restent**, avec le nom du patient |
| **Historique / rapports / exports** | **inchangés**, le nom reste résolu |
| **Fiche patient par URL directe** | reste consultable (lecture seule) avec un bandeau « Dossier supprimé » |
| **Base de données** | `payments`, `appointments`, `appointment_patients`, `session_notes`, `patient_packs`, `patient_pack_usages`, `patient_outcomes`, `patient_motifs` : **aucune ligne supprimée** |
| **Solde / KPI financiers** | **inchangés** (les encaissements restent comptabilisés) |
| **Restauration** | possible : `is_deleted = false` remet le patient dans les listes |

**Conséquences architecturales (avantages)**

1. Plus aucune perte d'écriture comptable, ni de compte rendu, ni d'évaluation.
2. Le trigger `sync_patient_practitioner` étant corrigé (`e02ef1f`), la route supprime réellement les rendez-vous : c'est aujourd'hui qu'elle détruit tout. Avec la suppression logique, elle n'en supprime plus aucun.
3. La contrainte `RESTRICT` de `payments` retrouve son rôle protecteur : elle n'est plus contournée.
4. L'action devient **réversible** et traçable (date + auteur de la suppression).

**Scénario de reproduction**

Une patiente quitte le cabinet et demande que son dossier soit supprimé. La secrétaire clique sur la corbeille, lit « Cette action est irréversible » et confirme. La fiche disparaît : l'opération semble réussie.

Six mois plus tard, lors de la vérification comptable, la gérante ne retrouve plus aucun encaissement au nom de cette patiente : le chiffre d'affaires de l'année a silencieusement diminué d'autant, et il n'existe plus aucune pièce pour justifier les séances réalisées. Ses rendez-vous, comptes rendus, évaluations et packs ont également disparu.

Dans le cas d'un rendez-vous **partagé** (calendrier Coach, plusieurs patients), la suppression emporte le rendez-vous entier et les comptes rendus des autres patients qui y étaient associés.


**Impact**

- **Perte définitive d'écritures comptables, de comptes rendus et d'évaluations** sur une simple action d'interface.
- Chiffre d'affaires et soldes faussés rétroactivement, sans aucun signal.
- La suppression réussit (200) : aucune erreur n'alerte l'utilisateur sur l'ampleur de ce qui vient d'être effacé.
- Action irréversible, sans corbeille ni restauration.
- Effet de bord possible sur les autres patients d'un rendez-vous partagé.

> ⚠️ **Lien avec BUG-02 — corrigé.**
> Le trigger `sync_patient_practitioner` est réparé (commit `e02ef1f`) : la suppression de rendez-vous fonctionne désormais. Conséquence directe : la route `DELETE /patients/:id` **aboutit** et détruit tout l'historique, au lieu d'échouer en 500. Le défaut est donc **plus silencieux qu'avant**, ce qui rend la suppression logique d'autant plus urgente.

**Correctif**

**1. Migration — ajouter la colonne et les traces**

```sql
ALTER TABLE patients
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES users(id);

-- index partiel : les listes ne lisent que les dossiers actifs
CREATE INDEX idx_patients_active ON patients (created_at DESC) WHERE is_deleted = false;
```

**2. Route — remplacer le `DELETE` par un `UPDATE`**

```ts
router.delete('/:id', protect, async (req, res) => {
  const result = await query(
    `UPDATE patients
        SET is_deleted = true, deleted_at = NOW(), deleted_by = $2
      WHERE id = $1 AND is_deleted = false
      RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'Patient introuvable ou déjà supprimé.' });
  }
  await logActivity({ req, action: 'DELETE', resource: 'patient', resourceId: req.params.id });
  return res.status(200).json({ success: true, message: 'Dossier patient archivé.' });
});
```

**3. Backend — filtrer uniquement là où il faut**

| Endpoint | Modification |
|---|---|
| `GET /api/patients` | ajouter `WHERE c.is_deleted = false` |
| `GET /api/patients/paged` | ajouter `AND sub."isDeleted" = false` (exposer `c.is_deleted AS "isDeleted"` dans `baseSelect`) |
| `GET /api/patients/:id` | **ne pas filtrer** — nécessaire pour ouvrir un paiement / RDV / compte rendu ancien |
| `GET /api/payments` | **ne pas filtrer** (JOIN inchangé → le nom reste affiché) |
| `GET /api/appointments` | **ne pas filtrer** (JOIN inchangé) |
| `GET /api/waiting-list` | décision métier : retirer le patient de la file lors de l'archivage |
| Dashboard — « Nouveaux patients » | exclure `is_deleted = true` |
| Dashboard — recettes / séances | **ne pas changer** (les paiements et RDV restent) |

**4. Frontend**

- Texte du dialogue : « **Archiver le dossier** — le patient disparaîtra des listes, mais son historique (paiements, rendez-vous, comptes rendus) restera conservé. » (remplacer « Cette action est irréversible »).
- Bandeau « Dossier supprimé » sur la fiche patient ouverte par URL directe.
- Option de filtre « Afficher les dossiers supprimés » (réservée aux admins) et action « Restaurer le dossier ».
- Les listes Paiements / RDV / Comptes rendus n'affichent **aucun** indicateur bloquant : elles continuent d'afficher le nom.

**5. Reprise des données**

Les patients réellement supprimés avant ce correctif ne peuvent pas être reconstitués (aucune sauvegarde n'a été prise) ; le journal d'activité conserve toutefois les traces de suppression (identifiant + nom dans `activity_logs`).

**Effort** : M

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

> `sql/integrity_fixes.sql` a également été mis à jour : une installation neuve obtient directement la version corrigée du trigger.

### 3.2 Ce qui reste ouvert après ce lot

| Élément | Référence | Statut |
|---|---|---|
| Suppression logique `patients.is_deleted` | BUG-36 | **Ouvert** — la route `DELETE /patients/:id` supprime encore les paiements |
| Affichage du mot de passe provisoire à l'admin | correctif BUG-03 | Amélioration non bloquante |
| Lien évaluation ↔ rendez-vous (`patient_outcomes.appointment_id`) | correctif BUG-07 | Amélioration non bloquante |
| Lien pack ↔ paiement (`payments.pack_id`) | correctif BUG-09 | Amélioration non bloquante (distinguer « vendu » et « encaissé ») |
| Pack auto-créé d'un RDV annulé conservé | correctif BUG-09 | Amélioration non bloquante (nettoyage à décider) |
| `DELETE` de RDV depuis l'interface | — | Toujours impossible côté UI (par conception) |

---

## 4. Plan de correction recommandé

### Lot 1 — Fiabilité des données (1 à 2 jours)
`BUG-36`

### Lot 2 — Finitions et durcissement (2 à 4 jours)
`BUG-30` · `BUG-31` · `BUG-33` · `BUG-34`

### Ordre d'application des migrations SQL restantes

Les migrations des bugs corrigés sont déjà appliquées (voir § 3.1). Reste à préparer :

1. `patients_soft_delete.sql` (BUG-36) — colonne `is_deleted`, index partiel et filtrage des listes

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
