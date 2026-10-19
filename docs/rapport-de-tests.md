# Rapport / Plan de tests — BrainCareDZ

> **Nature du document** : plan de test exhaustif (liste des tests à réaliser). Aucune exécution n'est incluse : la colonne **Statut** est à remplir pendant la campagne. Les tests couvrent le backend (API + règles métier + base de données), le frontend (toutes les pages), les rôles/autorisations, les parcours E2E et les cas limites y compris ceux de probabilité < 1 %.

---

## 0. Fiche documentaire

| Champ | Valeur |
|---|---|
| Projet | BrainCareDZ — gestion de cabinet de psychologie & neurofeedback |
| Stack | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 · Express 4 (backend TS) · PostgreSQL |
| URL frontend (dev) | `http://localhost:3000` |
| URL backend (dev) | `http://localhost:5001/api` (`NEXT_PUBLIC_API_PORT=5001`, `PORT=5001`) |
| Base de données | PostgreSQL, base `Braincare` (voir `backend/.env`) |
| Date de rédaction | 2026-10-11 |
| Auteur | Généré par analyse statique du code (aucune exécution) |
| Périmètre | 15 modules backend, 40+ endpoints, 18 écrans frontend, 4 scripts, 5 fichiers SQL, 24 déclencheurs/contraintes |
| Hors périmètre | Tests de charge massifs, tests d'exploitation Railway, audits de sécurité externes (pentest) |

---

## 1. Conventions

### 1.1 Colonnes

| Colonne | Signification |
|---|---|
| **ID** | Identifiant unique du test (`MODULE-xx`) |
| **Test** | Objectif du test |
| **Attendu** | Résultat attendu (code HTTP, contenu, comportement UI) |
| **Sév.** | Sévérité de l'anomalie si le test échoue : **C**ritique / **M**ajeur / **m**ineur |
| **Prob.** | Probabilité du scénario : Élevée / Moyenne / Faible / **<1%** |
| **Statut** | `À exécuter` / `OK` / `KO` / `Bloqué` / `N/A` |

### 1.2 Préfixes de modules

`ENV` environnement/config · `AUTH` authentification · `USR` utilisateurs · `PAT` patients · `SVC` services · `APT` rendez-vous · `SN` comptes rendus · `PAY` paiements · `PCK` packs · `OUT` évaluations · `WLT` liste d'attente · `EXP` dépenses · `COM` entreprises · `INV` factures entreprises · `SET` paramètres · `LOG` journal d'activité · `DB` base de données · `UI` frontend · `E2E` parcours · `EDGE` cas limite rare · `NFR` non-fonctionnel · `RISK` risque identifié.

### 1.3 Jeux de données de référence à créer avant campagne

| Alias | Objet |
|---|---|
| `P-ADULTE` | Patient adulte majeur, complet (identité + situation + motif + historique + source) |
| `P-MINEUR` | Patient mineur (< 18 ans) |
| `P-NOUVEAU` | Patient sans aucun RDV complété (prospect) |
| `P-SOLDE-NEG` | Patient avec solde strictement négatif |
| `P-SANS-SERVICE` | Patient avec RDV « pack différé » sans service |
| `U-ADMIN` | Utilisateur rôle `admin` |
| `U-PSY` | Utilisateur rôle `psy` |
| `U-COACH` | Utilisateur rôle `coach` |
| `S-NEURO8` | Service `type=neurofeedback`, 8 séances, prix > 0 |
| `S-CONSULT` | Service `type=consultation`, 1 séance |
| `S-PACK-DISPO` | Service pack avec `remaining_sessions` > 0 |

> **Isolation** : exécuter les campagnes destructives (suppression patient, packs, solde) sur une base de recette clonée, ou capturer/restaurer le solde de référence d'un patient témoin.

---

## 2. Environnement, prérequis et comptes

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| ENV-01 | PostgreSQL démarré et base `Braincare` accessible | Connexion OK, `[db] PostgreSQL connected successfully` | C | — | À exécuter |
| ENV-02 | `backend/.env` complet (DB_*, JWT_SECRET ≥ 32, PORT, FRONTEND_URL) | Démarrage sans erreur | C | — | À exécuter |
| ENV-03 | `NEXT_PUBLIC_API_URL` défini côté front (`app` build) | `resolveApiBaseUrl()` ne lève pas d'exception | C | — | À exécuter |
| ENV-04 | `npm --prefix backend run dev` puis `npm run dev` | Backend `:5001`, front `:3000` | C | — | À exécuter |
| ENV-05 | `npm --prefix backend run typecheck` | 0 erreur TypeScript | M | — | À exécuter |
| ENV-06 | `npm run build` (front) | Build OK (⚠ réseau Google Fonts geist/rozha_one : relancer si échec transitoire) | M | Faible | À exécuter |
| ENV-07 | `npm run lint` | Aucune erreur bloquante | m | — | À exécuter |
| ENV-08 | `npm audit` backend + frontend | 0 vulnérabilité | M | — | À exécuter |
| ENV-09 | Script `npm run seed` | Crée 4 utilisateurs, 3 patients, 8 services, 2 RDV, 1 note, 1 paiement | M | — | À exécuter |
| ENV-10 | Script `npm run create-admin` (base vide puis base avec admin existant) | Création puis mise à jour idempotente | M | — | À exécuter |
| ENV-11 | `backend/package.json` script `db:init` → `sql/init_postgres.sql` **absent du dépôt** | Échec → anomalie documentaire à confirmer | m | Élevée | À exécuter |
| ENV-12 | `npx next build` après `npm ci` propre (node_modules vierge) | Build reproductible | M | Faible | À exécuter |

### 2.1 Comptes de test attendus (issus des scripts)

| Identifiant | Mot de passe | Rôle | Source |
|---|---|---|---|
| `admin@example.com` / `admin` | `Admin123!` | admin | seed / create-admin |
| `test@gmail.com` / `test_user` | `1234` | psy | seed |
| `practitioner@example.com` / `practitioner_one` | `password123` | psy | seed |
| `receptionist@example.com` / `receptionist` | `password123` | coach | seed |
| tout utilisateur créé via l'UI | `123456789` | rôle choisi | `POST /api/users` |

---

## 3. Matrice des rôles et autorisations (« approbations »)

**Constat de conception** : il n'existe **aucun workflow d'approbation** (pas d'état « en attente d'approbation », pas de double validation, pas de circuit de signature). Toute écriture est appliquée immédiatement. La notion d'« approbation » se traduit donc ici exclusivement par le **contrôle d'autorisation par rôle** (approbation implicite de l'action). Cette matrice doit être vérifiée écran par écran et endpoint par endpoint.

### 3.1 Rôles

| Rôle technique | Libellé UI | Calendrier dédié |
|---|---|---|
| `admin` | Admin | Oui (toggle Admin/Psy/Coach, réservé admin) |
| `psy` | Psy | Oui · 1 RDV par créneau |
| `coach` | Coach | Oui · jusqu'à 4 RDV par créneau |

### 3.2 Matrice d'accès (frontend)

| Page | admin | psy | coach | Non connecté |
|---|---|---|---|---|
| `/login` | ✔ | ✔ | ✔ | ✔ |
| `/` (Tableau de bord) | ✔ | ✔ | ✔ | → `/login` |
| `/patients`, `/patients/[id]`, `/patients/[id]/edit`, `/patients/[id]/notes` | ✔ | ✔ | ✔ | → `/login` |
| `/appointments`, `/appointments/[id]/report` | ✔ | ✔ | ✔ | → `/login` |
| `/payments`, `/payments/[id]/edit` | ✔ | ✔ | ✔ | → `/login` |
| `/company-invoices`, `/company-invoices/new`, `/company-invoices/companies/[id]/edit` | ✔ | ✔ | ✔ | → `/login` |
| `/reports`, `/analytics` | ✔ | ✔ | ✔ | → `/login` |
| `/expenses`, `/expenses/[id]` | ✔ | ✖ → `/` | ✖ → `/` | → `/login` |
| `/admin` | ✔ | ✖ → `/` | ✖ → `/` | → `/` |
| Item de menu « Charges et dépenses » | visible | masqué | masqué | — |
| Item de menu « Admin » (menu utilisateur) | visible | masqué | masqué | — |
| Toggle de rôle du calendrier | visible | masqué | masqué | — |
| Onglet « Attente » (vue RDV) | visible si rôle psy | visible si rôle psy | masqué | — |

### 3.3 Matrice d'accès (API)

| Endpoint (méthode) | Rôle requis | Comportement refus |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout` | public | 400/401 |
| `GET /auth/me` | tout authentifié | 401 |
| `GET /users`, `GET /users/:id`, `POST/PUT/DELETE /users`, `PUT /users/:id/password` | admin | 403 `{error:'Access denied. Admin only.'}` |
| `GET /users/practitioners` | tout authentifié | 401 |
| `PUT /users/me/password` | tout authentifié | 401 (mauvais mdp) |
| `GET /patients*` | tout authentifié | 401 |
| `POST/PUT/DELETE /patients` | tout authentifié | 401 |
| `GET /services*` | tout authentifié | 401 |
| `POST/PUT/DELETE /services` | admin **ou** psy | 403 |
| `GET/POST/PUT/DELETE /appointments*` | tout authentifié (règles internes de propriété) | 401/403/400 |
| `PUT /appointments/:id/complete` | propriétaire ou admin | 403 |
| `/session-notes*` | tout authentifié (règle psy/coach au POST) | 401/403/409 |
| `/payments*` | tout authentifié | 401 |
| `/patient-packs*` | tout authentifié | 401 |
| `/patient-outcomes*` | tout authentifié | 401 |
| `/waiting-list*` | tout authentifié | 401 |
| `/expenses*` | **admin** | 403 |
| `/companies*`, `/company-invoices*` | tout authentifié | 401 |
| `GET /settings/patient-lists` | tout authentifié | 401 |
| `PUT /settings/patient-lists` | admin | 403 |
| `GET /settings/calendar-settings[/:role]` | tout authentifié | 401/404 |
| `PUT /settings/calendar-settings/:role` | admin | 403 |
| `GET /activity-logs` | admin | 403 |

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| ROLE-01 | Vérifier que `authorize()` compare bien `admin/psy/coach` (et **non** `practitioner/receptionist`) | Les tests psy/coach passent ; aucune référence `receptionist`/`practitioner` dans les modules actifs | C | Moyenne | À exécuter |
| ROLE-02 | Chaque cellule ✔/✖ de 3.2 vérifiée manuellement | Conforme | M | — | À exécuter |
| ROLE-03 | Chaque ligne de 3.3 vérifiée par appel direct (curl/Postman) avec le mauvais rôle | Code attendu (401/403) | C | — | À exécuter |
| ROLE-04 | Utilisateur supprimé pendant une session : appel API avec cookie encore valide | 401 (car `token_version`/ligne absente) | C | Faible | À exécuter |

---

## 4. Tests transverses

### 4.1 Infrastructure et robustesse HTTP

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| ENV-20 | `GET /api/health` | 200 `{success:true,message:'Server is running'}` | M | — | À exécuter |
| ENV-21 | `GET /api/inexistant` | 404 `{success:false,message:'Route not found'}` | m | — | À exécuter |
| ENV-22 | JSON malformé envoyé sur un POST | 400 (gestionnaire d'erreurs), pas de crash | M | Moyenne | À exécuter |
| ENV-23 | Corps JSON > 100 ko | 413 (limite `express.json({limit:'100kb'})`) | M | Faible | À exécuter |
| ENV-24 | Erreur interne forcée (ex. service indisponible) | 500 `{message:'Something went wrong'}`, **aucune** fuite de `error.message` | C | Faible | À exécuter |
| ENV-25 | En-tête `x-powered-by` | Absent | m | — | À exécuter |
| ENV-26 | En-têtes Helmet présents (`Content-Security-Policy`, `X-Content-Type-Options`, etc.) | Présents | M | — | À exécuter |
| ENV-27 | `crossOriginResourcePolicy: cross-origin` | Ressources consommables en cross-origin | m | — | À exécuter |
| ENV-28 | Les 16 modules ne renvoient jamais `error.message` brut | Conforme | C | Faible | À exécuter |

### 4.2 Authentification et session

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| AUTH-01 | Login par **pseudo** exact | 200 + cookie `token` httpOnly | C | — | À exécuter |
| AUTH-02 | Login par **e-mail** (minuscules/majuscules mixtes) | 200 (comparaison `LOWER(email)`) | M | — | À exécuter |
| AUTH-03 | Login pseudo inexistant | 401 « Invalid pseudo or password » | M | — | À exécuter |
| AUTH-04 | Login bon pseudo / mauvais mot de passe | 401 (message identique, pas d'énumération) | C | — | À exécuter |
| AUTH-05 | Login sans `pseudo` / sans `password` | 400 + liste d'erreurs | M | — | À exécuter |
| AUTH-06 | Cookie retourné : `HttpOnly`, `Path=/`, `Max-Age` ≈ 7 j, `SameSite=Lax` en dev / `None` + `Secure` en prod | Conforme | M | — | À exécuter |
| AUTH-07 | `GET /auth/me` avec cookie valide | 200 + `{id,name,pseudo,firstName,lastName,role,phone}` | M | — | À exécuter |
| AUTH-08 | `GET /auth/me` sans cookie / cookie falsifié / expiré | 401 | C | — | À exécuter |
| AUTH-09 | `GET /auth/me` avec `Authorization: Bearer <jwt>` | 200 (voie Bearer supportée) | M | — | À exécuter |
| AUTH-10 | JWT modifié (signature invalide) | 401 | C | Faible | À exécuter |
| AUTH-11 | JWT expiré (> 7 j) | 401 | C | Faible | À exécuter |
| AUTH-12 | `token_version` incrémenté en base → ancien JWT rejeté | 401 | C | Faible | À exécuter |
| AUTH-13 | `POST /auth/logout` : cookie effacé + `token_version` +1 | 200 ; réutilisation de l'ancien token → 401 | C | — | À exécuter |
| AUTH-14 | `POST /auth/logout` **sans** token | 200 (idempotent), pas d'erreur | m | Moyenne | À exécuter |
| AUTH-15 | `POST /auth/logout` avec token corrompu | 200, cookie effacé, `token_version` non incrémenté | m | Faible | À exécuter |
| AUTH-16 | Ligne `LOGIN` du journal porte bien le **nom** de l'utilisateur (pas « Unknown ») | `user_name` renseigné | M | Moyenne | À exécuter |
| AUTH-17 | Contexte de session PostgreSQL (`app.user_*`) renseigné pendant les requêtes authentifiées | Trigger d'audit voit l'utilisateur | M | — | À exécuter |
| AUTH-18 | Après libération de la connexion, un appel suivant **non authentifié** ne récupère pas le contexte précédent | Aucune fuite de contexte | C | Faible | À exécuter |
| AUTH-19 | Front : accès à une page protégée sans session → redirection `/login` | Redirection | M | — | À exécuter |
| AUTH-20 | Front : après login, redirection vers `/` ; message d'erreur explicite si backend éteint | Conforme | m | Moyenne | À exécuter |
| AUTH-21 | Front : modal « Modifier le mot de passe » (actuel / nouveau / confirmation) | Validations : requis, ≥ 6 caractères, confirmation identique | M | — | À exécuter |
| AUTH-22 | Changement de mot de passe réussi puis reconnexion avec l'ancien mdp | Ancien refusé (401), nouveau accepté | M | — | À exécuter |

### 4.3 Sécurité

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| NFR-SEC-01 | Rate limit login : 11 tentatives en < 15 min | 11ᵉ → 429 + message « Trop de tentatives… » | M | — | À exécuter |
| NFR-SEC-02 | Rate limit global : > 1000 requêtes / 15 min | 429 | m | Faible | À exécuter |
| NFR-SEC-03 | CORS : origine non autorisée | Pas d'en-tête `Access-Control-Allow-Origin` | M | — | À exécuter |
| NFR-SEC-04 | CORS : `localhost`, `127.0.0.1`, IP privées (10.x, 192.168.x, 172.16-31.x) hors prod | Autorisées | m | Moyenne | À exécuter |
| NFR-SEC-05 | CORS : `credentials: true` | Cookie transmis en cross-origin | M | — | À exécuter |
| NFR-SEC-06 | Injection SQL via paramètres (`search`, tri, filtre) | Requêtes paramétrées ; tri limité à la liste blanche `PATIENT_SORTS` | C | Faible | À exécuter |
| NFR-SEC-07 | Démarrage backend avec `JWT_SECRET` absent ou < 32 caractères | `process.exit(1)` immédiat | C | Faible | À exécuter |
| NFR-SEC-08 | Cookie `Secure` en production, `SameSite=None` en production | Conforme | M | — | À exécuter |
| NFR-SEC-09 | XSS : contenu patient/notes affiché (échappement React) | Aucun script exécuté | M | Faible | À exécuter |
| NFR-SEC-10 | IDOR : accéder à `/patients/:id`, `/payments/:id`, `/appointments/:id` d'un tiers avec un rôle non-admin | **Constat** : toutes les routes GET détail ne filtrent pas par propriétaire → accès autorisé pour tout authentifié (à valider comme choix métier « tous voient tout ») | M | — | À exécuter |

### 4.4 Journal d'activité / audit

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| LOG-01 | `GET /activity-logs` par admin | 200 `{logs,total,limit,offset}` | M | — | À exécuter |
| LOG-02 | `GET /activity-logs` par psy/coach | 403 | M | — | À exécuter |
| LOG-03 | Filtres `action`, `userId`, `resource` | Résultats filtrés + `total` cohérent | m | — | À exécuter |
| LOG-04 | Pagination `limit`/`offset` (50/page côté UI) | Conforme | m | — | À exécuter |
| LOG-05 | Chaque création/modification/suppression métier génère une ligne d'audit (trigger `fn_audit_log`) | `resource`, `resource_name`, `changes.old/new` renseignés | M | — | À exécuter |
| LOG-06 | Colonne `activity_logs.user_pseudo` : présente en base ? (`ensureSchema` ne la crée pas) | Si absente → `GET /activity-logs` renvoie 500 et les logs manuels échouent silencieusement | C | Faible | À exécuter |
| LOG-07 | Actions applicatives tracées : `LOGIN`, `CANCEL`, `COMPLETE`, `CREATE`/`UPDATE`/`DELETE` (waiting-list, settings) | Présentes | m | — | À exécuter |
| LOG-08 | Le libellé `resource_name` est résolu (backfill `backfill_resource_name.sql`) | Non vide pour les entités connues | m | — | À exécuter |
| LOG-09 | Échec d'insertion d'audit (table verrouillée) → l'opération métier n'échoue pas | `logActivity` avale l'erreur | m | <1% | À exécuter |

---

## 5. Tests API par module

> Format : chaque ligne est un cas de test. « Rôle » = rôle de l'appelant. Les cas « nominal » supposent un jeu de données valide.

### 5.1 `auth` — `/api/auth`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-AUTH-01 | `POST /login` nominal (pseudo) | public | 201/200 + user | C | — | À exécuter |
| API-AUTH-02 | `POST /login` nominal (email) | public | 200 + user | M | — | À exécuter |
| API-AUTH-03 | `POST /login` champs manquants | public | 400 | M | — | À exécuter |
| API-AUTH-04 | `POST /login` identifiants invalides | public | 401 | M | — | À exécuter |
| API-AUTH-05 | `POST /login` pseudo de type numérique ou avec espaces | public | 200 ou 401 propre, pas de 500 | m | Faible | À exécuter |
| API-AUTH-06 | `POST /login` pseudo = `" OR 1=1 --` | public | 401 (paramétré) | C | <1% | À exécuter |
| API-AUTH-07 | `POST /logout` avec/sans token | public | 200 | m | — | À exécuter |
| API-AUTH-08 | `GET /me` valide / invalide | auth / — | 200 / 401 | M | — | À exécuter |
| API-AUTH-09 | `GET /me` pour un utilisateur supprimé | auth | 404 | m | Faible | À exécuter |
| API-AUTH-10 | 11 logins erronés consécutifs | public | 429 au 11ᵉ | M | — | À exécuter |

### 5.2 `users` — `/api/users`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-USR-01 | `GET /users` liste (≤ 500) avec `services`, `patientCount` | admin | 200 `{data:{users,total}}` | M | — | À exécuter |
| API-USR-02 | `GET /users` non-admin | psy/coach | 403 | M | — | À exécuter |
| API-USR-03 | `GET /users/practitioners` renvoie **tous** les utilisateurs + `role` | auth | 200 | M | — | À exécuter |
| API-USR-04 | `GET /users/:id` admin / inexistant | admin | 200 / 404 | m | — | À exécuter |
| API-USR-05 | `POST /users` nominal (prénom, nom, rôle) | admin | 201, pseudo `prenom_nom`, mdp `123456789`, connexion possible | M | — | À exécuter |
| API-USR-06 | `POST /users` champs manquants | admin | 400 | M | — | À exécuter |
| API-USR-07 | `POST /users` pseudo déjà existant | admin | 400 « already exists » | M | Moyenne | À exécuter |
| API-USR-08 | `POST /users` avec `serviceIds` (rôle psy/coach) | admin | `practitioner_services` alimenté | M | — | À exécuter |
| API-USR-09 | `POST /users` avec accents/majuscules (pseudo généré) | admin | Pseudo cohérent ; 2ᵉ création même pseudo → 400 | m | Moyenne | À exécuter |
| API-USR-10 | `POST /users` rôle invalide (ex. `root`) | admin | Insertion acceptée (pas de validation de rôle) → **à confirmer**, risque d'incohérence | M | Faible | À exécuter |
| API-USR-11 | `PUT /users/:id` partiel (nom, rôle, téléphone) | admin | 200 ; services remplacés si `serviceIds` fourni | M | — | À exécuter |
| API-USR-12 | `PUT /users/:id` changement vers pseudo déjà pris | admin | 400 | m | Faible | À exécuter |
| API-USR-13 | `PUT /users/:id` inexistant | admin | 404 | m | — | À exécuter |
| API-USR-14 | `PUT /users/:id` avec `serviceIds: []` | admin | Toutes les affectations supprimées | m | Moyenne | À exécuter |
| API-USR-15 | `DELETE /users/:id` inexistant | admin | 404 | m | — | À exécuter |
| API-USR-16 | `DELETE /users/:id` avec RDV/notes liés | admin | 200 (CASCADE) ou erreur FK selon contraintes — vérifier l'effet réel | M | Moyenne | À exécuter |
| API-USR-17 | `PUT /users/me/password` nominal | auth | 200 ; nouveau mdp actif | M | — | À exécuter |
| API-USR-18 | `PUT /users/me/password` mauvais actuel | auth | 401 | M | — | À exécuter |
| API-USR-19 | `PUT /users/me/password` nouveau < 6 | auth | 400 | m | — | À exécuter |
| API-USR-20 | `PUT /users/:id/password` admin nominal / non-admin | admin / psy | 200 / 403 | M | — | À exécuter |
| API-USR-21 | `PUT /users/:id/password` mot de passe < 6 | admin | 400 | m | — | À exécuter |
| API-USR-22 | Routage : `PUT /users/me/password` ne doit **pas** être capté par `PUT /:id/password` | auth | 200 (bon contrôleur) | M | Faible | À exécuter |

### 5.3 `patients` — `/api/patients`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-PAT-01 | `GET /patients` (cap 2000) | auth | 200 `{count,patients}` | M | — | À exécuter |
| API-PAT-02 | `GET /patients/search/:q` (nom/email, ≤ 10) | auth | 200 | m | — | À exécuter |
| API-PAT-03 | `GET /patients/paged` page/pageSize par défaut (1/25) | auth | 200 `{data:{patients,total,page,pageSize}}` | M | — | À exécuter |
| API-PAT-04 | `pageSize` = 0 / 500 / négatif | auth | Borné à [1, 100] | m | Moyenne | À exécuter |
| API-PAT-05 | `page` non numérique / négative | auth | Ramenée à 1, pas de 500 | m | Moyenne | À exécuter |
| API-PAT-06 | `sort` = clé inconnue | auth | Repli sur `createdAt` | m | Faible | À exécuter |
| API-PAT-07 | `sort` = `balance`, `order=asc` | auth | Tri croissant correct | m | — | À exécuter |
| API-PAT-08 | Filtres `minSessions`/`maxSessions`/`minBalance`/`maxBalance` | auth | Filtrage exact | M | — | À exécuter |
| API-PAT-09 | Filtre `isProspect=true` | auth | Uniquement patients sans RDV complété | M | — | À exécuter |
| API-PAT-10 | Filtre `search` avec `%` ou `_` (caractères jokers LIKE) | auth | Comportement à valider (les jokers ne sont pas échappés) | m | Faible | À exécuter |
| API-PAT-11 | `GET /patients/:id` existant / inexistant | auth | 200 / 404 | M | — | À exécuter |
| API-PAT-12 | `POST /patients` nominal complet (5 étapes du formulaire) | auth | 201 + patient | M | — | À exécuter |
| API-PAT-13 | `POST /patients` sans prénom/nom/téléphone | auth | 400 | M | — | À exécuter |
| API-PAT-14 | `POST /patients` email invalide | auth | 400 | M | — | À exécuter |
| API-PAT-15 | `POST /patients` email vide / null | auth | Accepté (optionnel `falsy`) | m | Moyenne | À exécuter |
| API-PAT-16 | `POST /patients` `gender` invalide (ex. `xyz`) | auth | 400 « Gender value is invalid » | m | Faible | À exécuter |
| API-PAT-17 | `POST /patients` `gender` en français (`Homme`, `Femme`) | auth | Normalisé `male`/`female` | m | — | À exécuter |
| API-PAT-18 | `POST /patients` profession/motif inconnus | auth | Création automatique dans `professions`/`motifs` | M | Moyenne | À exécuter |
| API-PAT-19 | `POST /patients` avec champs d'évaluation (amélioration, satisfaction, recommander) | auth | Ligne insérée dans `patient_outcomes` | M | — | À exécuter |
| API-PAT-20 | `POST /patients` `consultationReasons: []` | auth | Aucun motif lié | m | Moyenne | À exécuter |
| API-PAT-21 | `PUT /patients/:id` partiel | auth | 200, champs non fournis conservés | M | — | À exécuter |
| API-PAT-22 | `PUT /patients/:id` inexistant | auth | 404 | m | — | À exécuter |
| API-PAT-23 | `PUT /patients/:id` `email`/`phone` → chaîne vide | auth | `COALESCE` conserve l'ancienne valeur (pas d'effacement possible) → **comportement à valider** | M | Moyenne | À exécuter |
| API-PAT-24 | `PUT /patients/:id` `gender:''` | auth | `gender = normalizeGender('')` = null → **efface** le genre (incohérence avec POST) | m | Faible | À exécuter |
| API-PAT-25 | `GET /patients/:id/history` | auth | RDV du patient triés desc | M | — | À exécuter |
| API-PAT-26 | `GET /patients/:id/history` pour un patient avec RDV **sans service** (pack différé) | auth | L'INNER JOIN `services` **exclut** ces RDV → historique incomplet (anomalie à confirmer) | M | Moyenne | À exécuter |
| API-PAT-27 | `GET /patients/:id/history` patient sans RDV | auth | 200 `[]` | m | — | À exécuter |
| API-PAT-28 | `DELETE /patients/:id` | auth | 200 ; paiements, RDV, junctions, notes, packs supprimés en cascade | M | — | À exécuter |
| API-PAT-29 | `DELETE /patients/:id` inexistant | auth | 404 | m | — | À exécuter |
| API-PAT-30 | `DELETE` d'un patient partageant un RDV multi-patients | auth | **Le RDV entier est supprimé** (impact sur les autres patients) → anomalie à confirmer | M | Faible | À exécuter |
| API-PAT-31 | Champs calculés de la liste : `practitionerName` (dernier praticien), `practitioners[]` (historique), `packServiceName`, `packTotal`, `packRemaining`, `packPricePerSession`, `packList`, `consecutiveNoShows`, `isProspect`, `balance` | auth | Cohérents avec les données réelles | M | — | À exécuter |
| API-PAT-32 | `consecutiveNoShows` : 3 annulations consécutives | auth | 3 ; nom affiché rouge côté UI | M | Moyenne | À exécuter |
| API-PAT-33 | `isProspect` : patient avec 1 RDV complété | auth | `false` | M | — | À exécuter |

### 5.4 `services` — `/api/services`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-SVC-01 | `GET /services` (actifs seulement, ≤ 500) | auth | 200 | M | — | À exécuter |
| API-SVC-02 | `GET /services/:id` inactif (supprimé logiquement) | auth | 200 (pas de filtre `is_active`) → **comportement à valider** | m | Faible | À exécuter |
| API-SVC-03 | `POST /services` nominal (admin) | admin | 201 | M | — | À exécuter |
| API-SVC-04 | `POST /services` nominal (psy) / coach | psy / coach | 201 / 403 | M | — | À exécuter |
| API-SVC-05 | `POST /services` nom vide | admin | 400 | M | — | À exécuter |
| API-SVC-06 | `POST /services` prix négatif / non numérique | admin | 400 | M | — | À exécuter |
| API-SVC-07 | `POST /services` prix = 0 | admin | 201 (min 0 autorisé) | m | Moyenne | À exécuter |
| API-SVC-08 | `POST /services` `sessions` = 0 / 1.5 / absent | admin | 400 / 400 / défaut 1 | M | — | À exécuter |
| API-SVC-09 | `POST /services` `type` invalide (ex. `xyz`) | admin | Accepté (pas de validation) → **à confirmer** | m | Faible | À exécuter |
| API-SVC-10 | `PUT /services/:id` prix/sessions invalides | admin | 400 | M | — | À exécuter |
| API-SVC-11 | `PUT /services/:id` inexistant | admin | 404 | m | — | À exécuter |
| API-SVC-12 | `DELETE /services/:id` = désactivation logique | admin | 200 ; service absent de `GET /services` ; RDV existants conservés | M | — | À exécuter |
| API-SVC-13 | `DELETE /services/:id` inexistant | admin | 404 | m | — | À exécuter |
| API-SVC-14 | Suppression d'un service utilisé par des packs/RDV | admin | 200 (soft delete) ; pas de perte de données | M | Moyenne | À exécuter |

### 5.5 `appointments` — `/api/appointments`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-APT-01 | `GET /appointments` (cap 2000) | auth | 200 `{data:{appointments}}` | M | — | À exécuter |
| API-APT-02 | `GET /appointments?startDate&endDate` | auth | Filtré | m | — | À exécuter |
| API-APT-03 | `GET /appointments` : champs `practitionerRole`, `calendarRole`, `patients[]` avec `packSelected`, `noteAuthorName`, `packDeferred` | auth | Cohérents | M | — | À exécuter |
| API-APT-04 | `GET /appointments/availability/:date` (psy) | psy | Créneaux `scheduled` de son rôle | M | — | À exécuter |
| API-APT-05 | `GET /availability/:date?practitionerId=…` (admin) | admin | Créneaux du praticien ciblé (par rôle) | M | — | À exécuter |
| API-APT-06 | `GET /availability/:date` (admin sans `practitionerId`) | admin | `practitionerId = undefined` → requête rôle NULL → `[]` (à confirmer) | m | Faible | À exécuter |
| API-APT-07 | `GET /:id` existant / inexistant | auth | 200 / 404 | M | — | À exécuter |
| API-APT-08 | `POST /` nominal psy (1 patient, service défini) | psy | 201 ; pack auto-créé/lié | M | — | À exécuter |
| API-APT-09 | `POST /` nominal coach (sans praticien) | coach | 201 ; `practitioner_id=NULL`, `role='coach'` | M | — | À exécuter |
| API-APT-10 | `POST /` sans patient ni titre | auth | 400 | M | — | À exécuter |
| API-APT-11 | `POST /` `patientIds: []` | auth | 400 | M | — | À exécuter |
| API-APT-12 | `POST /` patientId non UUID | auth | 400 | m | — | À exécuter |
| API-APT-13 | `POST /` patient inexistant | auth | 404 « un ou plusieurs patients introuvables » | M | — | À exécuter |
| API-APT-14 | `POST /` sans service (et sans pack différé/titre) | auth | 400 (validator) | M | — | À exécuter |
| API-APT-15 | `POST /` `packDeferred=true` sans service | auth | 201 ; `service_id=NULL` | M | — | À exécuter |
| API-APT-16 | `POST /` service inexistant | auth | 404 | M | — | À exécuter |
| API-APT-17 | `POST /` horaires non ISO8601 | auth | 400 | M | — | À exécuter |
| API-APT-18 | `POST /` conflit : 2ᵉ RDV psy sur le même créneau | psy | 400 « Créneau complet : maximum 1 » | M | — | À exécuter |
| API-APT-19 | `POST /` coach : 4 RDV même créneau OK, 5ᵉ refusé | coach | 201 ×4 puis 400 | M | — | À exécuter |
| API-APT-20 | `POST /` même patient déjà sur un RDV chevauchant | auth | 400 avec noms des patients | M | — | À exécuter |
| API-APT-21 | `POST /` psy avec 2 patients | psy | 400 « Maximum 1 patient » | M | — | À exécuter |
| API-APT-22 | `POST /` coach avec 4 patients OK, 5 patients refusé | coach | 201 / 400 | M | — | À exécuter |
| API-APT-23 | `POST /` `patientIds` contenant des doublons | auth | Dédupliqués avant contrôle | m | Faible | À exécuter |
| API-APT-24 | `POST /` RDV personnel (`title`) sur calendrier non admin | psy | 400 | m | Faible | À exécuter |
| API-APT-25 | `POST /` RDV personnel sans service ni patient | admin | 201, `title` renseigné | m | Moyenne | À exécuter |
| API-APT-26 | `POST /` RDV personnel non-admin (`role != admin`) | psy | 400 | m | Faible | À exécuter |
| API-APT-27 | `POST /` psy tente d'imposer `practitionerId` d'un autre | psy | Ignoré (praticien = soi) | M | Faible | À exécuter |
| API-APT-28 | `POST /` non-admin sans `practitionerId` | psy/coach | RDV créé sur soi (psy) ou sur le calendrier du rôle (coach) | M | — | À exécuter |
| API-APT-29 | `POST /` duree `endTime` < `startTime` | auth | **Aucune validation** d'ordre → RDV inversé accepté (à confirmer) | M | Moyenne | À exécuter |
| API-APT-30 | `POST /` pack auto : patient sans pack + service → pack créé (`remaining=total`) | auth | `patient_packs` + `usage` créés | M | — | À exécuter |
| API-APT-31 | `POST /` pack auto : patient avec pack existant `remaining>0` | auth | Réutilisation FIFO (le plus récent) | M | — | À exécuter |
| API-APT-32 | `PUT /:id` nominal (dates, patients, statut) | propriétaire | 200 | M | — | À exécuter |
| API-APT-33 | `PUT /:id` RDV `completed` | propriétaire | 400 « Cannot modify a completed appointment » | M | — | À exécuter |
| API-APT-34 | `PUT /:id` par un non-propriétaire non-admin | psy | 403 | M | — | À exécuter |
| API-APT-35 | `PUT /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-APT-36 | `PUT /:id` admin change `practitionerId` | admin | Praticien mis à jour + rôle recalculé | M | — | À exécuter |
| API-APT-37 | `PUT /:id` `role='coach'` | auth | `practitioner_id=NULL`, rôle coach | M | — | À exécuter |
| API-APT-38 | `PUT /:id` conflit de créneau (déplacement) | auth | 400 | M | — | À exécuter |
| API-APT-39 | `PUT /:id` `patientIds` remplacés | auth | Junction reconstruite (delete + insert) | M | — | À exécuter |
| API-APT-40 | `PUT /:id` `packDeferred=true` | auth | `service_id` forcé à NULL | M | — | À exécuter |
| API-APT-41 | `PUT /:id` sans `patientIds` : contrôle de chevauchement avec `ANY([])` | auth | Aucun chevauchement détecté (liste vide) → **contrôle patient ignoré** si patients non transmis | M | Moyenne | À exécuter |
| API-APT-42 | `PUT /:id` modification des patients d'un RDV avec `patient_pack_usages` | auth | **CASCADE supprime les usages sans rendre les séances** → désynchronisation possible du pack | C | Faible | À exécuter |
| API-APT-43 | `DELETE /:id` annulation avec motif | propriétaire | 200 ; statut `cancelled` + `cancellation_reason` | M | — | À exécuter |
| API-APT-44 | `DELETE /:id` RDV `completed` | auth | 400 | M | — | À exécuter |
| API-APT-45 | `DELETE /:id` non-propriétaire non-admin | psy | 403 | M | — | À exécuter |
| API-APT-46 | `DELETE /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-APT-47 | `DELETE` rend la séance au pack (pack avec séances consommées) | auth | `remaining_sessions +1`, usage supprimé | M | — | À exécuter |
| API-APT-48 | `DELETE` d'un pack créé uniquement pour ce RDV et non consommé | auth | Pack supprimé | m | Moyenne | À exécuter |
| API-APT-49 | `DELETE` d'un pack partagé par d'autres RDV actifs | auth | Pack conservé, séance rendue | M | Moyenne | À exécuter |
| API-APT-50 | `PUT /:id/complete` nominal | propriétaire | 200 ; trigger débite le pack, `session_count++` | M | — | À exécuter |
| API-APT-51 | `PUT /:id/complete` déjà complété | auth | 400 | M | — | À exécuter |
| API-APT-52 | `PUT /:id/complete` non-propriétaire non-admin | psy | 403 | M | — | À exécuter |
| API-APT-53 | `PUT /:id/complete` inexistant | auth | 404 | m | — | À exécuter |
| API-APT-54 | `complete` sans pack disponible | auth | 200, aucun débit, solde débité du prix service | M | — | À exécuter |
| API-APT-55 | `complete` double appel concurrent | auth | **Un seul débit** grâce au garde `EXISTS usage` | C | <1% | À exécuter |
| API-APT-56 | Retour `completed` → `scheduled` (via PUT statut) | auth | Séance rendue (`remaining+1`), usage supprimé | M | Moyenne | À exécuter |

### 5.6 `session-notes` — `/api/session-notes`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-SN-01 | `GET /session-notes` (cap 1000) | auth | 200 | M | — | À exécuter |
| API-SN-02 | `GET /` avec notes liées à un RDV **sans service** | auth | Exclues (INNER JOIN `services`) → **comptes rendus invisibles** | M | Moyenne | À exécuter |
| API-SN-03 | `GET /patient/:patientId` (+ `?appointmentId`) | auth | 200 | M | — | À exécuter |
| API-SN-04 | `GET /:id` existant / inexistant | auth | 200 / 404 | m | — | À exécuter |
| API-SN-05 | `POST /` nominal (psy propriétaire) | psy | 201 | M | — | À exécuter |
| API-SN-06 | `POST /` `appointmentPatientId` manquant | auth | 400 | M | — | À exécuter |
| API-SN-07 | `POST /` junction inexistante | auth | 404 | M | — | À exécuter |
| API-SN-08 | `POST /` par un psy non propriétaire d'un RDV psy | psy2 | 403 | M | — | À exécuter |
| API-SN-09 | `POST /` par un coach (RDV coach) → devient praticien en charge | coach | 201 + `practitioner_id` mis à jour | M | — | À exécuter |
| API-SN-10 | `POST /` par un coach sur RDV psy assigné | coach | 403 | M | — | À exécuter |
| API-SN-11 | `POST /` sur RDV coach non assigné | coach | 201 + RDV assigné à l'auteur | M | — | À exécuter |
| API-SN-12 | `POST /` admin sur RDV psy d'un tiers | admin | 201 (admin autorisé) | M | Moyenne | À exécuter |
| API-SN-13 | `POST /` doublon pour le même `appointmentPatientId` | auth | 409 | M | Moyenne | À exécuter |
| API-SN-14 | `POST /` sans `progressNotes` | auth | 201, note `null` | m | Moyenne | À exécuter |
| API-SN-15 | `PUT /:id` propriétaire / admin | auth | 200 | m | — | À exécuter |
| API-SN-16 | `PUT /:id` non-propriétaire non-admin | psy2 | 403 | M | — | À exécuter |
| API-SN-17 | `PUT /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-SN-18 | `PUT /:id` `progressNotes` vide | auth | `COALESCE` → valeur conservée (impossible d'effacer) → à valider | m | Faible | À exécuter |
| API-SN-19 | `DELETE /:id` propriétaire / non-propriétaire | auth | 200 / 403 | M | — | À exécuter |
| API-SN-20 | `DELETE /:id` inexistant | auth | 404 | m | — | À exécuter |

### 5.7 `payments` — `/api/payments`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-PAY-01 | `GET /payments` | auth | 200 `{data:{payments,total}}` | M | — | À exécuter |
| API-PAY-02 | `GET /payments` : **cap 100 lignes** alors que `total` = COUNT(*) global | auth | Si > 100 paiements : liste tronquée à 100, `total` supérieur → incohérence UI à confirmer | M | Moyenne | À exécuter |
| API-PAY-03 | `GET /:id` existant / inexistant | auth | 200 / 404 | m | — | À exécuter |
| API-PAY-04 | `POST /` nominal | auth | 201, `status='completed'`, `payment_method` défaut `cash` | M | — | À exécuter |
| API-PAY-05 | `POST /` sans patientId/amount | auth | 400 | M | — | À exécuter |
| API-PAY-06 | `POST /` montant négatif | auth | 400 | M | — | À exécuter |
| API-PAY-07 | `POST /` montant 0 sans notes | auth | 400 « amount of 0 requires notes » | M | Moyenne | À exécuter |
| API-PAY-08 | `POST /` montant 0 **avec** notes | auth | 201 | m | Moyenne | À exécuter |
| API-PAY-09 | `POST /` montant 0 pour la **1ʳᵉ séance d'un pack** | auth | 400 « interdit pour la première séance » | M | Moyenne | À exécuter |
| API-PAY-10 | `POST /` patient inexistant | auth | 404 | M | — | À exécuter |
| API-PAY-11 | `POST /` `paymentDate` ISO / absent | auth | Utilisé / `now()` | m | — | À exécuter |
| API-PAY-12 | `POST /` `paymentMethod` invalide (ex. `bitcoin`) | auth | Accepté (pas de validation sur la création) → **à confirmer vs CHECK DB** | M | Faible | À exécuter |
| API-PAY-13 | `POST /` montant avec décimale > 2 chiffres | auth | Arrondi/stockage NUMERIC(12,2) selon contrainte | m | Faible | À exécuter |
| API-PAY-14 | `POST /` montant = `"abc"` | auth | 400 | m | Faible | À exécuter |
| API-PAY-15 | `PUT /:id` partiel (montant, mode, statut, notes) | auth | 200 | M | — | À exécuter |
| API-PAY-16 | `PUT /:id` montant négatif | auth | 400 | M | — | À exécuter |
| API-PAY-17 | `PUT /:id` statut `failed`/`pending` | auth | 200 → impact sur le solde (seuls `completed` comptent) | M | Moyenne | À exécuter |
| API-PAY-18 | `PUT /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-PAY-19 | `DELETE /:id` nominal / inexistant | auth | 200 / 404 | M | — | À exécuter |
| API-PAY-20 | Toute écriture (create/update/delete) recalcule `patients.balance` | auth | Solde recalculé (trigger `trg_payment_balance`) | C | — | À exécuter |
| API-PAY-21 | `GET /` `createdByName` renseigné | auth | Non nul | m | — | À exécuter |

### 5.8 `patient-packs` — `/api/patient-packs`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-PCK-01 | `GET /` (cap 1000) | auth | 200 `{data:{packs}}` | M | — | À exécuter |
| API-PCK-02 | `GET /patient/:id` → `{packs, sharedPacks}` | auth | 200 ; packs propres + packs partagés | M | — | À exécuter |
| API-PCK-03 | `POST /` nominal (patientId, serviceId, totalSessions) | auth | 201 ; `remaining=total`, prix depuis le service | M | — | À exécuter |
| API-PCK-04 | `POST /` champs manquants | auth | 400 | M | — | À exécuter |
| API-PCK-05 | `POST /` `price` fourni > 0 | auth | Utilisé | m | — | À exécuter |
| API-PCK-06 | `POST /` `price` = 0 / négatif / `"abc"` | auth | 400 | M | Faible | À exécuter |
| API-PCK-07 | `POST /` service inexistant, sans prix | auth | 500 (prix NULL non géré) → **à confirmer** | M | Faible | À exécuter |
| API-PCK-08 | `POST /` patient inexistant | auth | 500 (FK) → **à confirmer** | M | Faible | À exécuter |
| API-PCK-09 | `POST /select` nominal (pack existant réutilisé) | auth | 200 ; usage inséré, `remaining-1` | M | — | À exécuter |
| API-PCK-10 | `POST /select` sans service (pack différé, service choisi dans la popup) | auth | 200 ; `appointments.service_id` renseigné si NULL | M | — | À exécuter |
| API-PCK-11 | `POST /select` paramètres manquants | auth | 400 | M | — | À exécuter |
| API-PCK-12 | `POST /select` junction inexistante | auth | 404 | M | — | À exécuter |
| API-PCK-13 | `POST /select` usage déjà existant | auth | 409 | M | Moyenne | À exécuter |
| API-PCK-14 | `POST /select` réutilise un pack **partagé** avec le patient | auth | Pack du propriétaire débité + solde du propriétaire recalculé | M | Faible | À exécuter |
| API-PCK-15 | `POST /select` aucun pack → création avec `remaining = total-1` | auth | Conforme (séance déjà consommée) | M | — | À exécuter |
| API-PCK-16 | `POST /select` `price` invalide sur création | auth | 400 | m | Faible | À exécuter |
| API-PCK-17 | `GET /:id/shares` nominal / pack inexistant | auth | 200 + `principalPatientId` / 404 | M | — | À exécuter |
| API-PCK-18 | `POST /:id/shares` nominal | auth | 201 | M | — | À exécuter |
| API-PCK-19 | `POST /:id/shares` sans `patientId` | auth | 400 | m | — | À exécuter |
| API-PCK-20 | `POST /:id/shares` patient principal | auth | 400 | m | Faible | À exécuter |
| API-PCK-21 | `POST /:id/shares` doublon | auth | 409 | M | Moyenne | À exécuter |
| API-PCK-22 | `POST /:id/shares` au-delà de `total_sessions` | auth | 400 (contrôle applicatif **et** trigger `check_pack_share_limit`) | M | Moyenne | À exécuter |
| API-PCK-23 | `DELETE /:id/shares/:patientId` nominal | auth | 200 | m | — | À exécuter |
| API-PCK-24 | `DELETE /:id/shares/:patientId` bénéficiaire ayant consommé | auth | 400 | M | Moyenne | À exécuter |
| API-PCK-25 | `DELETE /:id/shares/:patientId` inexistant | auth | 404 | m | — | À exécuter |
| API-PCK-26 | `DELETE /:id` pack existant / inexistant | auth | 200 / 404 ; usages en cascade | M | — | À exécuter |
| API-PCK-27 | `DELETE /:id` pack partagé | auth | Partages et usages supprimés → soldes recalculés | M | Faible | À exécuter |
| API-PCK-28 | `PUT /:id/switch` nominal (nouveau pack plus grand) | auth | 200 ; séances/total/prix mis à jour, `balanceDelta` correct | M | Moyenne | À exécuter |
| API-PCK-29 | `PUT /:id/switch` sans serviceId | auth | 400 | m | — | À exécuter |
| API-PCK-30 | `PUT /:id/switch` pack inexistant / service inexistant | auth | 404 | m | — | À exécuter |
| API-PCK-31 | `PUT /:id/switch` aucune séance consommée | auth | 400 « créez un nouveau pack » | M | Moyenne | À exécuter |
| API-PCK-32 | `PUT /:id/switch` nouveau pack < séances consommées | auth | 400 | M | Faible | À exécuter |
| API-PCK-33 | `PUT /:id/switch` nouveau total ≤ ancien total | auth | 400 | M | Faible | À exécuter |
| API-PCK-34 | `PUT /:id/switch` impact solde (`balanceDelta`) | auth | Solde du patient ajusté exactement | C | Moyenne | À exécuter |
| API-PCK-35 | `POST /` `patient_packs.price` NOT NULL (contrainte DB) | auth | Impossible d'insérer un pack sans prix | M | — | À exécuter |

### 5.9 `patient-outcomes` — `/api/patient-outcomes`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-OUT-01 | `GET /patient/:patientId` (cap 1000) | auth | 200 `{count,outcomes}` | M | — | À exécuter |
| API-OUT-02 | `GET /patient/:patientId` patient sans évaluation | auth | 200 `outcomes: []` | m | — | À exécuter |
| API-OUT-03 | `POST /` nominal | auth | 201 + `createdByName` | M | — | À exécuter |
| API-OUT-04 | `POST /` `patientId` manquant / non UUID | auth | 400 | M | — | À exécuter |
| API-OUT-05 | `POST /` patient inexistant | auth | 404 | M | — | À exécuter |
| API-OUT-06 | `POST /` champs vides (tous null) | auth | 201 (pas de contrôle de contenu) | m | Faible | À exécuter |
| API-OUT-07 | `POST /` valeurs hors bornes (amélioration 25, satisfaction -3) | auth | Accepté (pas de CHECK applicatif) → à confirmer vs contrainte DB | m | Faible | À exécuter |
| API-OUT-08 | `DELETE /:id` nominal / inexistant | auth | 200 / 404 | m | — | À exécuter |
| API-OUT-09 | `POST/PUT /patients` avec champs d'évaluation → création d'une ligne `patient_outcomes` | auth | Ligne créée (helper `recordOutcome`) | M | — | À exécuter |
| API-OUT-10 | `POST/PUT /patients` **sans** champs d'évaluation → aucune ligne | auth | Aucune ligne | m | — | À exécuter |

### 5.10 `waiting-list` — `/api/waiting-list`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-WLT-01 | `GET /` / `?practitionerId=…` (cap 1000) | auth | 200, trié par praticien + position | M | — | À exécuter |
| API-WLT-02 | `POST /` nominal | auth | 201, `position = max+1` | M | — | À exécuter |
| API-WLT-03 | `POST /` `practitionerId`/`patientId` manquant ou non UUID | auth | 400 | M | — | À exécuter |
| API-WLT-04 | `POST /` praticien / patient inexistant | auth | 404 | M | — | À exécuter |
| API-WLT-05 | `POST /` doublon (même praticien + patient) | auth | 400 | M | Moyenne | À exécuter |
| API-WLT-06 | `DELETE /:id` nominal | auth | 200 + renumérotation contiguë | M | — | À exécuter |
| API-WLT-07 | `DELETE /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-WLT-08 | `PUT /:id/move` `up` / `down` | auth | Échange de positions | M | — | À exécuter |
| API-WLT-09 | `PUT /:id/move` direction invalide | auth | 400 | m | — | À exécuter |
| API-WLT-10 | `PUT /:id/move` en 1ʳᵉ position vers `up` / dernière vers `down` | auth | 400 | M | Moyenne | À exécuter |
| API-WLT-11 | `PUT /:id/move` inexistant | auth | 404 | m | — | À exécuter |
| API-WLT-12 | Deux praticiens avec des positions identiques (unicité par praticien) | auth | Contraintes `UNIQUE(practitioner_id, position)` respectées | M | Faible | À exécuter |
| API-WLT-13 | Concurrence : 2 ajouts simultanés → collision de `position` | auth | Une contrainte UNIQUE échoue → 500 (à confirmer) | m | <1% | À exécuter |

### 5.11 `expenses` — `/api/expenses` (admin uniquement)

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-EXP-01 | `GET /` (cap 1000) | admin | 200 `{count,expenses}` | M | — | À exécuter |
| API-EXP-02 | `GET /` psy / coach | psy/coach | 403 | M | — | À exécuter |
| API-EXP-03 | `GET /:id` / inexistant | admin | 200 / 404 | m | — | À exécuter |
| API-EXP-04 | `POST /` nominal | admin | 201 + `createdByName` | M | — | À exécuter |
| API-EXP-05 | `POST /` titre vide | admin | 400 | M | — | À exécuter |
| API-EXP-06 | `POST /` montant 0 / négatif / non numérique | admin | 400 (min 0.01) | M | — | À exécuter |
| API-EXP-07 | `POST /` `expenseDate` absent / non ISO | admin | 400 | M | — | À exécuter |
| API-EXP-08 | `POST /` sans catégorie / notes | admin | 201 (optionnels) | m | — | À exécuter |
| API-EXP-09 | `PUT /:id` partiel | admin | 200 | M | — | À exécuter |
| API-EXP-10 | `PUT /:id` montant invalide | admin | 400 | m | — | À exécuter |
| API-EXP-11 | `PUT /:id` inexistant | admin | 404 | m | — | À exécuter |
| API-EXP-12 | `DELETE /:id` nominal / inexistant | admin | 200 / 404 | M | — | À exécuter |
| API-EXP-13 | `PUT`/`DELETE` par psy | psy | 403 | M | — | À exécuter |

### 5.12 `companies` — `/api/companies`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-COM-01 | `GET /` (cap 1000, tri nom) | auth | 200 | M | — | À exécuter |
| API-COM-02 | `GET /:id` / inexistant | auth | 200 / 404 | m | — | À exécuter |
| API-COM-03 | `POST /` nominal (name + champs) | auth | 201 | M | — | À exécuter |
| API-COM-04 | `POST /` sans nom | auth | 400 | M | — | À exécuter |
| API-COM-05 | `POST /` champs optionnels vides | auth | 201 (null) | m | — | À exécuter |
| API-COM-06 | `POST /` doublon de nom | auth | 201 (pas de contrainte UNIQUE) → à confirmer | m | Faible | À exécuter |
| API-COM-07 | `PUT /:id` partiel / inexistant | auth | 200 / 404 | m | — | À exécuter |
| API-COM-08 | `DELETE /:id` sans facture liée | auth | 200 | M | — | À exécuter |
| API-COM-09 | `DELETE /:id` avec factures liées (FK RESTRICT) | auth | Erreur FK → 500 (à confirmer, message générique) | M | Moyenne | À exécuter |
| API-COM-10 | `DELETE /:id` inexistant | auth | 404 | m | — | À exécuter |

### 5.13 `company-invoices` — `/api/company-invoices`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-INV-01 | `GET /next-reference` (base vide / avec factures N) | auth | `${n}/${année}` | M | — | À exécuter |
| API-INV-02 | `GET /next-reference` changement d'année | auth | Repart à `1/${année}` | m | Faible | À exécuter |
| API-INV-03 | `GET /` (cap 1000) | auth | 200 | M | — | À exécuter |
| API-INV-04 | `GET /:id` → facture + `items` | auth | 200 | M | — | À exécuter |
| API-INV-05 | `GET /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-INV-06 | `POST /` nominal (1+ items) | auth | 201 ; sous-total/remise/TVA/TTC calculés | M | — | À exécuter |
| API-INV-07 | Calculs : `subtotal`, `discounted_total = max(subtotal-discount,0)`, `grand_total = discounted+vat` | auth | Exact | C | — | À exécuter |
| API-INV-08 | `POST /` `companyId`/`reference`/`invoiceDate` manquant | auth | 400 | M | — | À exécuter |
| API-INV-09 | `POST /` `items: []` | auth | 400 (min 1) | M | — | À exécuter |
| API-INV-10 | `POST /` item sans `description` | auth | 400 « Designation requise » | M | — | À exécuter |
| API-INV-11 | `POST /` entreprise inexistante | auth | 404 (rollback) | M | — | À exécuter |
| API-INV-12 | `POST /` `discount` > subtotal | auth | `discounted_total = 0`, pas de négatif | M | Faible | À exécuter |
| API-INV-13 | `POST /` `discount`/`vatAmount` négatifs | auth | 400 | m | — | À exécuter |
| API-INV-14 | `POST /` `paymentMethod` absent | auth | Défaut « Par cheque ou virement bancaire » | m | — | À exécuter |
| API-INV-15 | `POST /` item avec valeurs non numériques | auth | `Number(...||0)` → 0, total 0 | m | Faible | À exécuter |
| API-INV-16 | **Transaction** : `BEGIN`/`COMMIT` via `pool.query` (connexions potentiellement différentes) | auth | Risque : échec partiel non annulé. Forcer une erreur au 2ᵉ item et vérifier qu'aucune facture partielle ne subsiste | C | Faible | À exécuter |
| API-INV-17 | `PUT /:id` remplacement des items | auth | Items remplacés, totaux recalculés | M | — | À exécuter |
| API-INV-18 | `PUT /:id` modification de la remise seule (sans items) | auth | Totaux recalculés depuis le sous-total courant | M | Faible | À exécuter |
| API-INV-19 | `PUT /:id` `items: []` | auth | 400 | m | — | À exécuter |
| API-INV-20 | `PUT /:id` inexistant | auth | 404 | m | — | À exécuter |
| API-INV-21 | `DELETE /:id` nominal / inexistant | auth | 200 / 404 ; items en cascade | M | — | À exécuter |
| API-INV-22 | `reference` en doublon | auth | Accepté (pas d'UNIQUE ?) → à confirmer ; impact sur `next-reference` | M | Faible | À exécuter |
| API-INV-23 | `GET /` lorsque `created_by` a été supprimé (FK SET NULL) | auth | Facture absente de la liste (INNER JOIN `users`) → **liste incomplète** | M | Faible | À exécuter |

### 5.14 `settings` — `/api/settings`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-SET-01 | `GET /patient-lists` (listes en base) | auth | 200 `{professions,motifs}` | M | — | À exécuter |
| API-SET-02 | `GET /patient-lists` base vide → valeurs par défaut | auth | `DEFAULT_PROFESSIONS`/`DEFAULT_MOTIFS` | m | Moyenne | À exécuter |
| API-SET-03 | `PUT /patient-lists` nominal | admin | 200 ; ajout + désactivation (`is_active=false`) des absents | M | — | À exécuter |
| API-SET-04 | `PUT /patient-lists` par psy/coach | psy/coach | 403 | M | — | À exécuter |
| API-SET-05 | `PUT /patient-lists` listes vides | admin | Toutes professions/motifs désactivés | M | Moyenne | À exécuter |
| API-SET-06 | `PUT /patient-lists` doublons/espaces | admin | Trim + dédoublonnage implicite (upsert) | m | Faible | À exécuter |
| API-SET-07 | `GET /calendar-settings` (3 rôles) | auth | 200 | M | — | À exécuter |
| API-SET-08 | `GET /calendar-settings/:role` valide / invalide | auth | 200 / 404 | M | — | À exécuter |
| API-SET-09 | `PUT /calendar-settings/:role` nominal | admin | 200 | M | — | À exécuter |
| API-SET-10 | `PUT /calendar-settings/:role` non-admin | psy | 403 | M | — | À exécuter |
| API-SET-11 | `PUT /calendar-settings/:role` rôle inexistant en base | admin | 404 | m | — | À exécuter |
| API-SET-12 | `PUT /calendar-settings/:role` `consultationDuration < 15` | admin | Accepté côté API (min 15 seulement côté UI) → à confirmer | m | Moyenne | À exécuter |
| API-SET-13 | `PUT /calendar-settings/:role` `workEnd < workStart` | admin | Accepté (pas de contrôle) → calendrier incohérent | M | Faible | À exécuter |
| API-SET-14 | `PUT` `weekendDays` personnalisé | admin | Persisté et restitué | m | — | À exécuter |
| API-SET-15 | Contrainte `calendar_settings_role_check IN ('admin','psy','coach')` | admin | Insertion d'un rôle hors liste rejetée | M | Faible | À exécuter |

### 5.15 `activity-logs` et divers — `/api/activity-logs`, `/api/health`

| ID | Test | Rôle | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| API-LOG-01 | `GET /activity-logs` admin / non-admin | admin / psy | 200 / 403 | M | — | À exécuter |
| API-LOG-02 | Filtres + pagination + `total` | admin | Cohérents | m | — | À exécuter |
| API-LOG-03 | `limit`/`offset` invalides (`abc`, -5) | admin | Pas de 500 (comportement PG à valider) | m | Faible | À exécuter |
| API-LOG-04 | `GET /api/health` | public | 200 `{success:true}` | M | — | À exécuter |
| API-LOG-05 | Route inconnue | public | 404 JSON | m | — | À exécuter |

---

## 6. Règles métier et déclencheurs (tests d'intégrité)

### 6.1 Calcul du solde (`patients.balance`, `recalc_patient_balance`)

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| DB-BAL-01 | Patient sans paiement ni séance | `balance = 0` | M | — | À exécuter |
| DB-BAL-02 | Paiement complété +3000 | `balance = 3000` | C | — | À exécuter |
| DB-BAL-03 | Paiement `pending`/`failed` | Non pris en compte dans le solde | M | — | À exécuter |
| DB-BAL-04 | RDV complété (service 3000, sans pack) | `balance -= 3000` | C | — | À exécuter |
| DB-BAL-05 | RDV complété lié à un pack (prix 33000 / 8 séances) | `balance -= 4125` | C | — | À exécuter |
| DB-BAL-06 | RDV `scheduled`/`cancelled` | Aucun impact | M | — | À exécuter |
| DB-BAL-07 | Annulation d'un RDV complété (retour arrière) | Séance et montant rendus | M | — | À exécuter |
| DB-BAL-08 | Suppression d'un paiement | Solde recalculé sans ce paiement | C | — | À exécuter |
| DB-BAL-09 | Modification du montant d'un paiement | Solde suit | M | — | À exécuter |
| DB-BAL-10 | Séance à `service_id = NULL` (pack différé) comptée via le pack | Solde débité du `price/total_sessions` du pack, jamais ignoré | C | Moyenne | À exécuter |
| DB-BAL-11 | Pack partagé consommé par un bénéficiaire | Le solde du **propriétaire** du pack est recalculé | M | Faible | À exécuter |
| DB-BAL-12 | Cohérence globale : `balance` = Σ paiements `completed` − Σ séances complétées évaluées | 0 incohérence sur toute la base | C | — | À exécuter |
| DB-BAL-13 | Séance complétée d'un patient tiers sur un service non packé | Solde débité du `services.price` | M | — | À exécuter |

### 6.2 Cycles de vie des packs

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| DB-PCK-01 | Création automatique à la prise de RDV (service défini, non différé) | Pack `remaining = total` puis débité à la complétion | M | — | À exécuter |
| DB-PCK-02 | Débit FIFO : 2 packs du même patient/service | Le plus ancien (`created_at ASC`) est consommé en premier | M | Moyenne | À exécuter |
| DB-PCK-03 | Passage `scheduled → completed` | `remaining-1` + ligne `patient_pack_usages` | C | — | À exécuter |
| DB-PCK-04 | Re-passage `completed → scheduled` | `remaining+1`, usage supprimé | M | — | À exécuter |
| DB-PCK-05 | Re-complétion après retour arrière | Un **seul** débit (garde `EXISTS usage`) | C | Moyenne | À exécuter |
| DB-PCK-06 | Double `complete` (double-clic / 2 requêtes) | Un seul débit | C | <1% | À exécuter |
| DB-PCK-07 | Pack à `remaining = 0` : nouvelle séance complétée | Aucun pack consommé → facturation au prix service | M | — | À exécuter |
| DB-PCK-08 | `session_count` et `last_session_date` mis à jour à chaque complétion | Exact | M | — | À exécuter |
| DB-PCK-09 | RDV multi-patients (coach) : chaque patient consomme **son** pack | N débits indépendants | M | Faible | À exécuter |
| DB-PCK-10 | RDV multi-patients dont un patient sans pack | Ce patient ne consomme rien, les autres oui | M | Faible | À exécuter |
| DB-PCK-11 | Trigger `sync_pack_on_appointment_status` présent **en base** (et pas seulement dans `server.ts`) | Vérifier `pg_trigger` | C | Moyenne | À exécuter |
| DB-PCK-12 | Garde anti-double-débit présente dans **les deux** définitions (base + `schema.ts`) | Conforme (⚠ travail non commité signalé dans les notes projet) | C | Moyenne | À exécuter |
| DB-PCK-13 | `check_pack_share_limit` : ajout au-delà de `total_sessions` | Exception « Nombre maximum de bénéficiaires atteint » | M | Faible | À exécuter |
| DB-PCK-14 | Suppression d'un pack → usages supprimés, soldes recalculés | Conforme | M | — | À exécuter |

### 6.3 Règles de conflit de rendez-vous

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| DB-APT-01 | Psy : 1 RDV par créneau ; 2ᵉ (autre patient) refusé | 400 | M | — | À exécuter |
| DB-APT-02 | Coach : 4 RDV par créneau ; 5ᵉ refusé | 201×4 / 400 | M | — | À exécuter |
| DB-APT-03 | Admin traité comme Psy (1 par créneau) | 400 au 2ᵉ | M | Moyenne | À exécuter |
| DB-APT-04 | Même patient, 2 créneaux chevauchants (même rôle) | 400 | M | — | À exécuter |
| DB-APT-05 | Même patient, 2 rôles différents (psy + coach) sur créneaux chevauchants | **Autorisé ou refusé ?** Le contrôle de chevauchement patient n'est pas restreint au rôle → risque de double réservation | M | Moyenne | À exécuter |
| DB-APT-06 | RDV `cancelled` ne bloque pas un nouveau créneau | Autorisé | M | — | À exécuter |
| DB-APT-07 | RDV `completed` ne bloque pas | Autorisé | M | Moyenne | À exécuter |
| DB-APT-08 | Chevauchement partiel (start dans l'intervalle) | Détecté | M | — | À exécuter |
| DB-APT-09 | Deux RDV adjacents (fin = début suivant) | Autorisé | M | Moyenne | À exécuter |
| DB-APT-10 | Répartition par rôle dans `availability` | Cohérente | m | — | À exécuter |

### 6.4 Cohérence praticien (règle « praticien dérivé »)

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| DB-PRAC-01 | `patients.practitionerId` exposé = praticien du dernier RDV non annulé | Exact | M | — | À exécuter |
| DB-PRAC-02 | `patients.practitioners[]` = historique de tous les praticiens | Exact | M | — | À exécuter |
| DB-PRAC-03 | Aucun praticien (patient sans RDV) | Champs `null` / `[]` | m | — | À exécuter |
| DB-PRAC-04 | `patients.practitioner_id` (colonne) reste synchronisée par `trg_sync_patient_practitioner` **alors qu'elle est déclarée obsolète** | Double source de vérité → vérifier les divergences possibles | M | Faible | À exécuter |
| DB-PRAC-05 | RDV sans praticien (coach) : `practitionerName = 'Non assigné'` | Conforme | M | — | À exécuter |
| DB-PRAC-06 | Rédaction d'un compte rendu sur RDV coach non assigné → praticien = auteur | Conforme | M | — | À exécuter |
| DB-PRAC-07 | Tous les rôles voient tous les RDV (filtre `a.practitioner_id = user` retiré) | Un psy voit les RDV des autres | M | — | À exécuter |

---

## 7. Tests de base de données

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| DB-01 | `ensureSchema()` idempotent : 2 démarrages consécutifs | Aucune erreur, aucune duplication | M | — | À exécuter |
| DB-02 | `ensureSchema()` sur base vierge | Crée tables/index/fonctions/triggers sans erreur | C | Faible | À exécuter |
| DB-03 | Colonnes ajoutées : `users.token_version`, `patients.balance`, `services.type`, `appointments.pack_deferred`, `appointments.role`, `patients.marital_status`… | Présentes avec les bons types/defaults | M | — | À exécuter |
| DB-04 | `patients.practitioner_id` est NULLable et sans FK | Contraintes `clients_*`/`patients_*` absentes | M | — | À exécuter |
| DB-05 | `appointments.service_id` NULLable | Conforme | M | — | À exécuter |
| DB-06 | Contraintes CHECK de statuts (RDV `scheduled|completed|cancelled`, paiement, etc.) | Valeurs hors liste rejetées | M | Moyenne | À exécuter |
| DB-07 | CHECK `users.role` (si présent) : rôle arbitraire rejeté | Conforme (sinon incohérence API-USR-10) | M | Faible | À exécuter |
| DB-08 | `payments.amount` NUMERIC(12,2) + CHECK | Précision respectée, valeur négative rejetée si CHECK | M | — | À exécuter |
| DB-09 | Clés étrangères : `expenses.created_by` SET NULL, `invoices.created_by` SET NULL, `invoices.company_id` RESTRICT, `waiting_list.practitioner_id` RESTRICT | Comportements attendus | M | Faible | À exécuter |
| DB-10 | `activity_logs` + index (`user_id`, `action`, `resource`, `created_at`) | Présents | m | — | À exécuter |
| DB-11 | Aucune contrainte CHECK résiduelle sur `activity_logs.action` | Absente (bloquait de nouveaux types d'action) | m | — | À exécuter |
| DB-12 | `patient_motifs` UNIQUE(`patient_id`,`motif_id`) + PK id | Conforme ; doublon rejeté | m | — | À exécuter |
| DB-13 | `professions.label` / `motifs.label` UNIQUE | Doublon rejeté, réactivation possible | m | — | À exécuter |
| DB-14 | `professions.is_active` / `motifs.is_active` | Présents | m | — | À exécuter |
| DB-15 | `patient_pack_usages.appointment_patient_id` UNIQUE | Double usage rejeté | C | Moyenne | À exécuter |
| DB-16 | Trigger d'audit `fn_audit_log` **attaché** aux tables (patients, users, appointments, payments…) | Ligne d'audit créée à chaque écriture | M | Moyenne | À exécuter |
| DB-17 | `fn_audit_log` robuste : erreur interne → `RAISE WARNING` et opération métier poursuivie | Conforme | M | Faible | À exécuter |
| DB-18 | `recalc_patient_balance` sur patient inexistant | Aucune erreur | m | <1% | À exécuter |
| DB-19 | Division par zéro : pack `total_sessions = 0` | `NULLIF(...,0)` évite l'erreur | m | <1% | À exécuter |
| DB-20 | `patient_packs.price` NOT NULL | Insertion sans prix rejetée | M | — | À exécuter |
| DB-21 | `calendar_settings` contient bien 3 lignes (admin/psy/coach) | Conforme | M | — | À exécuter |
| DB-22 | Données historiques : 11 `patient_outcomes` issus du backfill (si applicable) | Cohérentes | m | — | À exécuter |
| DB-23 | Encodage UTF-8 (accents : `Marié(e)`, `Étudiant(e)`, `Anxiété`) | Pas de caractères corrompus (⚠ `patient-lists.ts`/`DEFAULT_*` affichent des accents mal encodés dans le source) | M | Moyenne | À exécuter |
| DB-24 | `activity_logs.user_pseudo` présente (cf. LOG-06) | Présente | C | Faible | À exécuter |
| DB-25 | Taille des tables / index utilisés sur les requêtes lourdes (`patients/paged`) | Plan d'exécution raisonnable | m | — | À exécuter |
| DB-26 | `sql/init_postgres.sql` référencé par `db:init` **absent** | Documenter/renommer le script (anomalie) | m | Élevée | À exécuter |

---

## 8. Tests frontend (par page)

> Pour chaque page : vérifier l'affichage, les interactions, les validations de saisie, les états vides/chargement/erreur, le comportement responsive et l'accessibilité clavier.

### 8.1 `/login`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-LOGIN-01 | Affichage, focus initial, champs Pseudo/Mot de passe | Conforme | m | — | À exécuter |
| UI-LOGIN-02 | Submit vide | Validation HTML « requis » | m | — | À exécuter |
| UI-LOGIN-03 | Identifiants invalides | Message « Pseudo ou mot de passe invalide » | M | — | À exécuter |
| UI-LOGIN-04 | Backend éteint | Message explicite (port 5001) | M | Moyenne | À exécuter |
| UI-LOGIN-05 | Spinner pendant la connexion | Affiché, bouton désactivé | m | — | À exécuter |
| UI-LOGIN-06 | Succès | Redirection vers `/` | M | — | À exécuter |
| UI-LOGIN-07 | Déjà connecté → visite `/login` | Comportement à définir (pas de redirection automatique) | m | Faible | À exécuter |

### 8.2 `/` — Tableau de bord

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-DASH-01 | Chargement (skeleton) puis 17 KPI + graphes | Affichés sans erreur | M | — | À exécuter |
| UI-DASH-02 | Carrousel KPI (5 pages, flèches + puces) | Navigation fluide | m | — | À exécuter |
| UI-DASH-03 | Tooltips de détail (recettes, packs, séances, annulations, créances…) | Contenu cohérent | m | — | À exécuter |
| UI-DASH-04 | Toggles « Ce mois / Aujourd'hui » (packs, séances, annulations, nouveaux clients) | Valeurs recalculées | M | — | À exécuter |
| UI-DASH-05 | Inputs date « Séances restantes (Neuro/Psy) » | Recalcul au changement de date | m | — | À exécuter |
| UI-DASH-06 | « Dépenses du mois » : admin voit la donnée, psy/coach voient 0 | Conforme | M | — | À exécuter |
| UI-DASH-07 | Pie « Canal d'acquisition » (%, total) | Cohérent | m | — | À exécuter |
| UI-DASH-08 | Carrousel de 4 graphiques | Conforme | m | — | À exécuter |
| UI-DASH-09 | Bar « Comptes rendus par praticien » + filtre Tous/Psy/Neuro | Filtrage correct | M | — | À exécuter |
| UI-DASH-10 | Badge orange « surcharge » (> 2 RDV même praticien/créneau) | Règle `> 2` appliquée | m | Faible | À exécuter |
| UI-DASH-11 | Clic sur une barre → Dialog patients + pagination 10/page + « Voir le compte rendu » | Conforme | m | — | À exécuter |
| UI-DASH-12 | Rechargement au retour de focus fenêtre | Données rafraîchies | m | — | À exécuter |
| UI-DASH-13 | Erreur de chargement | Données vides, pas de crash | M | Faible | À exécuter |
| UI-DASH-14 | KPI « Créances extérieures » = Σ |balance négatif| | Exact | M | — | À exécuter |
| UI-DASH-15 | KPI « Femmes/Hommes majeurs », « Enfants/Ados » (age ∈ RDV complétés) | Cohérent | m | Moyenne | À exécuter |

### 8.3 `/patients` — liste

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-PAT-01 | Liste paginée serveur (25/page) + total | Conforme | M | — | À exécuter |
| UI-PAT-02 | Recherche (nom/email/téléphone) | Résultats serveur | M | — | À exécuter |
| UI-PAT-03 | Filtres : praticien, pack, séances (min/max), solde (min/max), prospects | Tous fonctionnels | M | — | À exécuter |
| UI-PAT-04 | Compteur de filtres actifs + Réinitialiser | Conforme | m | — | À exécuter |
| UI-PAT-05 | Tri par clic (nom, téléphone, praticien, pack, solde, créé le) : asc/desc + soulignement | Conforme | M | — | À exécuter |
| UI-PAT-06 | Pack affiché `(remaining/total)` ou « — » | Conforme | M | — | À exécuter |
| UI-PAT-07 | Icône rouge + tooltip « Solde insuffisant pour une séance » quand `balance < packPricePerSession` | Conforme | M | — | À exécuter |
| UI-PAT-08 | Saldo vert (>0) / rouge (<0) | Conforme | m | — | À exécuter |
| UI-PAT-09 | Nom rouge si `consecutiveNoShows ≥ 3`, orange si ≥ 2 | Conforme | M | Moyenne | À exécuter |
| UI-PAT-10 | Bouton « Nouveau patient » → Dialog `PatientForm` (5 étapes) | Enregistrement OK | M | — | À exécuter |
| UI-PAT-11 | Dialog création : `onInteractOutside` bloqué (pas de fermeture accidentelle) | Conforme | m | — | À exécuter |
| UI-PAT-12 | Validation téléphone (regex `^[\d\s\-\+\(\)]{8,}$`) | Refus des valeurs invalides | M | — | À exécuter |
| UI-PAT-13 | Calcul auto de l'âge → `patientType` (Enfant/Adolescent/Adulte) | Conforme aux bornes | M | — | À exécuter |
| UI-PAT-14 | Étape « Situation » masquée pour un mineur | Conforme | M | Moyenne | À exécuter |
| UI-PAT-15 | « Autre » profession / « Autre motif » | Saisie libre acceptée | m | — | À exécuter |
| UI-PAT-16 | Champs conditionnels de la source (réseaux sociaux / médecin / recommandation) | Affichage conditionnel correct | m | — | À exécuter |
| UI-PAT-17 | Action « Historique » (Dialog séances) | Liste correcte + badges de statut | M | — | À exécuter |
| UI-PAT-18 | Action « Modifier » (Dialog) | Pré-remplissage + sauvegarde | M | — | À exécuter |
| UI-PAT-19 | Action « Supprimer » (confirm) | Suppression effective + liste rafraîchie | M | — | À exécuter |
| UI-PAT-20 | Clic sur la ligne → `/patients/[id]` | Navigation | m | — | À exécuter |
| UI-PAT-21 | État vide + bouton « Ajouter votre premier patient » | Conforme | m | — | À exécuter |
| UI-PAT-22 | Affichage responsive (colonnes masquées < md/< lg) | Conforme | m | — | À exécuter |
| UI-PAT-23 | Erreur API | Alert destructive | M | Faible | À exécuter |

### 8.4 `/patients/[id]` — détail

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-PATD-01 | Onglet Informations → sous-onglets Identité/Situation/Motif/Historique/Source | Édition inline fonctionnelle | M | — | À exécuter |
| UI-PATD-02 | Onglet Rendez-vous (date, service, praticien + rôle, statut, pack) | Conforme | M | — | À exécuter |
| UI-PATD-03 | Onglet Packs : historique + « Nouveau pack » (séances, prix total, prix/séance) | Conforme | M | — | À exécuter |
| UI-PATD-04 | Action « Changer » de pack → Dialog (impératif : plus de séances) + **impact solde** affiché | Cohérent avec `balanceDelta` API | M | Moyenne | À exécuter |
| UI-PATD-05 | Action « Partager » → recherche patient, ajout/retrait de bénéficiaires | Conforme + gestion des erreurs (max, déjà bénéficiaire, séances consommées) | M | — | À exécuter |
| UI-PATD-06 | « Packs partagés » (service, séances restantes, prix, propriétaire) | Conforme | m | — | À exécuter |
| UI-PATD-07 | Onglet Historique des séances → « Voir le compte rendu » | Navigation `/appointments/[id]/report` | M | — | À exécuter |
| UI-PATD-08 | Onglet Comptes rendus (extrait du texte) | Conforme | m | — | À exécuter |
| UI-PATD-09 | `abandon_reason` visible/éditable si pertinent | Conforme | m | Faible | À exécuter |
| UI-PATD-10 | **Section Évaluations (`patientOutcomes`)** : les données sont chargées mais l'onglet est absent de l'UI | Anomalie/écart avec la documentation → à trancher | M | Moyenne | À exécuter |
| UI-PATD-11 | Patient inexistant | Alert + Retour | m | — | À exécuter |
| UI-PATD-12 | URL directe non reliée depuis la liste (édition inline) | Fonctionne | m | — | À exécuter |

### 8.5 `/patients/[id]/edit` et `/patients/[id]/notes`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-PATE-01 | Édition multi-étapes puis redirection `/patients` | Conforme | m | — | À exécuter |
| UI-PATE-02 | Erreur de chargement | Alert | m | — | À exécuter |
| UI-PATN-01 | Liste des comptes rendus (service, contenu, date, praticien) tri desc | Conforme | m | — | À exécuter |
| UI-PATN-02 | État vide dédié | Conforme | m | — | À exécuter |
| UI-PATE-03 | Route orpheline (aucun lien de navigation) | Accessible par URL uniquement | m | — | À exécuter |

### 8.6 `/appointments`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-APT-01 | Bascule Calendrier / Liste / Attente (onglet Attente visible si rôle psy) | Conforme | M | — | À exécuter |
| UI-APT-02 | Toggle Admin/Psy/Coach visible **admin uniquement** | Conforme | M | — | À exécuter |
| UI-APT-03 | Calendrier semaine : navigation ±1 semaine, popover date | Conforme | M | — | À exécuter |
| UI-APT-04 | Grille : créneaux de `consultationDuration` (min 15), `workStart`→`workEnd` | Conforme | M | — | À exécuter |
| UI-APT-05 | Jours de repos grisés, pause déjeuner en amber | Conforme | m | — | À exécuter |
| UI-APT-06 | Clic créneau vide → Dialog création (date/heure préremplies, praticien selon rôle) | Conforme | M | — | À exécuter |
| UI-APT-07 | Carrousel `1/N` sur créneaux multi-RDV + flèches | Conforme | M | Moyenne | À exécuter |
| UI-APT-08 | Bouton « + » sur créneau occupé visible **uniquement en rôle Coach** | Conforme | M | — | À exécuter |
| UI-APT-09 | RDV annulés masqués en calendrier | Conforme | m | — | À exécuter |
| UI-APT-10 | Styles selon statut (completed gris, scheduled brand) | Conforme | m | — | À exécuter |
| UI-APT-11 | Vue Liste : cartes, pagination 10/page, navigation semaine | Conforme | M | — | À exécuter |
| UI-APT-12 | Vue Liste : « Pack à définir » si pack différé sans service | Conforme | M | — | À exécuter |
| UI-APT-13 | Filtres : statut, praticien, service, période | Conforme | M | — | À exécuter |
| UI-APT-14 | Vue Attente : liste par praticien, positions, Monter/Descendre/Réserver/Retirer | Conforme | M | — | À exécuter |
| UI-APT-15 | « Réserver » depuis la liste d'attente → formulaire RDV, retrait après succès | Conforme | M | Moyenne | À exécuter |
| UI-APT-16 | Dialog RDV complété : lecture seule + « Voir le compte rendu » | Conforme | M | — | À exécuter |
| UI-APT-17 | « Annuler le rendez-vous » → prompt motif → statut annulé | Conforme | M | — | À exécuter |
| UI-APT-18 | « Prendre en charge le RDV » → page rapport | Conforme | M | — | À exécuter |
| UI-APT-19 | Formulaire : multi-patients autorisé pour Coach (max 4) | Conforme | M | — | À exécuter |
| UI-APT-20 | Formulaire : service désactivé + non requis si « pack après la séance » | Conforme | M | — | À exécuter |
| UI-APT-21 | Formulaire : « RDV personnel (sans patient) » (admin + rôle admin) | Conforme | m | Moyenne | À exécuter |
| UI-APT-22 | Formulaire : message « Aucun praticien n'est assigné » (rôle coach) | Conforme | M | — | À exécuter |
| UI-APT-23 | Alerte si solde patient insuffisant | Conforme | m | — | À exécuter |
| UI-APT-24 | Validation : fin > début côté UI | Blocage | M | — | À exécuter |
| UI-APT-25 | État vide « Aucun rendez-vous cette semaine » | Conforme | m | — | À exécuter |
| UI-APT-26 | Défaut : liste si largeur < 768 px, sinon calendrier | Conforme | m | — | À exécuter |

### 8.7 `/appointments/[id]/report`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-REP-01 | Sélecteur multi-patients (✓/○) + Précédent/Suivant + compteur | Conforme | M | — | À exécuter |
| UI-REP-02 | Alert si comptes rendus manquants | Conforme | M | — | À exécuter |
| UI-REP-03 | Création d'un compte rendu (statut, amélioration /10, satisfaction /10, recommander oui/non, changements, texte) | Enregistrement OK | M | — | À exécuter |
| UI-REP-04 | Champ « Raison d'abandon » affiché si statut = Abandon | Conforme | M | — | À exécuter |
| UI-REP-05 | Bornes des notes : 0-10 | Conforme | m | — | À exécuter |
| UI-REP-06 | `handleSaveAll` : `patients.update` + `sessionNotes.create/update` + `appointments.complete` | Séquence OK, toast « Compte rendu sauvegardé » | M | — | À exécuter |
| UI-REP-07 | Après enregistrement sans pack différé → redirection `/payments?patientId=…` | Conforme | M | — | À exécuter |
| UI-REP-08 | Popup pack obligatoire si `packDeferred` non sélectionné : non fermable (Échap, clic extérieur, croix) | Conforme | M | Moyenne | À exécuter |
| UI-REP-09 | Popup pack : liste des packs en cours / autres services, résumé (nb séances, séances restantes = total−1, prix) | Conforme | M | — | À exécuter |
| UI-REP-10 | Popup pack : Select service si RDV sans service, sinon lecture seule | Conforme | M | — | À exécuter |
| UI-REP-11 | « Sélectionner le pack et débiter la séance » → pack créé/débité, solde recalculé | Conforme | M | — | À exécuter |
| UI-REP-12 | Sortie bloquée tant que le pack n'est pas sélectionné ou qu'un compte rendu manque | Conforme | M | Moyenne | À exécuter |
| UI-REP-13 | Popup ne s'ouvre **pas** automatiquement au chargement (uniquement au clic Enregistrer / garde-fou) | Conforme | M | Moyenne | À exécuter |
| UI-REP-14 | Bouton nom patient → Dialog `PatientForm` lecture seule | Conforme | m | — | À exécuter |
| UI-REP-15 | RDV introuvable | Alert | m | — | À exécuter |
| UI-REP-16 | Mode lecture puis « Modifier » | Bascule correcte | m | — | À exécuter |
| UI-REP-17 | RDV multi-patients : naviguer entre patients sans perdre les saisies | Conforme | M | Faible | À exécuter |

### 8.8 `/payments` et `/payments/[id]/edit`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-PAY-01 | Liste + pagination 10/page | Conforme | M | — | À exécuter |
| UI-PAY-02 | Tri (patient, montant, mode, statut, date desc, enregistré par) | Conforme | M | — | À exécuter |
| UI-PAY-03 | Filtres : patient, mode, statut, montant min/max, date, **Période** (aujourd'hui/semaine/mois/trimestre/année) | Conforme | M | — | À exécuter |
| UI-PAY-04 | Total en bas « Total (tous|filtré) » réactif aux filtres | Exact | M | — | À exécuter |
| UI-PAY-05 | Formulaire inline « Nouveau paiement » : patient (solde + pack affichés), montant formaté fr-FR, date-heure, mode, notes | Conforme | M | — | À exécuter |
| UI-PAY-06 | Montant ≤ 0 accepté uniquement avec notes | Conforme | M | Moyenne | À exécuter |
| UI-PAY-07 | Montant 0 interdit pour la 1ʳᵉ séance d'un pack (avertissement + blocage) | Conforme | M | Moyenne | À exécuter |
| UI-PAY-08 | Flux « paiement obligatoire » (`?patientId=…`) : formulaire ouvert, sortie bloquée (beforeunload + router.push) jusqu'à enregistrement | Conforme | M | Moyenne | À exécuter |
| UI-PAY-09 | Dialog « Paiement requis » (« Rester ici » / « Quitter sans payer ») | Conforme | M | Faible | À exécuter |
| UI-PAY-10 | Après paiement, le solde du patient est mis à jour | Conforme | M | — | À exécuter |
| UI-PAY-11 | Suppression (confirm) | Conforme + solde recalculé | M | — | À exécuter |
| UI-PAY-12 | Édition `/payments/[id]/edit` (patient lecture seule, montant, mode, statut, notes) | Conforme | m | — | À exécuter |
| UI-PAY-13 | Montant invalide à l'édition | Message « Veuillez entrer un montant valide » | m | — | À exécuter |
| UI-PAY-14 | État vide | Conforme | m | — | À exécuter |

### 8.9 `/company-invoices` (factures + entreprises)

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-INV-01 | Onglets Factures / Entreprises | Conforme | M | — | À exécuter |
| UI-INV-02 | Bouton contextuel « Nouvelle facture » / « Nouvelle entreprise » | Conforme | M | — | À exécuter |
| UI-INV-03 | Filtres Factures : référence, entreprise, date, total TTC | Conforme | M | — | À exécuter |
| UI-INV-04 | Filtres Entreprises : nom, propriétaire, adresse, RC, NIF, Art | Conforme | M | — | À exécuter |
| UI-INV-05 | Tri colonnes (2 tables, indépendants) | Conforme | m | — | À exécuter |
| UI-INV-06 | Pagination client 10/page (2 tables) | Conforme | m | — | À exécuter |
| UI-INV-07 | Bouton « Imprimer » → PDF `facture-{reference}.pdf` (en-tête fournisseur, client, items, totaux, montant en lettres, moyen de paiement) | Conforme | M | — | À exécuter |
| UI-INV-08 | PDF avec accents/entités HTML | Rendu correct (pas de mojibake) | M | Moyenne | À exécuter |
| UI-INV-09 | PDF sans items / totaux à 0 | Pas de crash | m | Faible | À exécuter |
| UI-INV-10 | Suppression facture / entreprise (confirm) | Conforme + gestion erreur FK | M | Moyenne | À exécuter |
| UI-INV-11 | États vides dédiés | Conforme | m | — | À exécuter |
| UI-INV-12 | `/company-invoices/new` : référence préremplie via `getNextReference`, ligne d'items (ajout/suppression), calculs en direct | Conforme | M | — | À exécuter |
| UI-INV-13 | Formulaire facture : validations entreprise/référence/date/au moins une ligne avec description | Conforme | M | — | À exécuter |
| UI-INV-14 | `/company-invoices/companies/[id]/edit` : édition puis retour | Conforme | m | — | À exécuter |
| UI-INV-15 | Total HT item = séances × apprenants × PU | Exact | M | — | À exécuter |

### 8.10 `/expenses` et `/expenses/[id]`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-EXP-01 | Accès non-admin → redirection `/` + écran « Accès réservé aux administrateurs. » | Conforme | M | — | À exécuter |
| UI-EXP-02 | Liste + tri + pagination 10/page | Conforme | M | — | À exécuter |
| UI-EXP-03 | Filtres : libellé, catégorie, créé par, montant, date | Conforme | M | — | À exécuter |
| UI-EXP-04 | « Total des dépenses » réactif aux filtres | Exact | M | — | À exécuter |
| UI-EXP-05 | Dialog création/modification (`ExpenseForm`) : libellé/titre requis, montant > 0, date requise | Conforme | M | — | À exécuter |
| UI-EXP-06 | Suppression (confirm) | Conforme | m | — | À exécuter |
| UI-EXP-07 | `/expenses/[id]` détail (accès admin, 404 géré) | Conforme | m | — | À exécuter |
| UI-EXP-08 | Route `/expenses/[id]` orpheline (aucun lien depuis la liste) | Accessible par URL | m | — | À exécuter |

### 8.11 `/reports` et `/analytics`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-RPT-01 | `/reports` : recherche (patient/service/praticien), cartes, pagination 10/page | Conforme | M | — | À exécuter |
| UI-RPT-02 | Clic carte → `/patients/[id]/notes` | Conforme | m | — | À exécuter |
| UI-RPT-03 | États vides (avec/sans recherche) | Conforme | m | — | À exécuter |
| UI-RPT-04 | `/reports` absent du menu latéral | Accès par URL uniquement | m | — | À exécuter |
| UI-ANA-01 | `/analytics` : Area RDV 7 j, Bar revenus 7 j, Pie statuts + total | Affichage conforme | M | — | À exécuter |
| UI-ANA-02 | « Tendance des revenus » calcule sur `expenses.status === 'paid'` et `total` (champs probablement inexistants) | Graphique probablement toujours à 0 → **anomalie à confirmer** | M | Moyenne | À exécuter |
| UI-ANA-03 | Non-admin : `expenses.getAll` → 403 → données absentes | Affichage dégradé sans crash | M | Moyenne | À exécuter |
| UI-ANA-04 | `/analytics` absent du menu | URL uniquement | m | — | À exécuter |

### 8.12 `/admin`

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-ADM-01 | Accès non-admin → `/` + « Accès refusé… » | Conforme | M | — | À exécuter |
| UI-ADM-02 | Onglet Utilisateurs : ajout (prénom/nom/rôle/téléphone + services si non-admin) | Conforme | M | — | À exécuter |
| UI-ADM-03 | Aperçu du pseudo généré `prenom_nom` + mention mdp par défaut `123456789` | Conforme | m | — | À exécuter |
| UI-ADM-04 | Tableau utilisateurs + tri (prénom, nom, pseudo, rôle, date) | Conforme | m | — | À exécuter |
| UI-ADM-05 | Modification d'un utilisateur (dont rôle) | Conforme | M | — | À exécuter |
| UI-ADM-06 | Réinitialisation de mot de passe (confirm → `123456789`) | Conforme puis connexion avec le mdp par défaut | M | — | À exécuter |
| UI-ADM-07 | Suppression d'utilisateur (confirm) | Conforme + impact sur données liées | M | Moyenne | À exécuter |
| UI-ADM-08 | Libellés de rôle Admin/Psy/Coach cohérents partout | Conforme | m | — | À exécuter |
| UI-ADM-09 | Onglet Paramètres : carrousel paramètres calendrier par rôle (durée ≥ 15 step 15, début/fin, pause déjeuner, jours de repos) + Sauvegarder | Conforme (3 rôles) | M | — | À exécuter |
| UI-ADM-10 | Durée < 15 saisie manuellement | Blocage UI (min) — sinon API accepte (cf. API-SET-12) | m | Moyenne | À exécuter |
| UI-ADM-11 | Listes du dossier patient : ajout/suppression professions + motifs, « Sauvegarder les listes » | Conforme ; impact immédiat sur `PatientForm` | M | — | À exécuter |
| UI-ADM-12 | Onglet Services/Packs : « Nouveau », tableau (nom, type, séances, prix), Modifier, Supprimer (AlertDialog) | Conforme | M | — | À exécuter |
| UI-ADM-13 | Onglet Journal d'activité : filtres (recherche, action, ressource), Actualiser, tri, pagination serveur 50/page | Conforme | M | — | À exécuter |
| UI-ADM-14 | Nouvelles actions apparaissent bien dans le filtre « Action » | Conforme | m | Faible | À exécuter |
| UI-ADM-15 | Pagination > 1 page : Précédent/Suivant + compteur | Conforme | m | — | À exécuter |

### 8.13 Composants transverses

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| UI-CMP-01 | `FilterDialog` : panneau pleine largeur, badge de compteur, Réinitialiser/Appliquer, tous les types (texte, select, date-range, number-range, checkbox) | Conforme | M | — | À exécuter |
| UI-CMP-02 | `SortableHeader` : flèche asc/desc, colonne active soulignée, tri numérique vs alphabétique (locale FR) | Conforme | m | — | À exécuter |
| UI-CMP-03 | `PaginationControls` : masqué si 1 page, ellipses, compteur | Conforme | m | — | À exécuter |
| UI-CMP-04 | `PatientSearchSelect` : recherche nom/email, dédoublonnage, mise en évidence no-shows (orange ≥2, rouge ≥3), `resetKey` | Conforme | M | — | À exécuter |
| UI-CMP-05 | Sidebar : item actif, repli/dépli, tooltips en mode replié, mobile (backdrop, blocage du scroll) | Conforme | M | — | À exécuter |
| UI-CMP-06 | Menu utilisateur : mot de passe, Admin (admin), Déconnexion | Conforme | M | — | À exécuter |
| UI-CMP-07 | Toasts (succès/erreur) | Conforme | m | — | À exécuter |
| UI-CMP-08 | `lib/api.ts` : mapping des erreurs 401/403/404/500 + erreur réseau | Messages exacts | M | — | À exécuter |
| UI-CMP-09 | `lib/api.ts` : `NEXT_PUBLIC_API_URL` absent → exception explicite | Conforme | M | Faible | À exécuter |
| UI-CMP-10 | Squelettes de chargement (`ListPageSkeleton`, `DashboardSkeleton`, `DetailPageSkeleton`, `FormPageSkeleton`) | Conforme | m | — | À exécuter |

---

## 9. Parcours de bout en bout (E2E)

| ID | Parcours | Étapes clés | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|---|
| E2E-01 | **Onboarding patient complet** | Login admin → Nouveau patient (5 étapes) → apparaît dans la liste avec solde 0 → fiche détail | Patient créé, `isProspect=true` | C | — | À exécuter |
| E2E-02 | **Prise de RDV + pack automatique** | Sélectionner patient + service pack → créer RDV psy → pack auto-créé/linked | RDV + pack visibles | C | — | À exécuter |
| E2E-03 | **Prise en charge + compte rendu + débit** | « Prendre en charge » → saisir compte rendu → Enregistrer → RDV `completed` → pack `remaining-1` → séance visible dans l'historique | Conforme | C | — | À exécuter |
| E2E-04 | **Paiement + solde** | `/payments?patientId` (flux obligatoire) → enregistrer paiement → solde = montant − séances débitées | Exact | C | — | À exécuter |
| E2E-05 | **Annulation + remboursement de séance** | Annuler un RDV non complété avec motif → pack `remaining+1` (ou pack supprimé si non entamé) | Conforme | M | — | À exécuter |
| E2E-06 | **Pack différé complet** | Créer RDV « pack après la séance » sans service → compléter (aucun débit) → page rapport → popup pack obligatoire → choisir Neuro8 → pack 7/8, `service_id` renseigné, solde débité | Conforme | C | Moyenne | À exécuter |
| E2E-07 | **Pack partagé** | Créer pack → partager avec un 2ᵉ patient → RDV du bénéficiaire sur le service → complétion → séance débitée du pack propriétaire, solde du propriétaire recalculé | Conforme | M | Faible | À exécuter |
| E2E-08 | **Changement de pack** | Pack 1/8 consommé → « Changer » vers un pack 8 séances → totaux/prix/remise à jour + impact solde | Conforme | M | Faible | À exécuter |
| E2E-09 | **Liste d'attente complète** | Ajouter patient → Monter/Descendre → Réserver (crée le RDV + retire l'entrée) → Retirer | Conforme | M | — | À exécuter |
| E2E-10 | **Facture entreprise + PDF** | Créer entreprise → Nouvelle facture (lignes) → Enregistrer → Imprimer → PDF correct | Conforme | M | — | À exécuter |
| E2E-11 | **Dépense + tableau de bord admin** | Créer dépense → apparaît dans « Dépenses du mois » du dashboard | Conforme | M | — | À exécuter |
| E2E-12 | **Gestion utilisateurs** | Créer psy + services → se connecter avec le mdp par défaut → accès conforme → réinitialiser le mdp | Conforme | M | — | À exécuter |
| E2E-13 | **Multi-patients coach** | Créer RDV coach avec 3 patients (service consultation) → compléter chacun → N comptes rendus + N débits indépendants | Conforme | M | Faible | À exécuter |
| E2E-14 | **Cycle calendrier admin** | Modifier durée/début/fin/jours de repos → le calendrier des 3 rôles reflète les paramètres | Conforme | M | — | À exécuter |
| E2E-15 | **Suppression patient complète** | Supprimer un patient avec RDV/paiements/notes/packs → tout est supprimé, aucun enregistrement orphelin | Conforme | M | Moyenne | À exécuter |
| E2E-16 | **Déconnexion / révocation** | Logout → retour arrière navigateur → `/patients` → redirection `/login` | Conforme | M | Moyenne | À exécuter |
| E2E-17 | **Changement de mot de passe** | Modifier son mdp → reconnexion avec le nouveau | Conforme | M | — | À exécuter |

---

## 10. Cas limites et scénarios rares (< 1 %)

> Scénarios à faible probabilité mais à fort impact. À exécuter au moins une fois sur base de recette.

| ID | Scénario | Attendu / risque | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| EDGE-01 | Double-clic rapide sur « Enregistrer » (compte rendu) → 2 `POST /session-notes` | Le 2ᵉ doit être 409, pas de doublon | M | <1% | À exécuter |
| EDGE-02 | Double-clic sur « Prendre en charge/compléter » → 2 `PUT /complete` | Un seul débit de pack | C | <1% | À exécuter |
| EDGE-03 | Deux RDV créés simultanément sur le même créneau (course) | Un seul passe (pas de verrou applicatif → possibilité de doublon) | C | <1% | À exécuter |
| EDGE-04 | Deux packs créés simultanément pour un même patient/service | Pas de contrainte d'unicité → doublons possibles | M | <1% | À exécuter |
| EDGE-05 | Deux ajouts simultanés en liste d'attente (même praticien) | Collision `position` → contrainte UNIQUE → 500 possible | m | <1% | À exécuter |
| EDGE-06 | RDV créé à cheval sur minuit (start 23:30, end 00:30) | `availability` par `DATE(start_time)` = comportement à valider | m | <1% | À exécuter |
| EDGE-07 | Changement d'heure / fuseaux horaires | Dates stockées/affichées cohérentes | m | <1% | À exécuter |
| EDGE-08 | Pack `total_sessions = 1` : partage impossible | Message « maximum de bénéficiaires atteint (0/1) » | m | <1% | À exécuter |
| EDGE-09 | Pack dont le service a été supprimé logiquement | Références toujours résolues (JOIN sur `services` sans filtre `is_active`) | M | <1% | À exécuter |
| EDGE-10 | Patient avec 2000+ entrées (cap `GET /patients`) | Troncature silencieuse → données manquantes dans les listes déroulantes | M | <1% | À exécuter |
| EDGE-11 | Plus de 100 paiements (cap `GET /payments`) | Liste tronquée, `total` incohérent → total affiché faux | M | <1% | À exécuter |
| EDGE-12 | Suppression d'un utilisateur référencé par des données (RDV, notes, packs, dépenses, factures) | Comportement CASCADE/RESTRICT/SET NULL selon table → vérifier chaque cas | M | <1% | À exécuter |
| EDGE-13 | Suppression de l'entreprise liée à une facture | FK RESTRICT → erreur (message générique 500 côté API) | m | <1% | À exécuter |
| EDGE-14 | Facture dont le créateur a été supprimé | Facture absente de `GET /` (INNER JOIN users) | M | <1% | À exécuter |
| EDGE-15 | Compte rendu sur un RDV dont `service_id` est NULL | Note invisible dans `GET /session-notes` et dans l'historique du patient | M | <1% | À exécuter |
| EDGE-16 | Échec au milieu d'un `POST /company-invoices` (transaction non atomique) | Facture partielle créée → corruption de données | C | <1% | À exécuter |
| EDGE-17 | Suppression d'un pack partagé pendant qu'un RDV du bénéficiaire est planifié | Pas de blocage ; complétion ultérieure sans pack | M | <1% | À exécuter |
| EDGE-18 | Patient mineur avec situation familiale/enfants renseignés via API | Étape masquée côté UI mais API l'accepte → données incohérentes possibles | m | <1% | À exécuter |
| EDGE-19 | Téléphone au format international atypique (`+213 ...`, tirets) | Regex accepte ; rejette les formats non listés | m | <1% | À exécuter |
| EDGE-20 | Nom contenant `%`, `_`, apostrophes, accents, emojis | Recherche/filtrage/PDF robustes | m | <1% | À exécuter |
| EDGE-21 | Note de compte rendu de 100 000 caractères | Limite 100 ko du corps JSON → 413, message clair | m | <1% | À exécuter |
| EDGE-22 | Session expirée pendant le remplissage d'un formulaire long | Erreur 401 explicite, pas de perte silencieuse | M | <1% | À exécuter |
| EDGE-23 | Cookie tiers bloqué par le navigateur (prod cross-site) | Échec d'authentification → à documenter (risque connu du projet) | M | <1% | À exécuter |
| EDGE-24 | Navigateur avec `localStorage`/cookies désactivés | Message d'erreur compréhensible | m | <1% | À exécuter |
| EDGE-25 | Retour arrière navigateur après suppression d'un patient dont la fiche est ouverte | Pas de crash (404 géré) | m | <1% | À exécuter |
| EDGE-26 | Deux onglets ouverts : données modifiées dans l'un, action dans l'autre | Incohérence bénigne, pas de corruption | m | <1% | À exécuter |
| EDGE-27 | `patients.balance` recalculé manuellement puis payé en double | Solde exact (idempotence du recalcul) | M | <1% | À exécuter |
| EDGE-28 | RDV complété dont le service a été désactivé logiquement | `serviceName` toujours affiché (JOIN sans filtre actif) | m | <1% | À exécuter |
| EDGE-29 | Fuseau/date de naissance « 29/02 » | Calcul d'âge sans erreur | m | <1% | À exécuter |
| EDGE-30 | Patient avec date de naissance dans le futur | `patientType` calculé → valeur négative/absurde | m | <1% | À exécuter |
| EDGE-31 | `PUT /appointments/:id` sans `patientIds` (contrôle de chevauchement ignoré) | Un patient peut se retrouver sur 2 RDV chevauchants par cette voie | M | <1% | À exécuter |
| EDGE-32 | Multi-patient : suppression d'un patient d'un RDV multi-patients | Le RDV entier est supprimé (impact sur les autres) | M | <1% | À exécuter |
| EDGE-33 | Génération PDF avec jsPDF : très longue référence / très nombreux items | Mise en page non cassée | m | <1% | À exécuter |
| EDGE-34 | Impression PDF : navigateur bloque les popups/le téléchargement | Message d'erreur ou fallback | m | <1% | À exécuter |
| EDGE-35 | `search` contenant uniquement des espaces | Ignoré, pas de filtre, pas d'erreur | m | <1% | À exécuter |
| EDGE-36 | `pageSize` très grand (10000) sur `/patients/paged` | Borné à 100 | m | <1% | À exécuter |
| EDGE-37 | `POST /users` puis suppression immédiate avant reconnexion | Aucune session fantôme | m | <1% | À exécuter |
| EDGE-38 | Patient créé avec `hasChildren=true` et `childrenCount` vide | Affichage cohérent | m | <1% | À exécuter |
| EDGE-39 | RDV `pack_deferred=true` avec service renseigné a posteriori via `/select` sur un RDV d'un autre patient | Vérifier l'absence de fuite inter-patients | C | <1% | À exécuter |
| EDGE-40 | Deux patients partagent le même e-mail/téléphone | Recherche renvoie les deux sans erreur | m | <1% | À exécuter |

---

## 11. Tests non-fonctionnels

| ID | Test | Attendu | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| NFR-01 | Temps de réponse `GET /patients/paged` sur 2000 patients | < 1 s | m | — | À exécuter |
| NFR-02 | Temps de réponse `GET /appointments` sur 2000 RDV | < 1 s | m | — | À exécuter |
| NFR-03 | Temps de réponse du tableau de bord (7 appels parallèles) | < 3 s, pas de blocage | m | — | À exécuter |
| NFR-04 | Chargement front (skeletons) puis hydratation sans « flash » | Conforme | m | — | À exécuter |
| NFR-05 | Compatibilité navigateurs : Chrome, Edge, Firefox, Safari | Fonctionnel (PDF, dates, cookies) | M | — | À exécuter |
| NFR-06 | Responsive : 360 px, 768 px, 1024 px, 1440 px | Pas de débordement | M | — | À exécuter |
| NFR-07 | Accessibilité clavier : navigation dans les dialogs, focus piégé | Conforme | m | — | À exécuter |
| NFR-08 | Contraste et libellés des champs (a11y) | Lisible | m | — | À exécuter |
| NFR-09 | Session longue (> 7 j) | 401 puis redirection login | m | Faible | À exécuter |
| NFR-10 | Coupure réseau pendant une action | Message « Impossible de contacter le serveur » | M | Faible | À exécuter |
| NFR-11 | Redémarrage backend pendant l'utilisation | Message d'erreur, pas de crash front | m | Faible | À exécuter |
| NFR-12 | Fuite mémoire / listeners (`res.on('finish')`, intervals du dashboard) | Pas de fuite après 30 min d'usage | m | Faible | À exécuter |
| NFR-13 | Verrou de connexion PostgreSQL : 100 requêtes authentifiées simultanées | Pool non épuisé (défaut pg ~10) → risque de saturation | M | Faible | À exécuter |
| NFR-14 | Taille du body `100kb` : formulaires patients longs | Refus propre (413) si dépassement | m | Faible | À exécuter |
| NFR-15 | Cohérence des devises et formatage fr-FR (montants, dates) | Conforme partout | m | — | À exécuter |

---

## 12. Risques et anomalies identifiés lors de l'analyse statique

> À confirmer par exécution. Classés par priorité décroissante.

| ID | Constat | Impact | Sév. | Prob. | Statut |
|---|---|---|---|---|---|
| RISK-01 | Transactions `BEGIN`/`COMMIT`/`ROLLBACK` de `company-invoices.ts` passent par `pool.query` (connexions distinctes possibles) → **transaction non atomique** | Facture/items partiels en cas d'erreur | C | Faible | À confirmer |
| RISK-02 | `PUT /appointments/:id` sans `patientIds` → contrôle de chevauchement patient sur un tableau vide → **contrôle contourné** | Double réservation patient | M | Moyenne | À confirmer |
| RISK-03 | Reconstruction de la junction `appointment_patients` au PUT → CASCADE sur `patient_pack_usages` **sans rendre les séances** | Désynchronisation pack/solde | C | Faible | À confirmer |
| RISK-04 | `GET /patients/:id/history` et `GET /session-notes` font un INNER JOIN `services` → **excluent les RDV/notes à service NULL** (pack différé) | Historique/comptes rendus incomplets | M | Moyenne | À confirmer |
| RISK-05 | `GET /payments` plafonné à 100 lignes alors que `total` = COUNT(*) global | Liste et total incohérents | M | Moyenne | À confirmer |
| RISK-06 | `ensureSchema` ne crée pas `activity_logs.user_pseudo`, pourtant inséré/selecté | Échec silencieux des logs / 500 sur `/activity-logs` si colonne absente | C | Faible | À confirmer |
| RISK-07 | Aucune validation d'ordre `endTime > startTime` côté API | RDV incohérents | M | Moyenne | À confirmer |
| RISK-08 | Aucune validation du rôle à la création d'utilisateur (`POST /users`) | Rôle arbitraire en base → incohérences d'autorisation | M | Faible | À confirmer |
| RISK-09 | Double source de vérité praticien : colonne `patients.practitioner_id` (+ trigger `sync_patient_practitioner`) **vs** calcul LATERAL `cur_prac` | Divergences possibles | M | Faible | À confirmer |
| RISK-10 | `DELETE /patients/:id` supprime **tout** RDV partagé multi-patients | Perte de données pour les autres patients | M | Faible | À confirmer |
| RISK-11 | `docs/documentation.md` désynchronisée (JWT localStorage, `/auth/register`, `/dashboard`) | Documentation trompeuse | m | — | À confirmer |
| RISK-12 | `backend/package.json` `db:init` pointe vers `sql/init_postgres.sql` inexistant | Script inopérant | m | Élevée | À confirmer |
| RISK-13 | `src/db/patient-lists.ts` : accents mal encodés (`SalariǸ(e)`, `%tudiant(e)`) | Libellés corrompus si les valeurs par défaut sont utilisées | M | Moyenne | À confirmer |
| RISK-14 | `GET /analytics` : « Tendance des revenus » utilise `expenses.status === 'paid'` et `.total` (champs inexistants) | Graphique vide/erroné | m | Moyenne | À confirmer |
| RISK-15 | Onglet « Évaluations » du patient absent de l'UI alors que les données sont chargées | Fonctionnalité inaccessible | M | Moyenne | À confirmer |
| RISK-16 | Correction du trigger pack « non commitée » (signalée dans les notes projet) | Risque de double débit selon le déploiement | C | Moyenne | À confirmer |
| RISK-17 | `GET /users` : `patientCount` ignore les RDV coach sans praticien | Statistique imprécise | m | Faible | À confirmer |
| RISK-18 | `POST /patient-packs` : patient/service inexistants → 500 (FK/NOT NULL) plutôt que 400/404 | Messages d'erreur peu explicites | m | Faible | À confirmer |
| RISK-19 | Cookie `SameSite=None` en production : dépend du blocage des cookies tiers navigateur | Authentification prod fragile | M | Faible | À confirmer |
| RISK-20 | Pas de test automatisé dans le dépôt (aucun runner configuré) | Régressions non détectées | M | — | À confirmer |

---

## 13. Checklist d'exécution

### 13.1 Ordre recommandé

1. **ENV** — environnement, build, scripts, comptes.
2. **AUTH + NFR-SEC** — authentification, session, sécurité, rate-limit, CORS.
3. **DB** — contraintes, idempotence `ensureSchema`, triggers.
4. **API** — module par module (5.1 → 5.15).
5. **Règles métier** (section 6) — solde, packs, conflits, praticien.
6. **UI** (section 8) — page par page.
7. **E2E** (section 9).
8. **EDGE** (section 10) et **NFR** (section 11).
9. **RISK** (section 12) — confirmation des anomalies.

### 13.2 Pré-requis outils

- [ ] Base PostgreSQL de recette clonée + dump de sauvegarde
- [ ] Comptes `admin`, `psy`, `coach` opérationnels
- [ ] Jeux de données de la section 1.3 créés
- [ ] Navigateur + DevTools (cookies, réseau, console)
- [ ] Client HTTP (curl/Postman) pour les tests API directs
- [ ] Accès `psql` pour les tests DB et les vérifications de solde/triggers

### 13.3 Critères de sortie

- [ ] 100 % des tests **Critiques** exécutés et OK
- [ ] ≥ 95 % des tests **Majeurs** exécutés ; anomalies majeures documentées
- [ ] Aucune anomalie **Critique** ouverte
- [ ] Les 20 risques de la section 12 tranchés (confirmé / infirmé)

---

## 14. Annexe — Commandes utiles

```bash
# Backend
npm --prefix backend run dev            # serveur API (port 5001)
npm --prefix backend run typecheck      # vérification TS
npm --prefix backend run seed           # jeu de données de test
npm --prefix backend run create-admin   # compte admin

# Frontend
npm run dev                             # Next.js (port 3000)
npm run build                           # build de production
npm run dev:all                         # backend + frontend

# Vérifications SQL (exemples)
psql -U postgres -d Braincare -c "\d patients"
psql -U postgres -d Braincare -c "SELECT id, first_name, last_name, balance FROM patients ORDER BY balance LIMIT 20;"
psql -U postgres -d Braincare -c "SELECT conname, contype FROM pg_constraint WHERE conrelid='patients'::regclass;"
psql -U postgres -d Braincare -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname;"
```

---

*Fin du plan de tests. Remplir la colonne « Statut » pendant la campagne et consigner les preuves (captures, codes HTTP, requêtes SQL) dans un journal d'exécution annexe.*
