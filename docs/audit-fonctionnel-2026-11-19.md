# Audit fonctionnel & robustesse — BrainCareDZ

> **Nature** : audit **dynamique** (application réelle pilotée dans un navigateur + sondage direct de l'API + vérification en base PostgreSQL). Tous les constats ci-dessous ont été **reproduits**, pas seulement déduits du code.
> **Lecture** : chaque problème est présenté sous forme de **scénario raconté** (qui agit, à quel moment, ce qu'il fait, ce qu'il voit, ce que cela provoque), suivi de l'impact, du correctif technique et de l'effort estimé.
> **État** : **9 corrections** (BUG-01 → BUG-08 + le comptage des packs de BUG-09), poussées sur `main` le 19/11/2026 — détail des commits au **§ 3**. Les 27 autres points restent ouverts.
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

| Gravité | Nombre | Corrigés | Restants |
|---|---|---|---|
| 🔴 Critique | 7 | **7** | 0 |
| 🟠 Majeur | 12 | **2** | 10 |
| 🟡 Moyen | 13 | 0 | 13 |
| ⚪ Robustesse | 4 | 0 | 4 |
| **Total** | **36** | **9** | **27** |

> **État au 19/11/2026** : les 8 premiers bugs (BUG-01 → BUG-08) sont corrigés, testés et poussés sur `main` — détail des commits au **§ 3**.

**Top 5 — état**

1. ✅ **BUG-01** — services des calendriers Admin/Psy : **corrigé** (`52fae77`).
2. ✅ **BUG-02 / BUG-36** — trigger cassé / suppression destructrice : **BUG-02 corrigé** (`e02ef1f`) ; **BUG-36 reste ouvert** (suppression logique `is_deleted` à implémenter).
3. ✅ **BUG-03** — mot de passe provisoire : changement **obligatoire à la première connexion** (`354db31`).
4. ✅ **BUG-05 / BUG-06** — pack différé et packs épuisés : **corrigés** (`d61887a`, `0f34e4c`).
5. ✅ **BUG-04** — totaux de paiements : **corrigés** via agrégat serveur (`9a117d5`).

---

## 2. Tableau récapitulatif

> ✅ **BUG-01 à BUG-09 : corrigés** (commits listés au § 3). Les autres lignes sont ouvertes.

| ID | Problème | Gravité | Zone | Effort |
|---|---|---|---|---|
| BUG-01 | Aucun service sélectionnable dans les calendriers Admin/Psy | 🔴 Critique | Front (`appointment-form.tsx`) | XS |
| BUG-02 | Trigger cassé : suppression de RDV impossible → suppression patient partielle (paiements effacés) | 🔴 Critique | SQL + Back | S |
| BUG-03 | Mot de passe par défaut `123456789` sans changement obligatoire | 🔴 Critique | Back + Front | M |
| BUG-04 | Totaux et KPI calculés sur 100 paiements max | 🔴 Critique | Back + Front | M |
| BUG-05 | Popup « pack obligatoire » contournable par le bouton Retour | 🔴 Critique | Front + Back | M |
| BUG-06 | Pack à 0 séance restante sélectionnable → pack fantôme | 🔴 Critique | Back (`patient-packs.ts`) | S |
| BUG-07 | Statut patient non persisté (colonne `status` à rétablir) + évaluations écrasées | 🔴 Critique | Front + Back + SQL | M |
| BUG-08 | Référence de facture vide ou dupliquée acceptée | 🟠 Majeur | Back + SQL | S |
| BUG-09 | Pack créé automatiquement à la création d'un RDV | 🟠 Majeur | Back (`appointments.ts`) | M |
| BUG-10 | Erreurs utilisateur renvoyées en HTTP 500 | 🟠 Majeur | Back (transversal) | M |
| BUG-11 | Valeurs invalides ignorées en silence (statut, date, rôle) | 🟠 Majeur | Back | S |
| BUG-12 | Aucune borne sur les valeurs métier | 🟠 Majeur | Back + SQL | M |
| BUG-13 | Aucune longueur maximale (nom de 5 000 caractères) | 🟠 Majeur | Front + Back | S |
| BUG-14 | Donut « Canal d'acquisition » sans légende | 🟠 Majeur | Front (`app/page.tsx`) | XS |
| BUG-15 | Noms de services dupliqués autorisés | 🟠 Majeur | SQL | XS |
| BUG-16 | Dérive de données existante (packs, session_count, soldes) | 🟠 Majeur | SQL | M |
| BUG-17 | Garde `beforeunload` impossible à lever sur la page Paiements | 🟠 Majeur | Front (`payments/page.tsx`) | S |
| BUG-18 | Écrire un compte rendu complète le RDV sans confirmation | 🟠 Majeur | Back | S |
| BUG-19 | Faute « A mount of 0 requires notes » | 🟡 Moyen | Back | XS |
| BUG-20 | État vide trompeur quand un filtre ne retourne rien | 🟡 Moyen | Front (`patients/page.tsx`) | XS |
| BUG-21 | « Réinitialiser » n'applique pas la réinitialisation | 🟡 Moyen | Front (`filter-dialog.tsx`) | XS |
| BUG-22 | Date de naissance future → message d'erreur faux | 🟡 Moyen | Front (`patient-form.tsx`) | XS |
| BUG-23 | Message « Créneau complet » faux pour un excès de patients | 🟡 Moyen | Back (`appointments.ts`) | XS |
| BUG-24 | Facture : date non préremplie, TVA ambiguë (montant vs %) | 🟡 Moyen | Front | S |
| BUG-25 | Rafale de 8 appels API avant résolution de l'auth | 🟡 Moyen | Front | S |
| BUG-26 | Page d'édition patient : formulaire vide ~1 s | 🟡 Moyen | Front | XS |
| BUG-27 | Bouton « Nouveau patient » recouvert par la pastille utilisateur | 🟡 Moyen | Front | XS |
| BUG-28 | Messages anglais dans une UI française | 🟡 Moyen | Back | XS |
| BUG-29 | Accessibilité : liens, boutons d'action et labels sans nom | 🟡 Moyen | Front | M |
| BUG-30 | RDV orphelin (sans patient, sans service) en base | 🟡 Moyen | Données | XS |
| BUG-31 | Données de test résiduelles en base | 🟡 Moyen | Données | XS |
| BUG-32 | Aucune contrainte `EXCLUDE` anti double réservation | ⚪ Robustesse | SQL | M |
| BUG-33 | « Supprimer » = suppression logique non signalée | ⚪ Robustesse | Front + Back | S |
| BUG-34 | Suppression d'un utilisateur lié à des RDV → 500 | ⚪ Robustesse | Back | S |
| BUG-35 | `duration = 0` contourne le CHECK via NULL | ⚪ Robustesse | Back | XS |
| BUG-36 | Suppression d'un patient : destructrice au lieu d'être logique (`is_deleted`) | 🟠 Majeur | SQL + Back + Front | M |

---

# 🔴 CRITIQUE

## BUG-01 — Aucun service sélectionnable dans les calendriers Admin et Psy

> ✅ **CORRIGÉ** — commit `52fae77` (19/11/2026). Le filtre `s.type === 'psy'` est supprimé : tous les services actifs sont proposés quel que soit le calendrier. Vérifié sur les calendriers Admin, Psy et Coach.

**Zone** : `components/appointment-form.tsx` (lignes 109-114)

**Constat**
La liste des services est filtrée sur une valeur de `type` qui n'existe pas :

```ts
const filteredServices = useMemo(() => {
  if (formData.preferredRole === 'admin' || formData.preferredRole === 'psy') {
    return validServices.filter((s) => s.type === 'psy');   // <-- aucun service n'a type = 'psy'
  }
  return validServices;
}, [validServices, formData.preferredRole]);
```

Les services ont `type ∈ {'consultation', 'neurofeedback'}` (contrainte `services_type_check`). Le filtre retourne donc **toujours un tableau vide**.

**Scénario de reproduction**

En fin de matinée, l'assistante ouvre l'agenda et reste sur le calendrier « Admin », celui qu'elle utilise tous les jours pour les consultations classiques. Un patient vient d'être créé au téléphone et n'a encore acheté aucun pack : elle clique sur le créneau de 10 h 00 pour lui poser son premier rendez-vous, le sélectionne dans la liste des patients, puis ouvre le menu déroulant « Service ».

Le menu s'affiche bien, la rubrique « Packs en cours » apparaît en tête — mais elle est vide, puisque le patient n'a pas de pack. La rubrique « Autres services », qui devrait proposer « Consultation classique », « NeuroFeedback 8 » ou « NeuroFeedback 20 », ne contient quant à elle aucune entrée. Aucun service n'est sélectionnable et le bouton « Créer le rendez-vous » reste inutilisable.

Intriguée, l'assistante bascule sur le calendrier « Coach » et refait exactement les mêmes gestes : cette fois, une dizaine de services s'affichent normalement. Le défaut est donc propre aux calendriers Admin et Psy, ce qui la contraint soit à enregistrer le rendez-vous sur le mauvais calendrier avant de le déplacer, soit à demander à un collègue disposant du calendrier Coach de le créer à sa place.

**Impact**
Un nouveau patient sans pack ne peut pas être planifié sur les calendriers Admin et Psy, qui sont les calendriers principaux. Contournement actuel : passer par le calendrier Coach.

**Correctif**
Supprimer le filtre par rôle (le type de service n'a pas de lien avec le rôle), ou filtrer par les services réellement associés au praticien via `practitioner_services` :

```ts
// Option A (simple) : tous les services actifs
const filteredServices = validServices;

// Option B (si le rattachement praticien est voulu)
const filteredServices = useMemo(() => {
  const ids = new Set(practitionerServiceIds);       // chargé depuis /api/users/:id
  return ids.size ? validServices.filter(s => ids.has(s.id)) : validServices;
}, [validServices, practitionerServiceIds]);
```

**Test de non-régression**
Créer un RDV sur les 3 calendriers (Admin, Psy, Coach) avec un patient **sans aucun pack** : la liste doit proposer au moins les services actifs.

**Effort** : XS

---

## BUG-02 — Trigger cassé : suppression de RDV impossible → suppression de patient partielle

> ✅ **CORRIGÉ** — commit `e02ef1f` (19/11/2026). Trigger scindé : `AFTER INSERT/UPDATE` pour le recalcul, `BEFORE DELETE` pour la suppression (jonction encore lisible), plus une synchronisation sur `appointment_patients` pour la création. Vérifié sur 6 scénarios (création, annulation, réactivation, suppression, dernier RDV).
>
> ⚠️ **BUG-36 reste ouvert** : la route `DELETE /patients/:id` supprime toujours les paiements avant d'échouer. La correction du trigger ne dispense pas de la suppression logique.

**Zone** : fonction `sync_patient_practitioner()` (base + `backend/src/db/schema.ts`) + `backend/src/modules/patients.ts` (`DELETE /patients/:id`)

**Constat**

Le bouton « Supprimer le patient » **est bien exposé dans l'interface** — et c'est lui qui déclenche le bug. La route serveur exécute trois suppressions successives, **sans transaction** :

```ts
await query('DELETE FROM payments WHERE patient_id = $1', [id]);              // 1. ça passe
await query('DELETE FROM appointments WHERE id IN (...)', [id]);              // 2. ça explose (trigger)
await query('DELETE FROM patients WHERE id = $1', [id]);                      // 3. jamais atteint
```

L'étape 2 échoue parce que la branche `DELETE` du trigger `trg_sync_patient_practitioner` est **doublement inopérante** :

1. **Erreur SQL** : elle référence `a.patient_id`, colonne qui n'existe plus dans `appointments` (déplacée vers `appointment_patients`) → erreur `42703`.
2. **Piège de la cascade** : même réécrite en `ap.patient_id`, elle ne verrait rien. La contrainte `appointment_patients.appointment_id → appointments ON DELETE CASCADE` s'exécute **avant** les triggers utilisateur `AFTER DELETE` (les triggers d'intégrité référentielle, nommés `RI_ConstraintTrigger…`, passent avant `trg_…` par ordre alphabétique). Les lignes de jonction ont donc **déjà disparu** quand la fonction s'exécute.

Mesures effectuées (transaction annulée) :

| Contexte | `count(*)` sur `appointment_patients WHERE appointment_id = OLD.id` |
|---|---|
| Trigger `AFTER DELETE` (situation actuelle) | **0 ligne** |
| Trigger `BEFORE DELETE` | **1 ligne** |

**Résultat réel d'un clic sur « Supprimer le patient »** (reproduit sur un patient de test avec 1 paiement de 1 000 DZD et 1 rendez-vous) :

| Étape | Résultat mesuré |
|---|---|
| Réponse HTTP | **500** « Erreur interne du serveur » |
| Paiements du patient | **0** (effacés) |
| Rendez-vous | **toujours présent** |
| Fiche patient | **toujours présente** |
| Solde | passé de 1 000 à **0** (le paiement a disparu) |

Autrement dit : l'opération détruit l'historique financier du patient, puis s'arrête en erreur — le patient reste, sans ses paiements.

**Point important — ce n'est pas le chemin `DELETE CASCADE` d'un patient**

Les cascades réelles (relevées dans `pg_constraint`) sont : `appointment_patients.patient_id → patients` (CASCADE), `patient_packs.patient_id → patients` (CASCADE), `session_notes.appointment_patient_id → appointment_patients` (CASCADE), `patient_pack_usages.appointment_patient_id → appointment_patients` (CASCADE). **Aucune FK ne relie `appointments` à `patients`** : les rendez-vous ne sont donc **jamais** supprimés automatiquement avec le patient — d'où la suppression explicite dans la route, qui est justement celle qui casse.

Extrait fautif (branche `DELETE`) :

```sql
IF TG_OP = 'DELETE' THEN
  UPDATE patients p SET practitioner_id = sub.new_prac
  FROM (
    SELECT ap.patient_id, (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE a.status NOT IN ('cancelled')
      AND a.patient_id IN (SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id)
      --  ^^^^^^^^^^^^^ n'existe pas (et la jonction est déjà vide ici)
    GROUP BY ap.patient_id
  ) sub ...
```

Erreur reproduite en base : `error: la colonne a.patient_id n'existe pas (fonction sync_patient_practitioner, ligne 20) — SQLSTATE 42703`.

**Scénario de reproduction**

> ⚠️ Ce scénario décrit le **code actuel** (avant application de la suppression logique décrite dans **BUG-36**). Après le correctif `is_deleted`, la route ne supprime plus rien : ni paiement, ni rendez-vous — ce scénario ne se produit donc plus.

Une patiente demande la suppression complète de son dossier. La secrétaire ouvre sa fiche, clique sur la corbeille, lit le message d'avertissement « Cette action est irréversible » et confirme. L'opération échoue avec « Erreur interne du serveur » : la fiche reste affichée, apparemment intacte. La secrétaire réessaie deux fois, sans plus de succès, puis passe à autre chose en pensant à un incident passager.

En réalité, l'opération a **déjà détruit quelque chose** : le serveur supprime d'abord tous les paiements de la patiente, puis tente de supprimer ses rendez-vous — c'est cette deuxième étape qui plante. Le solde de la patiente tombe à 0, son historique de règlements disparaît, mais sa fiche et ses rendez-vous restent. Personne ne le remarque avant la comptabilité de fin de mois, où le chiffre d'affaires ne correspond plus à aucun encaissement.

Le même blocage apparaît dès qu'un script de maintenance, une restauration partielle ou la future fonction « supprimer définitivement » tente de supprimer un rendez-vous : la table `appointments` est **impossible à purger**, et les triggers d'audit de suppression ne s'exécutent jamais.

**Impact**
- **Perte de données financières irréversible** : les paiements du patient sont supprimés avant l'échec, sans transaction pour revenir en arrière.
- La suppression de patient renvoie systématiquement **500** dès qu'il possède au moins un rendez-vous.
- Le patient conserve ses rendez-vous, mais son solde et son historique de paiements sont faux.
- Toute purge de données (RGPD, script de nettoyage, restauration) **échoue**.
- Les triggers d'audit sur DELETE ne s'exécutent jamais : aucune trace de ces suppressions.
- 👉 La bascule en **suppression logique** (BUG-36) fait disparaître ce chemin du parcours utilisateur : la route ne supprimera plus de rendez-vous. Le correctif du trigger reste néanmoins nécessaire pour les scripts de maintenance.

**Correctif**
⚠️ **Le correctif « évident » (remplacer `a.patient_id` par `ap.patient_id`) ne fonctionne pas** : la fonction trouverait 0 ligne et ne ferait rien, silencieusement. Il faut **séparer les deux chemins** et déplacer la branche `DELETE` dans un trigger `BEFORE DELETE`, seul endroit où la jonction existe encore.

Et **indépendamment du trigger**, la suppression doit être atomique :

```ts
// backend/src/modules/patients.ts
router.delete('/:id', protect, async (req, res) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // ... suppressions dans l'ordre (notes, usages, jonction, RDV, packs, patient)
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');   // ← jamais de suppression partielle
    return res.status(500).json({ success: false, message: 'Suppression impossible.' });
  } finally {
    client.release();
  }
});
```

```sql
-- 1) INSERT / UPDATE : inchangés, en AFTER (la ligne est visible)
CREATE OR REPLACE FUNCTION sync_patient_practitioner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE patients p SET practitioner_id = sub.new_prac
  FROM (
    SELECT ap.patient_id,
           (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE a.status <> 'cancelled' AND a.id = NEW.id
    GROUP BY ap.patient_id
  ) sub
  WHERE p.id = sub.patient_id
    AND p.practitioner_id IS DISTINCT FROM sub.new_prac;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_practitioner ON appointments;
CREATE TRIGGER trg_sync_patient_practitioner
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION sync_patient_practitioner();

-- 2) DELETE : en BEFORE, la jonction est encore lisible
CREATE OR REPLACE FUNCTION sync_patient_practitioner_on_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- nouveau praticien = dernier RDV restant (hors celui qu'on supprime)
  UPDATE patients p SET practitioner_id = r.new_prac
  FROM (
    SELECT ap.patient_id,
           (ARRAY_AGG(a.practitioner_id ORDER BY a.start_time DESC))[1] AS new_prac
    FROM appointments a
    JOIN appointment_patients ap ON ap.appointment_id = a.id
    WHERE a.status <> 'cancelled'
      AND a.id <> OLD.id
      AND ap.patient_id IN (SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id)
    GROUP BY ap.patient_id
  ) r
  WHERE p.id = r.patient_id
    AND p.practitioner_id IS DISTINCT FROM r.new_prac;

  -- patients qui n'ont plus aucun RDV actif -> NULL
  UPDATE patients p SET practitioner_id = NULL
  WHERE p.id IN (SELECT patient_id FROM appointment_patients WHERE appointment_id = OLD.id)
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      JOIN appointment_patients ap ON ap.appointment_id = a.id
      WHERE ap.patient_id = p.id AND a.id <> OLD.id AND a.status <> 'cancelled'
    );

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_sync_patient_practitioner_del
  BEFORE DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION sync_patient_practitioner_on_delete();
```

Appliquer **dans les deux endroits** : migration `sql/fix_sync_patient_practitioner.sql` **et** le bloc de création contenu dans `backend/src/db/schema.ts` (sinon `ensureSchema()` réécrira l'ancienne version au prochain démarrage).

**Test de non-régression**
```sql
BEGIN;
-- patient avec 2 RDV, praticien A puis B (le plus récent = B)
-- supprimer le RDV le plus récent -> le patient doit repasser sur le praticien A
DELETE FROM appointments WHERE id = '<rdv_le_plus_recent>';
SELECT practitioner_id FROM patients WHERE id = '<patient>';   -- attendu : praticien A
-- supprimer le dernier RDV -> practitioner_id doit devenir NULL
ROLLBACK;
```
Et vérifier qu'un `DELETE` de RDV **ne lève plus d'erreur 42703**. Garder aussi le test « aucun RDV restant → `practitioner_id IS NULL` » (aujourd'hui la branche ne s'exécute jamais).

**Effort** : S (M si l'on ajoute les tests SQL ci-dessus)

---

## BUG-03 — Mot de passe par défaut `123456789` sans changement obligatoire

> ✅ **CORRIGÉ** — commit `354db31` (19/11/2026). Le mot de passe provisoire `123456789` est conservé, mais la première connexion impose son remplacement : colonne `must_change_password`, middleware qui bloque toutes les routes (403 `PASSWORD_CHANGE_REQUIRED`), écran `/change-password` bloquant.
>
> ⚠️ Reste à faire (non bloquant) : afficher le mot de passe provisoire à l'administrateur après création et ajouter un badge « changement requis » dans la liste des utilisateurs.

**Zone** : `backend/src/modules/users.ts` (ligne 122), `backend/src/modules/auth.ts`, `backend/src/middleware/auth.ts`, écran de connexion

**Constat**
```ts
const passwordHash = await bcryptjs.hash('123456789', 10);
```
Tout compte créé depuis l'écran Administration reçoit **le même mot de passe connu**, sans obligation de changement. Vérifié : création d'un utilisateur `audit_psy` puis `POST /api/auth/login { pseudo: 'audit_psy', password: '123456789' }` → **200**, accès immédiat à toutes les données.

> **Décision retenue** : le mot de passe par défaut `123456789` est **conservé** (pratique pour le cabinet), mais la **première connexion doit imposer son remplacement**. C'est l'absence de cette obligation — pas la valeur du mot de passe — qui constitue la faille.

**Scénario de reproduction**

L'administrateur crée un compte pour une nouvelle psychologue : il renseigne son prénom, son nom et le rôle « Psy », puis valide. L'écran se ferme sans jamais afficher de mot de passe — aucune information n'est donnée sur la façon dont la praticienne va se connecter.

Le lendemain, cette dernière appelle : elle ne parvient pas à entrer. Plutôt que de contacter l'administrateur, n'importe qui connaissant la règle de nommage (`prenom_nom`, affiché en clair dans la liste des utilisateurs et dans le journal d'activité) peut tenter le mot de passe `123456789`. La connexion est acceptée du premier coup, avec les droits Psy : accès aux dossiers patients, aux comptes rendus et aux soldes. Et le mot de passe reste valable **indéfiniment** si la praticienne ne se connecte jamais.

**Impact**
- Toute personne connaissant le pseudo (visible dans le journal d'audit et dans les listes) peut se connecter avec un mot de passe public.
- Le compte reste vulnérable **tant que le collaborateur ne s'est pas connecté** — d'où la nécessité de rendre le remplacement obligatoire.
- En cas de fuite de la base, tous les comptes créés ainsi sont compromis simultanément.

**Correctif**

1. **Ajouter le drapeau en base**

```sql
ALTER TABLE users
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- les comptes déjà existants restent utilisables sans changement
-- (seuls les comptes créés après la mise en service porteront le drapeau)
```

2. **Marquer les nouveaux comptes** (`backend/src/modules/users.ts`) — le mot de passe reste `123456789` :

```ts
const passwordHash = await bcryptjs.hash('123456789', 10);
await query(
  `INSERT INTO users (name, pseudo, first_name, last_name, email, password_hash, role, phone, must_change_password)
   VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, true)`,
  [name, pseudo, first, last, passwordHash, role, phone || null]
);
```

3. **Exposer le drapeau à la connexion** (`backend/src/modules/auth.ts`) :

```ts
return res.status(200).json({
  success: true,
  user: safeUser,
  mustChangePassword: user.must_change_password === true,
});
```

4. **Bloquer toutes les routes tant que le mot de passe n'est pas changé** (`backend/src/middleware/auth.ts`). Le middleware lit déjà `token_version` en base : ajouter la colonne à la requête et refuser :

```ts
const check = await runOnClient(ctx,
  'SELECT token_version, must_change_password FROM users WHERE id = $1', [decoded.id]);

req.user.mustChangePassword = check.rows[0].must_change_password === true;

const ALLOWED = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];
if (req.user.mustChangePassword && !ALLOWED.includes(req.originalUrl.split('?')[0])) {
  return res.status(403).json({
    success: false,
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'Vous devez changer votre mot de passe avant de continuer.',
  });
}
```

5. **Créer l'endpoint de changement** (à défaut, réutiliser `PUT /api/users/me/password` qui existe déjà et exige le mot de passe actuel) :

```ts
router.post('/change-password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcryptjs.compare(currentPassword, rows[0].password_hash))) {
    return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }
  if (await bcryptjs.compare(newPassword, rows[0].password_hash)) {
    return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit être différent du mot de passe provisoire.' });
  }

  const hash = await bcryptjs.hash(newPassword, 10);
  await query(
    `UPDATE users
        SET password_hash = $2, must_change_password = false, token_version = token_version + 1
      WHERE id = $1`,
    [req.user.id, hash]
  );
  // réémettre le cookie avec le nouveau token_version
});
```

6. **Écran bloquant côté frontend** : après connexion, si `mustChangePassword` est vrai → redirection vers `/auth/change-password` (deux champs : mot de passe provisoire + nouveau mot de passe, aucun bouton « ignorer », seule sortie possible : se déconnecter). Le même écran doit s'afficher si n'importe quel appel API renvoie `PASSWORD_CHANGE_REQUIRED`.

7. **Afficher le mot de passe provisoire à l'administrateur** après création (encart « Mot de passe provisoire : `123456789` — le collaborateur devra le changer à sa première connexion »), et un badge « Changement requis » dans la liste des utilisateurs.

**Effort** : M

**Test de non-régression**
- Créer un utilisateur → `POST /api/auth/login` avec `123456789` → **200** + `mustChangePassword: true`.
- Appeler n'importe quelle route métier (`GET /api/patients`) → **403 `PASSWORD_CHANGE_REQUIRED`**.
- Changer le mot de passe → **200**, puis `GET /api/patients` → **200**.
- Se reconnecter avec `123456789` → **401** ; avec le nouveau mot de passe → **200**.
- Vérifier qu'un compte **existant** (drapeau à `false`) n'est pas bloqué.

---

> **Risque résiduel (accepté)** : entre la création du compte et la première connexion, le mot de passe reste `123456789`. Mitigations recommandées : journaliser chaque connexion, limiter les tentatives (déjà en place : 10 / 15 min), et permettre à l'administrateur de **régénérer** le mot de passe provisoire si le collaborateur ne s'est jamais connecté.

---

## BUG-04 — Totaux et KPI calculés sur une liste tronquée à 100 paiements

> ✅ **CORRIGÉ** — commit `9a117d5` (19/11/2026). Nouvel endpoint `GET /api/payments/summary` (COUNT + SUM calculés en SQL, filtres `from`/`to`/`patientId`). La page Paiements affiche le total exact et signale « Affichage des N derniers paiements sur X » ; le tableau de bord utilise le même agrégat pour « Recette du mois » et « Recettes du jour ».

**Zone** : `backend/src/modules/payments.ts` (ligne 30) + `app/payments/page.tsx` + `app/page.tsx`

**Constat**
```ts
const limit = patientId ? 1000 : 100;   // GET /api/payments sans patientId
```
La page Paiements affiche ensuite :

```tsx
<p className="text-sm text-gray-500">Total ({filteredPayments.length === payments.length ? 'tous' : 'filtré'})</p>
<p className="text-xl font-bold">{formatAmount(totalFiltered)} DZD</p>
```

Le « **Total (tous)** » ne couvre donc que les **100 derniers paiements**, sans aucune indication de troncature. Le tableau de bord calcule de la même façon « Recette du mois / du jour », « Packs vendus », « Séances effectuées » à partir de listes plafonnées (`appointments` 2 000, `packs` 1 000, `patients` 2 000).

> ⚠️ **Ce n'est pas la pagination de l'interface.** Le découpage en pages (`usePagination`) s'applique à une liste **déjà reçue en entier** ; ici, la troncature a lieu **dans la requête SQL** (`LIMIT 100`), avant même que le frontend ne reçoive les données. Le front n'a donc aucun moyen de savoir qu'il lui manque des lignes.

**Scénario de reproduction**

Le cabinet tourne depuis plusieurs mois et la table `payments` dépasse la centaine de lignes. En fin de trimestre, la gérante ouvre la page Paiements pour préparer sa déclaration et lit en bas de liste : « Total (tous) — 612 000 DZD ». Elle recopie ce montant dans son tableur.

En réalité, l'API n'a renvoyé que les cent paiements les plus récents : les vingt encaissements les plus anciens du trimestre — soit 95 000 DZD — ne sont pas comptés, et rien à l'écran ne signale la troncature. Le même phénomène touche le tableau de bord, dont les tuiles « Recette du mois », « Packs vendus » et « Séances effectuées » sont calculées sur ces listes plafonnées. Le chiffre d'affaires déclaré est faux, sans qu'aucun message d'avertissement n'ait été affiché.

**Impact**
Chiffre d'affaires sous-estimé, KPI faux, décisions financières prises sur des totaux erronés — **silencieusement**.

**Correctif**
- Ajouter un endpoint d'agrégation serveur : `GET /api/payments/summary?from=&to=` renvoyant `{ count, total, byMethod, byStatus }` calculé en SQL (`SUM`, `COUNT`), indépendant de la pagination.
- Idem pour le dashboard : `GET /api/dashboard/kpis?month=` qui renvoie les agrégats déjà calculés, au lieu de télécharger toutes les lignes et de les additionner côté client.
- Afficher explicitement `X résultats sur Y` quand un plafond s'applique.

```ts
// backend/src/modules/payments.ts
router.get('/summary', protect, async (req, res) => {
  const { from, to } = req.query;
  const r = await query(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total
       FROM payments
      WHERE status = 'completed'
        AND ($1::date IS NULL OR processed_date >= $1)
        AND ($2::date IS NULL OR processed_date < ($2::date + 1))`,
    [from || null, to || null]
  );
  res.json({ success: true, data: r.rows[0] });
});
```

**Effort** : M

---

## BUG-05 — Popup « pack obligatoire » contournable par le bouton Retour

> ✅ **CORRIGÉ** — commit `d61887a` (19/11/2026). Invariant serveur : `PUT /appointments/:id/complete` (et le passage en `completed` via `PUT /appointments/:id`) renvoie **409 `PACK_REQUIRED`** tant qu'aucun pack n'est sélectionné. Côté front, la clôture n'est plus envoyée avant le choix du pack, et la popup se rouvre automatiquement pour les dossiers hérités (`completed` + `packDeferred` + `packSelected = false`).

**Zone** : `app/appointments/[id]/report/page.tsx` (`handleSaveAll`, `handleGoBack`) + `backend/src/modules/patient-packs.ts`

**Constat**
La popup de sélection du pack est déclarée « non contournable » (`showCloseButton={false}`, `onEscapeKeyDown` et `onInteractOutside` bloqués) — mais **le bouton Retour du navigateur passe**.

**Scénario de reproduction**

Une nouvelle patiente vient pour sa première séance. Comme elle n'a pas encore choisi son pack, le rendez-vous a été créé avec l'option « Sélectionner le pack après la séance ». À la fin de la consultation, le praticien rédige son compte rendu et clique sur « Enregistrer » : la fenêtre « Sélectionner le pack » s'ouvre, sans croix de fermeture, et la touche Échap ne la ferme pas — le blocage semble total.

Mais le praticien change d'avis, ou clique simplement sur le bouton « Retour » de son navigateur pour vérifier une information. La page se ferme sans aucun avertissement. En base, le rendez-vous est pourtant passé en « terminé », avec `pack_deferred = true`, sans service, sans pack associé et sans le moindre débit : **la séance est offerte**. En rouvrant plus tard le compte rendu, la fenêtre ne réapparaît pas, puisque celle-ci n'est déclenchée qu'au moment de l'enregistrement. Personne ne s'apercevra de l'anomalie avant un contrôle comptable.

**Impact**
Séance **offerte** (aucun débit du solde ni du pack) et dossier incohérent : séance terminée sans prestation associée. Aucun mécanisme de rattrapage ne signale l'anomalie.

**Correctif (deux niveaux)**

1. **Invariant serveur** (indispensable) : refuser la complétion d'un RDV `pack_deferred` sans pack associé.

```ts
// avant de marquer le RDV completed
const missing = await query(
  `SELECT ap.id FROM appointment_patients ap
    JOIN appointments a ON a.id = ap.appointment_id
    WHERE a.id = $1 AND a.pack_deferred = TRUE
      AND NOT EXISTS (SELECT 1 FROM patient_pack_usages u WHERE u.appointment_patient_id = ap.id)`,
  [appointmentId]
);
if (missing.rowCount > 0) {
  return res.status(409).json({
    success: false,
    code: 'PACK_REQUIRED',
    message: 'Sélectionnez le pack du patient avant de clôturer cette séance.',
  });
}
```

2. **Front** : rouvrir automatiquement la popup au chargement si
   `appointment.packDeferred && appointment.status === 'completed' && !patient.packSelected`,
   puis bloquer la navigation (`beforeunload` + interception du router) tant que non résolu.
3. Ajouter un indicateur « Pack à sélectionner » dans la liste des RDV pour retrouver ces dossiers.

**Effort** : M

---

## BUG-06 — Pack à 0 séance restante sélectionnable → pack fantôme

> ✅ **CORRIGÉ** — commit `0f34e4c` (19/11/2026). Les packs `remaining_sessions <= 0` ne sont plus proposés (formulaire RDV et popup du compte rendu) ; la décrémentation est conditionnelle (`WHERE remaining_sessions > 0`, 409 `PACK_DEPLETED` sinon) et deux contraintes bornent la table : `total_sessions > 0` et `0 ≤ remaining_sessions ≤ total_sessions`.

**Zone** : `backend/src/modules/patient-packs.ts` (`POST /select`), `app/appointments/[id]/report/page.tsx`

**Constat**
L'API `GET /api/patient-packs/patient/:patientId` renvoie **tous** les packs du patient, sans filtrer sur `remaining_sessions` :

```ts
const result = await query(`${packSelect} WHERE pp.patient_id = $1 ORDER BY pp.created_at DESC`, [patientId]);
```

Vérifié sur un patient réel (`test count`) : l'API renvoie bien `Consultation classique — 0 / 1`. La popup de sélection affiche donc des packs **épuisés** :

```
Consultation classique — 0/1 séances restantes — 3 000 DZD
test 2 — 0/2 séances restantes — 20 000 DZD
```

⚠️ **Nuance** : la **liste des patients** ne montre jamais ces packs, car ses jointures latérales filtrent explicitement `remaining_sessions > 0` (`backend/src/modules/patients.ts`, lignes 179 et 222). Le problème est donc limité à deux écrans qui consomment l'API brute : le **formulaire de rendez-vous** (section « Packs en cours ») et la **popup de sélection du pack** (compte rendu).

En sélectionnant « Consultation classique 0/1 », l'API **crée un nouveau pack** (`total = 1`, `remaining = 1`) puis débite la séance (`remaining = 0`). Résultat en base : **deux packs `0/1`** pour le même patient et le même service, et aucune erreur affichée.

**Scénario de reproduction**

Une patiente a épuisé son pack de dix séances : sa fiche indique « 0/10 séances restantes ». Elle revient pour une séance supplémentaire, le praticien ouvre le compte rendu puis la fenêtre de sélection du pack. Celle-ci propose toujours « Consultation classique — 0/1 séances restantes » parmi les choix, ce qui laisse penser qu'il s'agit simplement du pack existant.

Le praticien valide. L'application ne signale aucune erreur : elle crée en réalité **un nouveau pack**, dont le total vaut 1, puis y débite immédiatement la séance, ce qui donne un pack à 0 séance restante. En ouvrant l'onglet « Packs » de la patiente, on découvre deux packs identiques à zéro séance, sans aucune explication. Les compteurs de séances et l'historique de consommation deviennent incohérents, et le solde affiché ne correspond plus aux prestations réellement réalisées.

**Impact**
Packs fantômes, compteur de séances incohérent, base polluée ; le patient peut « consommer » une séance inexistante sans que le solde soit correctement débité.

**Correctif**
1. Ne pas proposer les packs `remaining_sessions <= 0` dans le sélecteur.
2. Côté API, vérifier avant toute écriture :

```ts
const usable = await query(
  `SELECT id, remaining_sessions, total_sessions
     FROM patient_packs
    WHERE patient_id = $1 AND service_id = $2
    ORDER BY created_at DESC LIMIT 1`,
  [patientId, serviceId]
);
if (usable.rowCount === 0 || usable.rows[0].remaining_sessions <= 0) {
  return res.status(409).json({
    success: false,
    code: 'PACK_DEPLETED',
    message: 'Ce pack est épuisé. Sélectionnez un autre pack ou créez-en un nouveau.',
  });
}
```

3. Contrainte en base : `CHECK (remaining_sessions BETWEEN 0 AND total_sessions)`.

**Effort** : S

---

## BUG-07 — Statut patient non persisté (colonne `status` à rétablir) + évaluations écrasées

> ✅ **CORRIGÉ** — commit `41b872f` (19/11/2026). Colonne `patients.status` rétablie (CHECK `En cours / Terminé / Abandon`), persistée par `POST` et `PUT` ; le motif d'abandon devient obligatoire avec « Abandon » et est effacé sinon. La dernière évaluation est exposée dans `baseSelect` (préremplissage) et une ligne `patient_outcomes` n'est plus créée que si une valeur réelle est saisie.
>
> ⚠️ Reste à faire (non bloquant) : rattacher chaque évaluation à son rendez-vous (`patient_outcomes.appointment_id`) et mettre à jour la ligne existante au lieu d'en ajouter une.

**Zone** : `app/appointments/[id]/report/page.tsx`, `backend/src/modules/patients.ts` (`baseSelect`, `recordOutcome`), schéma `patients`

**Constat**
1. Le compte rendu propose encore un sélecteur **Statut patient** (`En cours / Terminé / Abandon`) et l'envoie dans `patientsApi.update(id, { status })`. Or la colonne `patients.status` **a été supprimée du schéma** → la valeur est ignorée en silence. Le champ ne sert à rien. **Correctif retenu : rétablir la colonne** (voir plus bas), pas supprimer le champ.
2. Les champs d'évaluation sont chargés depuis `p.perceivedImprovement`, `p.globalSatisfaction`, etc. Mais `baseSelect` **n'expose pas ces champs** (ils vivent uniquement dans `patient_outcomes`) → les champs apparaissent **vides** même quand une évaluation existe.
3. Chaque enregistrement crée **une nouvelle ligne** `patient_outcomes` avec les valeurs du formulaire… donc possiblement `NULL`/`false` : les évaluations précédentes sont écrasées, l'historique se remplit de lignes vides. Vérifié : 2 lignes ajoutées avec `perceived_improvement = NULL`.
4. **La condition d'insertion est toujours vraie** : `recordOutcome` teste `wouldRecommend !== undefined`, or le frontend envoie systématiquement `wouldRecommend: false` → une ligne est insérée **à chaque enregistrement**, même si le praticien n'a touché à aucun champ d'évaluation.
5. **Le motif d'abandon survit sans le statut** : `abandonReason` est toujours enregistré (la colonne existe), mais le statut « Abandon » ne l'est plus. On obtient des dossiers avec une raison d'abandon… et aucun abandon.
6. **Aucun lien avec la séance** : `patient_outcomes` ne contient pas d'`appointment_id`. Impossible de savoir de quelle consultation provient une évaluation, ni de rattacher l'historique au rendez-vous.
7. **Aucune borne côté API** : le champ HTML porte `min={0} max={10}`, mais ce n'est qu'une aide visuelle — l'API accepte `999` et `-5` (voir BUG-12).

**Scénario de reproduction**

Un praticien rouvre le compte rendu d'une séance déjà clôturée pour y ajouter une précision. Il constate que les champs « Statut », « Amélioration », « Satisfaction » et « Recommande » sont vides, alors qu'il avait renseigné une amélioration de 7/10 et une satisfaction de 4/5 lors de la séance précédente.

Il corrige uniquement le texte du compte rendu et clique sur « Enregistrer » pour ne rien perdre. L'application enregistre alors une nouvelle évaluation avec des valeurs vides et « Recommande = Non », alors même qu'il n'a rien modifié dans ces champs. L'historique clinique de la patiente se remplit peu à peu de lignes sans contenu, et les moyennes d'amélioration affichées sur sa fiche sont tirées vers le bas.

En parallèle, le sélecteur « Statut patient », qu'il manipule sans effet, ne change rien : la colonne correspondante n'existe plus en base, la valeur est acceptée puis ignorée en silence. Le praticien croit avoir mis le dossier à jour, mais son action n'a produit aucun effet mesurable.

**Impact**
Perte d'historique clinique et statistiques faussées (moyennes d'amélioration/satisfaction calculées sur des lignes vides).

**Correctif**

> **Décision retenue** : on **conserve le champ « Statut »** dans le compte rendu. Il faut donc **rétablir la colonne** `patients.status` supprimée par erreur, et la rendre réellement persistée.

**1. Migration — rétablir la colonne**

```sql
ALTER TABLE patients
  ADD COLUMN status varchar(20)
  CHECK (status IS NULL OR status IN ('En cours', 'Terminé', 'Abandon'));

-- facultatif : marquer les dossiers existants comme « En cours »
UPDATE patients SET status = 'En cours' WHERE status IS NULL;
```

`abandon_reason` reste inchangée : elle complète le statut « Abandon ».

**2. Backend — persister la valeur**

`POST /api/patients` et `PUT /api/patients/:id` doivent accepter `status` et l'écrire :

```ts
// PUT /patients/:id
const statusValue = status === '' || status === undefined ? null : status;
if (statusValue && !['En cours', 'Terminé', 'Abandon'].includes(statusValue)) {
  return res.status(400).json({ success: false, message: 'Statut patient invalide.' });
}

await query(
  `UPDATE patients SET
     ...
     status = $n,
     abandon_reason = CASE WHEN $n = 'Abandon' THEN $m ELSE NULL END,
     ...
   WHERE id = $1`,
  [id, ..., statusValue, abandonReason]
);
```

**3. Exposer le statut dans `baseSelect`**

```sql
c.status AS "status",
c.abandon_reason AS "abandonReason",
```

**4. Frontend — garder le sélecteur tel quel**

Aucune suppression d'UI : le composant envoie déjà `status: evoStatus`. Il suffit qu'il soit prérempli (`p.status`) et que la valeur vide soit normalisée (`''` → `null`).

**5. Règle de cohérence**

| Statut choisi | Motif d'abandon |
|---|---|
| `Abandon` | obligatoire (validation 400 s'il est vide) |
| `En cours` / `Terminé` | effacé automatiquement (`abandon_reason = NULL`) |

**6. Corriger les évaluations (indépendant du statut)**

- Exposer la **dernière** évaluation dans `baseSelect` :

```sql
LEFT JOIN LATERAL (
  SELECT perceived_improvement AS "perceivedImprovement",
         global_satisfaction   AS "globalSatisfaction",
         observed_changes      AS "observedChanges",
         would_recommend       AS "wouldRecommend",
         evaluated_at          AS "evaluatedAt"
  FROM patient_outcomes o
  WHERE o.patient_id = c.id
  ORDER BY o.evaluated_at DESC
  LIMIT 1
) last_outcome ON TRUE
```

- **Ne plus insérer de ligne vide** : remplacer la condition actuelle (toujours vraie à cause de `wouldRecommend: false`) par une comparaison avec la dernière évaluation :

```ts
const hasChanged =
  perceivedImprovement !== undefined || observedChanges ||
  globalSatisfaction !== undefined ||
  (wouldRecommend !== undefined && wouldRecommend !== lastOutcome?.wouldRecommend);
```

- **Enregistrer une correction au lieu d'empiler** : si une évaluation existe déjà pour la séance, faire un `UPDATE patient_outcomes` plutôt qu'un `INSERT` (ajouter `appointment_id` à la table pour rattacher l'évaluation au rendez-vous).

**7. Vérifier l'affichage**

La fiche patient et le compte rendu doivent relire la même valeur ; un aller-retour « Enregistrer → rouvrir » doit restituer le statut et les évaluations saisis.

**Effort** : M

---

# 🟠 MAJEUR

## BUG-08 — Référence de facture vide ou dupliquée acceptée

> ✅ **CORRIGÉ** — commit `6a46e3f` (19/11/2026). La référence est normalisée (`trim`) et refusée si vide (400) ; un index unique partiel (`lower(btrim(reference)) WHERE btrim(reference) <> ''`) interdit les doublons, et l'API renvoie **409** au lieu d'un 500.

**Zone** : `backend/src/modules/company-invoices.ts`, schéma `invoices`

**Constat**
- `reference: '   '` → **201** : la référence est stockée vide (le `.trim()` du validateur n'est pas réinjecté).
- `reference: '1/2026'` déjà existante → **201** : doublon accepté.
- Aucune contrainte `UNIQUE` sur `invoices.reference`.

```ts
body('reference', 'Reference requise').notEmpty().trim(),   // trim sans effet sur req.body
```

**Scénario de reproduction**

La comptable établit la facture du mois pour l'entreprise « test ». Elle saisit la référence `1/2026`, valide, puis se rend compte qu'elle s'est trompée d'entreprise : elle refait la facture avec la même référence `1/2026` pour la bonne société. Les deux factures sont acceptées sans le moindre avertissement.

Dans la liste, deux lignes portent désormais le même numéro avec deux montants différents, et une troisième facture créée plus tard affiche une référence entièrement vide (les espaces saisis ont été acceptés tels quels). Lors de la réconciliation comptable, impossible de savoir laquelle correspond au bon client ; l'export présente deux pièces justificatives portant le même numéro, ce qui est bloquant en cas de contrôle.

**Impact**
Facturation légale : deux factures portant le même numéro, ou une facture sans numéro. Non conforme et impossible à réconcilier comptablement.

**Correctif**
1. Normaliser explicitement : `const reference = String(req.body.reference || '').trim();` puis `if (!reference) return 400`.
2. Index unique partiel :
```sql
CREATE UNIQUE INDEX invoices_reference_unique ON invoices (lower(btrim(reference)))
  WHERE btrim(reference) <> '';
```
3. Générer la référence côté serveur (séquence annuelle) plutôt que la faire saisir.

**Effort** : S

---

## BUG-09 — Pack créé automatiquement à la création d'un RDV

> ✅ **CORRIGÉ (comptage)** — commit `79cec89` (19/11/2026). La création automatique du pack est **conservée** : c'est la règle métier (le patient s'engage sur le pack, le règlement est exigible à la fin de la première séance). Seul le **comptage** était faux : « Packs vendus » compte désormais les packs dont **au moins une séance est terminée**, à la date de la première séance consommée.

**Zone** : `backend/src/modules/appointments.ts` (lignes 256-276), `backend/src/modules/patient-packs.ts` (`packSelect`), `app/page.tsx`

**Constat**
À chaque création de RDV avec un service, si le patient n'a pas de pack actif pour ce service, l'API insère un `patient_packs` complet (`total_sessions = service.sessions`, `price = service.price`) :

```ts
if (existingPack.rowCount === 0) {
  await query(`INSERT INTO patient_packs (...) VALUES ($1,$2,$3,$3,$4,$5)`, ...);
}
```

**Règle métier (validée)**

Le pack est **engagé dès la prise de rendez-vous** : le patient est considéré comme ayant souscrit les N séances, même s'il n'a pas encore tout réglé. Le règlement est **exigible à la fin de la première séance** (le compte rendu redirige vers l'écran de paiement). L'auto-création du pack est donc **volontaire**, pas un défaut.

**Ce qui était faux**

Le tableau de bord comptait un pack comme « vendu » **dès sa création** :

```ts
// avant
const packsMonth = packItems.filter((p) => isInCurrentMonth(p.createdAt)).length;
```

Un pack créé automatiquement (aucune séance, aucun paiement) gonflait donc le KPI.

**Rappel — comment le solde est calculé**

```sql
balance = Σ paiements 'completed'  −  Σ séances 'completed'
```
où chaque séance terminée déduit :
- **`pack.price / pack.total_sessions`** si la séance a consommé un pack (`patient_pack_usages`) ;
- **`service.price`** sinon.

Un paiement encaissé **avant** la séance crédite le solde (+3 000) ; le coût n'est débité **qu'au passage du RDV en « terminé »** (`trg_pack_sync_status` → `recalc_patient_balance`). Le paiement n'est jamais rattaché à un rendez-vous : c'est une **avance** débitée séance après séance.

**Exemple mesuré en base** (service « NeuroFeedback 8 » : 33 000 DZD, 8 séances → 4 125 DZD/séance ; le patient règle un acompte de 3 000 DZD) :

| Étape | Solde | Packs |
|---|---|---|
| 0. Patient créé | 0 | — |
| 1. Il paie **3 000 DZD** | **+3 000** | — |
| 2. Le RDV est créé → pack auto 8/8 | +3 000 | 1 pack, 8/8 |
| 3. La séance est terminée | **−1 125** | 8/8 → **7/8** |
| 4. La séance est rouverte | +3 000 | 8/8 |

Ce comportement est **conforme** à la règle : le patient s'est engagé sur un pack de 33 000 DZD, chaque séance vaut 4 125 DZD, et il doit 1 125 DZD après la première. Le pack reste « en cours » (7/8) jusqu'à la fin.

**Impact (avant correction)**
- Le KPI « Packs vendus » comptait des packs sans aucune séance réalisée → pilotage commercial faux.
- Un pack jamais commencé apparaissait comme vendu dans le tableau de bord.

**Correctif appliqué**

1. `packSelect` expose désormais `usedSessions` et `firstUsedAt` (date de la première séance consommée) :
```sql
(SELECT COUNT(*)::int FROM patient_pack_usages u WHERE u.pack_id = pp.id) AS "usedSessions",
(SELECT MIN(a.start_time)
   FROM patient_pack_usages u
   JOIN appointment_patients ap ON ap.id = u.appointment_patient_id
   JOIN appointments a ON a.id = ap.appointment_id
  WHERE u.pack_id = pp.id) AS "firstUsedAt"
```
2. Le tableau de bord compte un pack **vendu** dès qu'une de ses séances est terminée, à la date de cette première séance :
```ts
const packsMonth = packItems.filter((p) => p.firstUsedAt && isInCurrentMonth(p.firstUsedAt)).length;
```

**Reste possible (non bloquant)** :
- Relier explicitement un pack à son paiement (`payments.pack_id`) si l'on souhaite distinguer « vendu » et « encaissé ».
- Un pack auto-créé pour un rendez-vous **annulé** n'est pas supprimé (il reste affiché « 8/8 » dans la fiche patient et sera réutilisé au prochain RDV). Il n'est plus compté comme vendu, mais il encombre la liste des packs. Un nettoyage à l'annulation serait à décider.

**Effort** : S

---

## BUG-10 — Erreurs utilisateur renvoyées en HTTP 500

**Zone** : backend (transversal — tous les modules)

**Constat**
Les contraintes PostgreSQL et les conversions d'UUID ne sont pas traduites. Tests réalisés :

| Requête | Attendu | Obtenu |
|---|---|---|
| `POST /api/payments { paymentMethod: 'bitcoin' }` | 400 | **500** |
| `POST /api/payments { patientId: 'abc' }` | 400 | **500** |
| `POST /api/payments { amount: 1e14 }` (dépassement `numeric(12,2)`) | 400 | **500** |
| `POST /api/patient-packs { serviceId: inexistant }` | 404 | **500** |
| `POST /api/patient-packs { patientId: inexistant }` | 404 | **500** |
| `POST /api/services { type: 'zombie' }` | 400 | **500** |
| `POST /api/users { role: 'zombie' }` | 400 | **500** |
| `POST /api/company-invoices` prix négatif / séances négatives | 400 | **500** |
| `POST /api/expenses { amount: 1e14 }` | 400 | **500** |

**Scénario de reproduction**

Une nouvelle secrétaire saisit un paiement et choisit par erreur un mode de règlement qui n'existe pas, ou bien colle un identifiant patient incomplet dans un appel à l'API. L'écran affiche « Erreur interne du serveur » : elle en déduit que l'application est en panne et appelle le support.

Or le serveur n'est pas en panne : la base a simplement rejeté une valeur invalide (contrainte `CHECK`, UUID mal formé, dépassement de `numeric(12,2)`), et l'API a traduit cette erreur métier en 500. L'incident est remonté dans les journaux comme une panne serveur alors qu'il s'agit d'une saisie incorrecte. L'utilisateur n'a aucun moyen de savoir quel champ corriger, et l'équipe technique enquête sur une fausse alerte pendant que la saisie reste bloquée.

**Impact**
- L'utilisateur voit « Erreur interne du serveur » au lieu de la cause réelle.
- Les métriques d'observabilité sont polluées (des erreurs métier apparaissent comme incidents serveur).
- Le front ne peut pas réagir différemment (afficher le champ fautif).

**Correctif**
Gestionnaire d'erreurs centralisé traduisant les codes PostgreSQL :

```ts
// backend/src/index.ts (après les routes)
app.use((err, req, res, next) => {
  const pgCode = err?.code;
  const map: Record<string, { status: number; message: string }> = {
    '22P02': { status: 400, message: 'Identifiant invalide.' },
    '22003': { status: 400, message: 'Montant hors limites.' },
    '23503': { status: 404, message: 'Élément référencé introuvable.' },
    '23514': { status: 400, message: 'Valeur non autorisée.' },
    '23505': { status: 409, message: 'Cet enregistrement existe déjà.' },
  };
  const mapped = map[pgCode];
  if (mapped) return res.status(mapped.status).json({ success: false, code: pgCode, message: mapped.message });
  console.error('[api]', err);
  return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});
```

Compléter par une validation `express-validator` en amont pour les enums, UUID et bornes.

**Effort** : M

---

## BUG-11 — Valeurs invalides ignorées en silence

**Zone** : `backend/src/modules/payments.ts`, `appointments.ts`

**Constat**

| Entrée | Comportement observé |
|---|---|
| `status: 'zombie'` sur un paiement | **ignoré**, enregistré `completed` (le statut est codé en dur) |
| `processedDate: '31/02/2020'` | **ignoré**, remplacé par `new Date().toISOString()` → le paiement est daté d'aujourd'hui |
| `role: 'zombie'` sur un RDV | **ignoré**, rôle retombé sur `admin` |

**Scénario de reproduction (le plus gênant)**

La comptable enregistre un paiement daté du 31 février 2020 : elle a tapé « 31/02 » par habitude, alors que ce jour n'existe pas. L'application ne bronche pas ; le paiement apparaît bien dans la liste, mais **à la date du jour**.

Il est donc rattaché au mois en cours au lieu du mois de régularisation souhaité. Le total du mois est gonflé, celui du mois précédent reste faux, et personne ne s'en aperçoit puisqu'aucun message n'a été affiché. Le même mécanisme s'applique au statut (`zombie` devient `completed`) et au rôle d'un rendez-vous : les valeurs invalides sont silencieusement remplacées au lieu d'être refusées.

**Impact**
Comptabilité au mauvais mois, sans aucun signal. Données silencieusement falsifiées.

**Correctif**
- Valider explicitement et **refuser** plutôt que substituer :
```ts
const parsed = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
if (Number.isNaN(parsed.getTime())) {
  return res.status(400).json({ success: false, error: 'Date de paiement invalide.' });
}
```
- Pour les enums, utiliser `body('paymentMethod').isIn([...])` / `body('role').isIn(['admin','psy','coach'])`.
- Si le statut n'est pas modifiable à la création, le documenter dans l'API (ou retirer le champ du contrat).

**Effort** : S

---

## BUG-12 — Aucune borne sur les valeurs métier

**Zone** : backend + contraintes SQL

**Constat**

| Cas | Résultat |
|---|---|
| `POST /api/patients { childrenCount: -5 }` | **201** (nombre d'enfants négatif) |
| `POST /api/patients { dateOfBirth: '2099-12-31' }` | **201** (naissance dans le futur, via API) |
| `POST /api/patient-packs { totalSessions: -3 }` | **201** → pack de **−3 séances** |
| `POST /api/patient-packs { totalSessions: 1e9 }` | **201** → pack d'un milliard de séances |
| Facture : remise 1 000 sur un total HT de 600 | **201** → `discounted_total = 0`, `grand_total = 19` (incohérent) |
| Facture : `learnerCount: 0` | **201** → ligne à 0 DZD |
| Compte rendu : amélioration `999`, satisfaction `-5` | **enregistrés** dans `patient_outcomes` |
**Scénario de reproduction**

Lors d'une reprise de données depuis un ancien logiciel, un pack est créé avec un nombre de séances négatif (`-3`), un patient est enregistré avec « -5 enfants » et une date de naissance en 2099, et une facture est générée avec une remise de 1 000 DZD sur une prestation de 600 DZD.

Aucune de ces valeurs n'est refusée. Le lendemain, la fiche du patient affiche « -3/-3 séances », son calcul de solde devient absurde, et la facture montre un total HT de 600, une remise de 1 000 et un total TTC de 19 DZD. Les moyennes d'amélioration du tableau de bord sont tirées par une évaluation notée 999/10, et la satisfaction moyenne devient négative. Corriger ces lignes à la main demandera plusieurs heures, et rien n'empêchera qu'elles réapparaissent au prochain import.

**Impact**
Données corrompues impossibles à réparer automatiquement, statistiques et soldes faux.

**Correctif**
Contraintes en base (le plus fiable) **et** validation API :

```sql
ALTER TABLE patients
  ADD CONSTRAINT patients_children_count_check CHECK (children_count IS NULL OR children_count >= 0),
  ADD CONSTRAINT patients_dob_past_check CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE);

ALTER TABLE patient_packs
  ADD CONSTRAINT packs_total_positive CHECK (total_sessions > 0),
  ADD CONSTRAINT packs_remaining_range CHECK (remaining_sessions BETWEEN 0 AND total_sessions),
  ADD CONSTRAINT packs_price_positive CHECK (price >= 0);

ALTER TABLE invoices
  ADD CONSTRAINT invoices_discount_lte_subtotal CHECK (discount <= subtotal);

ALTER TABLE patient_outcomes
  ADD CONSTRAINT outcomes_improvement_range CHECK (perceived_improvement IS NULL OR perceived_improvement BETWEEN 0 AND 10),
  ADD CONSTRAINT outcomes_satisfaction_range CHECK (global_satisfaction IS NULL OR global_satisfaction BETWEEN 0 AND 5);
```

> ⚠️ Nettoyer les lignes existantes hors bornes **avant** d'ajouter les contraintes (voir BUG-16).

**Effort** : M

---

## BUG-13 — Aucune longueur maximale

**Zone** : formulaires front + API

**Constat**
Un nom de **5 000 caractères** est accepté (`POST /api/patients` → 201). Conséquence visible : le sélecteur de patient du formulaire RDV devient un bloc illisible qui occupe tout l'écran (observé en direct), et la liste patients casse sa mise en page.

**Scénario de reproduction**

Un patient est créé après un copier-coller malheureux : son prénom contient plusieurs milliers de caractères (une adresse collée par erreur). L'enregistrement réussit sans le moindre avertissement.

Quelques minutes plus tard, la secrétaire ouvre le formulaire de rendez-vous : le menu de sélection des patients est envahi par une entrée gigantesque qui occupe tout l'écran, rendant les autres patients difficiles à atteindre. La liste des patients est également déformée et l'export PDF du dossier produit plusieurs pages blanches. Il faut corriger la donnée en base pour retrouver une interface utilisable.

**Impact**
Interface inutilisable, base gonflée, exports/PDF cassés.

**Correctif**
- `maxLength` sur les champs (`prénom/nom` 80, `téléphone` 20, `email` 120, `notes` 5 000).
- Validation serveur équivalente (`body('firstName').isLength({ max: 80 })`).
- Troncature d'affichage côté liste (`line-clamp-1`, `truncate`).

**Effort** : S

---

## BUG-14 — Donut « Canal d'acquisition » sans légende

**Zone** : `app/page.tsx`

**Constat**
Le graphique circulaire n'affiche que le total au centre (17). Aucun libellé de catégorie, aucune légende, aucune info-bulle exploitable → impossible de savoir quelle part correspond à « recommandation », « réseaux sociaux », etc.

**Scénario de reproduction**

En réunion, la gérante projette le tableau de bord pour présenter les sources d'acquisition des patients. Le graphique circulaire affiche des parts de couleurs différentes et, au centre, le nombre 17. Aucune légende, aucun libellé, aucune info-bulle : personne dans la salle ne peut dire quelle part correspond aux recommandations, aux réseaux sociaux ou aux médecins prescripteurs.

Le graphique est agréable à regarder mais inexploitable. La réunion se poursuit sans cette information, alors que les données existent en base et sont correctement réparties : seul l'affichage ne les nomme pas.

**Impact**
Graphique décoratif mais non informatif ; l'utilisateur ne peut rien en tirer.

**Correctif**
Ajouter `<Legend />` (déjà importé) et un `Tooltip` formaté :

```tsx
<Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
  {sourceData.map((entry, i) => <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />)}
</Pie>
<Legend formatter={(v) => v} />
<RechartsTooltip formatter={(v, n) => [`${v} patients`, n]} />
```

Ajouter aussi les libellés manquants de `source_of_acquisition` (mapping valeur technique → libellé FR).

**Effort** : XS

---

## BUG-15 — Noms de services dupliqués autorisés

**Zone** : table `services`

**Constat**
`POST /api/services { name: 'Consultation classique' }` alors qu'un service actif porte déjà ce nom → **201**. En base : deux services actifs homonymes (`is_active = true`), prix différents.

**Scénario de reproduction**

Une praticienne crée un nouveau service intitulé « Consultation classique », sans savoir qu'un service du même nom existe déjà avec un autre tarif (3 000 DZD au lieu de 2 500). Le doublon est accepté sans avertissement.

La semaine suivante, la secrétaire planifie un rendez-vous depuis le calendrier Coach et se retrouve face à deux entrées strictement identiques, à des prix différents, sans moyen de les distinguer avant validation. Elle choisit la mauvaise : le patient est débité du mauvais montant et le pack généré ne correspond pas à la prestation réellement vendue.

**Impact**
Mauvais service sélectionné → mauvais prix, mauvais pack, mauvais débit du solde.

**Correctif**
```sql
CREATE UNIQUE INDEX services_name_active_unique
  ON services (lower(btrim(name))) WHERE is_active;
```
Et renvoyer 409 avec un message clair côté API.

**Effort** : XS

---

## BUG-16 — Dérive de données existante (packs, session_count, soldes)

**Zone** : données

**Constat (mesuré le 19/11/2026)**

| Anomalie | Volume |
|---|---|
| Packs avec `remaining_sessions ≠ total_sessions − nb_usages` | **16 packs** (ex. `total 1 / remaining 1` avec 1 usage ; `total 8 / remaining 7` avec 0 usage) |
| Patients avec `session_count` ≠ nombre de RDV `completed` | 2 patients |
| Solde stocké incohérent avec la formule de recalcul | *nazim mouzaoui* : stocké **16 020**, recalculé **16 200** |

**Scénario de reproduction**

La gérante effectue un contrôle de cohérence avant la clôture annuelle. Elle compare, pour chaque pack, le nombre de séances restantes affiché avec le nombre de séances réellement consommées dans l'historique des rendez-vous. Seize packs présentent un écart : certains affichent une séance restante alors qu'aucune n'a jamais été utilisée, d'autres affichent sept séances restantes sur huit alors qu'aucune consommation n'est enregistrée.

Deux patients affichent également un compteur de séances différent du nombre de rendez-vous terminés, et le solde enregistré de « nazim mouzaoui » (16 020 DZD) ne correspond pas à celui obtenu en recalculant la formule officielle (16 200 DZD). Aucun de ces écarts n'est signalé par l'application ; ils proviennent d'opérations antérieures (ancien endpoint de consommation, suppressions manuelles, migrations). En l'état, un patient peut se voir offrir ou refuser une séance sur la base d'un compteur faux.

Pour visualiser les écarts :

```sql
SELECT pk.id, pk.total_sessions, pk.remaining_sessions,
       (SELECT count(*) FROM patient_pack_usages u WHERE u.pack_id = pk.id) AS usages
FROM patient_packs pk
WHERE pk.remaining_sessions <> pk.total_sessions
   - (SELECT count(*) FROM patient_pack_usages u WHERE u.pack_id = pk.id);
-- → 16 lignes
```

**Impact**
Séances affichées fausses, solde affiché faux (le patient croit avoir plus/moins de séances), litiges.

**Correctif**
1. Migration de réconciliation (à exécuter **après sauvegarde**) :

```sql
BEGIN;

-- 1) Recalcule remaining_sessions à partir des usages réels
UPDATE patient_packs pk
SET remaining_sessions = GREATEST(pk.total_sessions
      - (SELECT count(*) FROM patient_pack_usages u WHERE u.pack_id = pk.id), 0),
    updated_at = now();

-- 2) Recalcule session_count depuis les RDV terminés
UPDATE patients p
SET session_count = (
  SELECT count(*) FROM appointment_patients ap
  JOIN appointments a ON a.id = ap.appointment_id
  WHERE ap.patient_id = p.id AND a.status = 'completed'
);

-- 3) Recalcule les soldes avec la fonction officielle
SELECT recalc_patient_balance(id) FROM patients;

COMMIT;
```

2. Ajouter un **contrôle de cohérence quotidien** (job ou endpoint admin « Vérifier l'intégrité ») qui liste les écarts sans les corriger.
3. Documenter la règle : `remaining = total − usages` doit toujours être vraie (trigger garanti).

> ℹ️ Pendant l'audit, le solde de *nazim mouzaoui* a été recalculé (16 020 → 16 200). Si 16 020 était une valeur volontaire (ajustement manuel), il faudra la rétablir après avoir identifié l'origine de l'écart.

**Effort** : M

---

## BUG-17 — Garde `beforeunload` impossible à lever sur la page Paiements

**Zone** : `app/payments/page.tsx` (lignes 95-181)

**Constat**
`mustPay` est dérivé d'une **ref** :

```ts
const mustPayRef = useRef(searchParams.get('patientId') !== null);
const mustPay = mustPayRef.current;               // valeur figée au rendu
...
mustPayRef.current = false;                       // ne déclenche aucun re-rendu
```

Le bouton « Quitter sans payer » met la ref à `false` mais **ne provoque pas de re-rendu** : l'écouteur `beforeunload` reste attaché (son `useEffect` dépend de `mustPay`, qui vaut toujours `true`).

**Scénario de reproduction**

À l'issue d'une consultation, le praticien enregistre son compte rendu : l'application le redirige automatiquement vers la page de paiement, avec la fiche du patient préchargée et une fenêtre « Paiement requis ». Le patient devait régler en espèces, mais il annonce qu'il paiera la semaine suivante. Le praticien clique alors sur « Quitter sans payer » : la fenêtre disparaît.

Il veut retourner sur l'agenda, mais le navigateur affiche immédiatement une demande de confirmation « Quitter le site ? Les modifications ne seront peut-être pas enregistrées ». Il confirme, retente, et la même alerte revient à chaque tentative, y compris pour fermer l'onglet. L'écran reste bloqué sur la page de paiement alors qu'il n'a plus rien à y faire ; il finit par fermer le navigateur de force. Sur un poste moins habitué, l'utilisateur reste prisonnier de la page et croit à une panne.

**Impact**
Utilisateur bloqué, crainte de perdre des données, obligation de tuer l'onglet. Très visible sur mobile.

**Correctif**
Utiliser un **état** (pas une ref) et supprimer l'écouteur dès la sortie :

```ts
const [mustPay, setMustPay] = useState(searchParams.get('patientId') !== null);

useEffect(() => {
  if (!mustPay) return;
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [mustPay]);

// « Quitter sans payer »
onClick={() => { setMustPay(false); if (pendingNavigation) router.push(pendingNavigation); }}
// après paiement réussi
setMustPay(false);
```

**Effort** : S

---

## BUG-18 — Écrire un compte rendu complète le RDV sans confirmation

**Zone** : `backend/src/modules/session-notes.ts`

**Constat**
`POST /api/session-notes` marque automatiquement le RDV `completed`, ce qui déclenche le trigger de débit du pack / du solde. Aucune confirmation n'est demandée, et le formulaire ne permet pas d'enregistrer un brouillon.

**Scénario de reproduction**

Un rendez-vous est planifié pour jeudi. Le mercredi soir, le praticien prépare son dossier et saisit quelques notes dans le champ « Compte rendu », puis clique sur « Enregistrer » en pensant sauvegarder un brouillon.

Le rendez-vous passe aussitôt au statut « terminé » : le trigger de débit s'exécute, la séance est retirée du pack du patient (ou débitée de son solde), alors que la consultation n'a pas encore eu lieu. Le lendemain, en constatant l'erreur, il faut modifier manuellement le statut pour rendre la séance — une manipulation que peu d'utilisateurs connaissent, et qui laisse une trace d'annulation dans le journal d'audit.

**Impact**
Débit financier involontaire, RDV terminé par erreur (le retour en arrière n'est possible que par une modification manuelle de statut).

**Correctif**
- Soit rendre l'action explicite (« Enregistrer et clôturer la séance ») avec une case à cocher `clôturer = true`.
- Soit ne plus changer le statut dans `POST /session-notes` ; la clôture passe par `POST /appointments/:id/complete` (déjà utilisé par le rapport).

**Effort** : S

---

# 🟡 MOYEN

## BUG-19 — Faute de frappe dans un message d'erreur

`backend/src/modules/payments.ts` : `'A mount of 0 requires notes'` → `'Un montant de 0 nécessite des notes'`.

**Scénario de reproduction**

Une secrétaire enregistre un paiement de 0 DZD accompagné d'une note, comme l'application le permet. Une erreur de saisie provoque le refus du serveur, qui répond en anglais : « A mount of 0 requires notes ». Elle ne comprend ni la langue ni la faute de frappe, suppose que le paiement est refusé pour une autre raison et recommence plusieurs fois. Le support reçoit un appel pour un simple message mal rédigé.

**Effort** : XS

---

## BUG-20 — État vide trompeur quand un filtre ne retourne rien

**Constat** : avec une recherche ou un filtre sans résultat, la liste Patients affiche « **Aucun patient pour le moment** — Ajouter votre premier patient », ce qui laisse croire que la base est vide.

**Scénario de reproduction**

La secrétaire recherche une patiente dont elle ne connaît que le début du nom, se trompe et saisit « zzz ». La liste se vide et affiche un encart de bienvenue : « Aucun patient pour le moment — Ajouter votre premier patient ». Elle en conclut que la base a été vidée ou qu'un incident a effacé les dossiers, et appelle immédiatement le support.

Le message devrait simplement indiquer qu'aucun résultat ne correspond aux filtres, avec un bouton pour les réinitialiser ; il laisse au contraire croire que le cabinet n'a plus aucun patient.

**Correctif** : conditionner l'état vide à l'absence de filtre actif (`countActiveFilters(filters) === 0`).
**Effort** : XS

---

## BUG-21 — « Réinitialiser » n'applique pas la réinitialisation

**Constat** : le bouton vide les champs mais la liste reste filtrée ; il faut cliquer « Appliquer » ensuite.

**Scénario de reproduction**

Après une recherche infructueuse, la secrétaire clique sur « Réinitialiser » dans le panneau de filtres. Les champs se vident bien, mais la liste reste désespérément vide : la réinitialisation n'a pas été appliquée. Elle doit deviner qu'il faut ensuite cliquer sur « Appliquer », un second bouton situé juste à côté. Persuadée que l'application est bloquée, elle recharge la page — seule manipulation qui rétablit réellement l'affichage complet.

**Correctif** : `onClick={() => { resetFilters(); applyFilters(); }}` (ou « Réinitialiser et appliquer »).
**Effort** : XS

---

## BUG-22 — Date de naissance future → message d'erreur faux

**Constat** : saisir `31/12/2099` affiche « Date de naissance invalide (format JJ/MM/AAAA) » alors que le format est correct ; le vrai motif est « date dans le futur ».

**Scénario de reproduction**

En saisissant la date de naissance d'un patient, la secrétaire tape « 31/12/2099 » par erreur, en inversant deux chiffres. Le message affiché est « Date de naissance invalide (format JJ/MM/AAAA) ». Elle vérifie donc son format pendant plusieurs minutes, essaie « 31/12/2099 », puis « 31-12-2099 », puis appelle le support : le format était correct depuis le début, c'est l'année qui était dans le futur. Le message l'a envoyée sur une fausse piste et lui a fait perdre un temps considérable.

**Correctif** : distinguer les deux cas dans `handleDobManualChange` :
```ts
if (parsed > new Date()) return setDobError('La date de naissance ne peut pas être dans le futur.');
if (Number.isNaN(parsed.getTime())) return setDobError('Format attendu : JJ/MM/AAAA.');
```
**Effort** : XS

---

## BUG-23 — Message « Créneau complet » faux pour un excès de patients

**Constat** : envoyer 20 patients sur un RDV renvoie « Créneau complet : maximum 1 RDV pour ce rôle à cet horaire », alors que le problème est le **nombre de patients** par RDV.

**Scénario de reproduction**

Pour une séance de groupe, la secrétaire tente d'associer cinq patients au même rendez-vous sur le calendrier Coach (la limite étant de quatre). Le serveur refuse, mais le message affiché parle d'un « créneau complet : maximum 1 RDV pour ce rôle à cet horaire ».

Elle en déduit que l'horaire est déjà occupé par un autre rendez-vous, change l'heure, réessaie, et échoue à nouveau pour la même raison réelle. Le vrai problème — trop de patients sur un seul rendez-vous — n'est jamais évoqué ; elle finit par créer plusieurs rendez-vous distincts pour contourner un blocage qu'elle n'a pas compris.

**Correctif** : message dédié (ex. « Maximum 4 patients par rendez-vous pour ce rôle ») et code d'erreur distinct (`TOO_MANY_PATIENTS`).
**Effort** : XS

---

## BUG-24 — Facture : date non préremplie, TVA ambiguë

**Constat**
- Le champ `Date *` est vide par défaut (les paiements, eux, sont préremplis à aujourd'hui) → l'utilisateur clique Enregistrer et reçoit « Veuillez saisir la date ».
- Le champ « TVA » est un **montant** en DZD, pas un pourcentage, sans indication. Preuve dans les données : facture `1/2026` → HT 30, remise 10, **TVA 400**, TTC 420 (TVA 400 % du HT).

**Scénario de reproduction**

La comptable établit une facture pour une entreprise. Elle renseigne l'entreprise, la référence et les lignes, puis clique sur « Enregistrer la facture » : rien ne se passe, sinon un message « Veuillez saisir la date » alors que le champ date était vide par défaut et qu'elle ne l'avait pas remarqué. Elle corrige.

Vient ensuite le champ « TVA » : elle saisit 19 en pensant à 19 %, et le total TTC n'augmente que de 19 DZD, car il s'agit d'un montant et non d'un pourcentage. La facture générée affiche un total incohérent avec le taux attendu, et la comptable ne comprend l'erreur qu'en comparant avec une facture précédente. Le même malentendu explique la facture existante `1/2026`, dont la TVA de 400 DZD représente 400 % du total hors taxes.

**Correctif** : préremplir la date à `new Date().toISOString().slice(0,10)` ; renommer « TVA (montant DZD) » ou implémenter un taux (`TVA %` + calcul automatique) ; afficher le récapitulatif HT / remise / TVA / TTC.
**Effort** : S

---

## BUG-25 — Rafale de 8 appels API avant résolution de l'authentification

**Constat** : au premier chargement, le shell déclenche `waiting-list`, `expenses`, `patients`, `appointments`, `payments`, `patient-packs`, `session-notes`… **avant** que `/auth/me` ne réponde → 8 réponses **401** dans la console, puis les mêmes requêtes repartent une fois authentifié.

**Scénario de reproduction**

Un utilisateur ouvre l'application sur un poste lent. Pendant la seconde qui précède la réponse du serveur d'authentification, l'interface déclenche simultanément le chargement des rendez-vous, des paiements, des patients, des packs, des dépenses, de la liste d'attente et des comptes rendus. Les huit appels partent sans jeton et reçoivent chacun une réponse 401, visibles dans la console du navigateur.

Une fois la session confirmée, les mêmes requêtes repartent, cette fois avec succès. L'utilisateur voit brièvement des états vides et des compteurs à zéro ; lors d'un diagnostic, ces erreurs rouges masquent les vrais incidents.

**Impact** : bruit, charge inutile, flashs d'états vides.
**Correctif** : ne monter les pages (et les `useEffect` de chargement) qu'après `isLoading === false && isAuthenticated`.
**Effort** : S

---

## BUG-26 — Page d'édition patient : formulaire vide ~1 s

**Constat** : `/patients/:id/edit` affiche le formulaire **vide et éditable** pendant le chargement (aucun squelette), avant de se remplir.

**Scénario de reproduction**

La secrétaire ouvre la fiche d'un patient pour corriger son numéro de téléphone. La page affiche immédiatement un formulaire entièrement vide, qu'elle commence à remplir : elle saisit « Karim » dans le prénom et s'apprête à valider. Une seconde plus tard, les données réelles du patient arrivent et écrasent sa saisie.

Si elle avait cliqué sur « Enregistrer » entre-temps, elle aurait envoyé un formulaire partiellement vide, effaçant des informations du dossier — sans aucun avertissement.

**Correctif** : afficher `<FormSkeleton />` tant que `loading === true` et désactiver les champs.
**Effort** : XS

---

## BUG-27 — Bouton « Nouveau patient » recouvert par la pastille utilisateur

**Constat** (largeur 912 px) : le bouton d'action du header s'étend sous la pastille flottante de l'utilisateur ; le libellé est tronqué.

**Scénario de reproduction**

Sur un ordinateur portable, avec une fenêtre d'environ 900 pixels de large, la responsable ouvre la liste des patients. Le bouton « Nouveau patient » s'étend jusqu'au bord droit de l'écran et passe sous la pastille circulaire de l'utilisateur, qui flotte au-dessus. Le libellé est coupé et la zone cliquable se confond avec celle du menu utilisateur : un clic légèrement décalé ouvre le menu de compte au lieu du formulaire de création.

**Correctif** : réserver la zone de la pastille (`pr-16` sur le header) ou déplacer la pastille dans la barre latérale.
**Effort** : XS

---

## BUG-28 — Messages anglais dans une UI française

**Constat** : « Patient not found », « Appointment created successfully », « Service not found », « User with this pseudo already exists »… cohabitent avec des messages français.

**Scénario de reproduction**

Un praticien ouvre un lien de rendez-vous obsolète. La page affiche « Patient not found » au milieu d'une interface entièrement française. Il ne sait pas si le patient a été supprimé, si le lien est cassé ou si l'application rencontre un problème, et ne peut pas transmettre un message clair au support. Le même mélange apparaît dans les confirmations (« Appointment created successfully ») et les erreurs d'unicité (« User with this pseudo already exists »).

**Correctif** : centraliser les libellés dans un fichier de messages (`backend/src/i18n/fr.ts`) et n'exposer que des `code` techniques au front.
**Effort** : XS

---

## BUG-29 — Accessibilité (WCAG 2.1 AA)

**Constats vérifiés dans le DOM**

| Élément | Problème | Critère |
|---|---|---|
| 5 liens de navigation | ni texte, ni `aria-label`, ni `title` | 4.1.2 |
| Boutons de ligne (historique / éditer / supprimer) | icônes seules, sans nom accessible | 4.1.2 |
| `<label>` du login | `htmlFor` absent, inputs sans `id` → clic sur le label sans effet | 1.3.1 / 3.3.2 |
| Champs login | pas d'`autocomplete="username"` / `"current-password"` | 1.3.5 |
| Boutons calendrier « Calendrier / Liste » | `title` seulement, pas de nom accessible | 4.1.2 |

**Scénario de reproduction**

Une utilisatrice malvoyante navigue au clavier. En arrivant sur le menu latéral, le lecteur d'écran annonce cinq fois « lien » sans aucun intitulé : elle ne peut pas savoir lequel mène aux patients, aux rendez-vous ou aux paiements. Dans la liste des patients, elle atteint les boutons d'action et entend de nouveau « bouton » sans libellé, sans pouvoir distinguer « voir l'historique », « modifier » et « supprimer ».

Sur l'écran de connexion, elle clique sur le libellé « Pseudo » pour placer le curseur dans le champ : rien ne se passe, car le `<label>` n'est relié à aucun champ. Elle doit tabuler à l'aveugle jusqu'au champ suivant. L'application reste utilisable à la souris, mais inaccessible pour une partie des utilisateurs — un point sensible dans un contexte de données de santé.

**Correctif** : `aria-label` sur chaque lien/bouton icône, `htmlFor`/`id` sur les labels, `autocomplete` sur le login, et un test axe/Lighthouse dans la CI.
**Effort** : M

---

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

## BUG-32 — Aucune contrainte `EXCLUDE` anti double réservation

**Constat** : l'unicité par créneau (Psy = 1 RDV, Coach = 4) est vérifiée **uniquement dans le code** (`appointments.ts`), sans verrou ni contrainte. Deux requêtes simultanées peuvent créer un doublon.

**Scénario de reproduction**

La secrétaire ouvre deux onglets pour gagner du temps et prépare le même rendez-vous dans les deux. Elle valide dans le premier onglet, puis, convaincue que l'enregistrement a échoué (la réponse tarde), valide à nouveau dans le second. Les deux requêtes partent à quelques dizaines de millisecondes d'intervalle : chacune vérifie l'occupation du créneau avant que l'autre n'ait écrit, et les deux réussissent.

Le praticien se retrouve avec deux rendez-vous identiques à la même heure, et le patient avec deux convocations. Le même phénomène se produit lors d'un double-clic sur « Créer le rendez-vous » avec une connexion lente.

**Correctif** :
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap_per_role
  EXCLUDE USING gist (
    role WITH =,
    tstzrange(start_time, end_time) WITH &&
  );
```
(à adapter pour autoriser 4 RDV Coach : ajouter un compteur ou une contrainte partielle).
**Effort** : M

---

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

## BUG-35 — `duration = 0` contourne le CHECK via NULL

**Constat** : `POST /api/services { duration: 0 }` → **201** ; la valeur est convertie en `NULL`, ce qui échappe à `CHECK (duration > 0)` et fausse le calcul d'heure de fin de RDV (repli implicite).

**Scénario de reproduction**

Une praticienne crée un service en laissant le champ « Durée » à zéro, persuadée qu'une valeur par défaut sera appliquée. Le service est enregistré sans aucun avertissement.

Elle planifie ensuite un rendez-vous avec ce service : l'heure de fin est calculée à partir d'une durée absente et retombe sur la durée par défaut du créneau, ce qui produit un rendez-vous plus court ou plus long que prévu. Le contrôle d'intégrité prévu en base (`duration > 0`) n'a pas joué, puisque la valeur a été convertie en `NULL` au lieu d'être refusée.

**Correctif** : `duration: Number(duration) > 0 ? Number(duration) : 60` **ou** refuser explicitement 0/absence (`400`).
**Effort** : XS

---

## BUG-36 — « Supprimer le patient » détruit l'historique au lieu de l'archiver

**Zone** : `backend/src/modules/patients.ts` (`DELETE /patients/:id`), schéma `patients`, écrans Patients / Paiements / RDV

**Comportement actuel (mesuré)**

La route serveur supprime **d'abord les paiements**, puis tente de supprimer les rendez-vous, puis la fiche — **sans transaction** :

```ts
await query('DELETE FROM payments WHERE patient_id = $1', [id]);      // 1. encaissements effacés
await query('DELETE FROM appointments WHERE id IN (...)', [id]);      // 2. échoue (BUG-02)
await query('DELETE FROM patients WHERE id = $1', [id]);              // 3. jamais atteint si des RDV existent
```

| Situation du patient | Réponse | Ce qui se passe réellement |
|---|---|---|
| Paiements **+** rendez-vous | **500** | Paiements **supprimés**, solde remis à 0, fiche et RDV conservés |
| Paiements, **aucun** rendez-vous | **200** | Fiche supprimée **avec tout son historique d'encaissements**, packs, notes, évaluations, motifs, liste d'attente |
| Aucun paiement, des rendez-vous | **500** | Rien n'est supprimé (BUG-02) |
| Aucun paiement, aucun rendez-vous | **200** | Suppression complète |

Simulation complète (transaction annulée) sur un patient sans rendez-vous :

```
AVANT : patient 1 · paiements 1 · packs 1 · évaluations 1 · motifs 1 · liste d'attente 1
APRÈS : patient 0 · paiements 0 · packs 0 · évaluations 0 · motifs 0 · liste d'attente 0
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
2. Le problème des `DELETE` en cascade et du trigger `sync_patient_practitioner` **disparaît du parcours utilisateur** : la route ne supprime plus de rendez-vous. BUG-02 reste à corriger, mais uniquement pour les scripts de maintenance.
3. La contrainte `RESTRICT` de `payments` retrouve son rôle protecteur : elle n'est plus contournée.
4. L'action devient **réversible** et traçable (date + auteur de la suppression).

**Scénario de reproduction**

Une patiente quitte le cabinet et demande que son dossier soit supprimé. La secrétaire clique sur la corbeille, lit « Cette action est irréversible » et confirme.

Si la patiente n'a jamais eu de rendez-vous, la fiche disparaît, l'opération semble réussie. Six mois plus tard, lors de la vérification comptable, la gérante ne retrouve plus aucun encaissement au nom de cette patiente : le chiffre d'affaires de l'année a silencieusement diminué d'autant, et il n'existe plus aucune pièce pour justifier les séances réalisées.

Si la patiente a des rendez-vous, c'est l'inverse : la fiche reste affichée et une erreur 500 s'affiche, mais son historique de paiements a déjà été détruit. Son solde tombe à 0 et elle apparaît comme n'ayant jamais rien réglé — un litige devient impossible à trancher.

Dans les deux cas, la suppression d'une seule patiente peut, à terme, emporter un rendez-vous **partagé** (calendrier Coach) et les comptes rendus des autres patients qui y étaient associés.


**Impact**

- **Perte définitive d'écritures comptables, de comptes rendus et d'évaluations** sur une simple action d'interface.
- Chiffre d'affaires et soldes faussés rétroactivement, sans aucun signal.
- Aucune atomicité : un échec laisse la base dans un état intermédiaire (solde faux, patient orphelin de son historique).
- Action irréversible, sans corbeille ni restauration.
- Effet de bord possible sur les autres patients d'un rendez-vous partagé.

> ⚠️ **Lien avec BUG-02 — même trigger, deux défauts distincts.**
>
> | Défaut | Responsable | Conséquence |
> |---|---|---|
> | `DELETE FROM appointments` impossible | trigger `trg_sync_patient_practitioner` | 500 sur la suppression du patient |
> | Paiements supprimés **avant** l'échec | route `DELETE /patients/:id` (aucune transaction) | historique comptable effacé |
> | Paiements supprimés **tout court** | choix de conception de la route | écritures perdues même en cas de succès |
>
> **Ordre de correction impératif** : d'abord la route (passage en suppression logique), ensuite le trigger. Corriger le trigger seul transformerait « 500 + paiements perdus » en « succès + paiements perdus », c'est-à-dire un bug **silencieux**, donc pire.

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

Les 8 premiers bugs ont été corrigés et poussés sur `main` le **19/11/2026**, un commit par bug.

| Bug | Commit | Correctif | Vérification effectuée |
|---|---|---|---|
| BUG-01 | `52fae77` | Filtre `type === 'psy'` supprimé | Services visibles sur Admin, Psy et Coach |
| BUG-02 | `e02ef1f` | Trigger scindé `AFTER` / `BEFORE DELETE` + sync sur la jonction | 6 scénarios SQL (dont suppression du dernier RDV → `NULL`) |
| BUG-03 | `354db31` | `must_change_password`, middleware 403, écran bloquant | 8 étapes : login → 403 → changement → 200 → ancien mdp refusé |
| BUG-04 | `9a117d5` | `/payments/summary` + total exact + indicateur de troncature | `count = 21`, `total = 6 906 461` identiques à l'écran |
| BUG-05 | `d61887a` | 409 `PACK_REQUIRED` + popup rouverte | `complete` sans pack → 409, avec pack → 200 |
| BUG-06 | `0f34e4c` | Packs épuisés masqués + décrément conditionnel + CHECK | `total_sessions = -3` refusé par la contrainte |
| BUG-07 | `41b872f` | `status` rétabli, cohérence abandon, évaluations | `Abandon` sans motif → 400 ; une seule ligne d'évaluation créée |
| BUG-08 | `6a46e3f` | Référence obligatoire + index unique | doublon → 409, référence vide → 400 |
| BUG-09 | `79cec89` | « Pack vendu » = au moins une séance terminée (`firstUsedAt`) | Pack créé sans séance → non compté ; pack avec 1 séance → compté |

### 3.1 Migrations SQL appliquées en base

| Fichier | Objet |
|---|---|
| `sql/fix_sync_patient_practitioner.sql` | Trigger praticien (BUG-02) |
| `sql/must_change_password.sql` | Colonne `users.must_change_password` (BUG-03) |
| `sql/patient_packs_bounds.sql` | Bornes `total_sessions` / `remaining_sessions` (BUG-06) |
| `sql/patients_status.sql` | Colonne `patients.status` + CHECK (BUG-07) |
| `sql/invoices_reference_unique.sql` | Index unique sur la référence de facture (BUG-08) |

> `sql/integrity_fixes.sql` a également été mis à jour : une installation neuve obtient directement la version corrigée du trigger.

### 3.2 Ce qui reste ouvert après ce lot

| Élément | Bug lié | Statut |
|---|---|---|
| Suppression logique `patients.is_deleted` | BUG-36 | **Ouvert** — la route `DELETE /patients/:id` supprime encore les paiements |
| Affichage du mot de passe provisoire à l'admin | BUG-03 | Amélioration non bloquante |
| Lien évaluation ↔ rendez-vous (`patient_outcomes.appointment_id`) | BUG-07 | Amélioration non bloquante |
| Lien pack ↔ paiement (`payments.pack_id`) | BUG-09 | Amélioration non bloquante (distinguer « vendu » et « encaissé ») |
| Pack auto-créé d'un RDV annulé conservé | BUG-09 | Amélioration non bloquante (nettoyage à décider) |
| `DELETE` de RDV depuis l'interface | — | Toujours impossible côté UI (par conception) |
| Bugs BUG-09 → BUG-35 | — | **Ouverts** (voir § 2) |

---

## 4. Plan de correction recommandé

> ✅ = corrigé et poussé (voir § 3).

### Lot 1 — Bloquants (½ journée)
`BUG-01` ✅ · `BUG-02` ✅ · `BUG-06` ✅ · `BUG-14` · `BUG-15` · `BUG-19` · `BUG-20` · `BUG-21` · `BUG-22` · `BUG-26` · `BUG-27` · `BUG-35`

### Lot 2 — Fiabilité des données (1 à 2 jours)
`BUG-03` ✅ · `BUG-04` ✅ · `BUG-05` ✅ · `BUG-07` ✅ · `BUG-08` ✅ · `BUG-11` · `BUG-12` · `BUG-13` · `BUG-16` · `BUG-17` · `BUG-36`

### Lot 3 — Finitions et durcissement (2 à 4 jours)
`BUG-09` ✅ · `BUG-10` · `BUG-18` · `BUG-23` · `BUG-24` · `BUG-25` · `BUG-28` · `BUG-29` · `BUG-30` · `BUG-31` · `BUG-32` · `BUG-33` · `BUG-34`

### Ordre d'application des migrations SQL
1. `fix_sync_patient_practitioner.sql` (BUG-02) — **avant tout nettoyage de RDV**
2. `data_reconciliation.sql` (BUG-16) — nettoyer avant les contraintes
3. `schema_constraints.sql` (BUG-12) — CHECK + bornes
4. `unique_indexes.sql` (BUG-08, BUG-15)
5. `pack_origin.sql` (BUG-09)

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
