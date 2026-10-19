# Audit de code — BrainCareDZ

> **Nature** : audit statique de qualité de code et de sécurité (frontend + backend + dépendances + configuration + base de données).
> **Auteur** : revue experte par analyse du code source. **Aucune exécution dynamique** (pas de test d'intrusion, pas de scan actif) — les constats sont issus de la lecture du code, de la configuration et du résultat de `npm audit`.
> **Statut** : rapport initial. Chaque constat est vérifiable ; les éléments non confirmables sont explicitement marqués « à confirmer ».

---

## 0. Fiche documentaire

| Champ | Valeur |
|---|---|
| Projet | BrainCareDZ — gestion de cabinet de psychologie & neurofeedback |
| Domaine | **Données de santé** (comptes rendus de séance, motifs, évaluations, soldes patients) |
| Stack | Next.js 16 / React 19 / TypeScript / Tailwind 4 (front) · Express 4 / TypeScript / PostgreSQL (back) |
| Taille | ~40 fichiers applicatifs, dont 3 monolithes > 1 100 lignes ; 15 modules API |
| Date | 2026-10-11 |
| Périmètre | `app/`, `components/`, `lib/`, `hooks/`, `backend/src/`, `sql/`, configuration, dépendances |
| Hors périmètre | Audit d'infrastructure (Railway), pentest réseau, revue d'hébergeur, audit du design system |
| Référentiels | OWASP Top 10 (2021), OWASP ASVS 4.0, CWE, ISO/IEC 25010 (qualité logicielle) |

### Échelle de sévérité

| Niveau | Signification |
|---|---|
| **Critique** | Exploitable ou à impact majeur (fuite/perte de données, contournement d'authentification, compromission) |
| **Élevée** | Risque réel en production, impact significatif |
| **Moyenne** | Dette/risque modéré, à corriger à court terme |
| **Faible** | Hygiène, durcissement, maintenabilité |
| **Positif** | Bonne pratique à conserver |

### Effort de correction

`XS` < 1 h · `S` < 1 j · `M` 1-3 j · `L` 1-2 semaines · `XL` > 2 semaines

---

## 1. Synthèse exécutive

### 1.1 Scorecard

| Domaine | Note | Commentaire |
|---|---|---|
| Authentification & session | **B+** | JWT en cookie httpOnly, `token_version` (révocation), pas de secret faible accepté. Points faibles : CSRF, politique de mot de passe, `trust proxy`. |
| Autorisation | **C+** | Contrôles par rôle présents mais **incohérents** (pas de validation du rôle à la création d'utilisateur) et **IDOR généralisé** (tout authentifié lit tout). |
| Injections (SQL/XSS/commande) | **A-** | SQL entièrement paramétré, tri en liste blanche, aucun `dangerouslySetInnerHTML`. Seul point : injection de commande via `concurrently` (dev). |
| Gestion des secrets & config | **C** | `.env` gitignoré (bien) mais aucun `.env.example`, mot de passe par défaut codé en dur, en-têtes de sécurité front absents. |
| Entrées & validation | **C** | Validation hétérogène : certains modules sans validation, incohérences de schéma, dates non contrôlées. |
| Intégrité des données | **C+** | Bon usage des contraintes DB et des triggers, mais **transactions non atomiques**, suppressions en cascade larges. |
| Qualité de code backend | **D+** | `strict: false`, `: any` généralisé, duplication CRUD massive, logique métier dupliquée code/triggers. |
| Qualité de code frontend | **D** | Monolithes > 1 000 lignes, monkey-patch du routeur, `window.prompt/confirm`, `any` omniprésent, pas de couche de données. |
| Dépendances | **D** | 5 vulnérabilités front (2 high, 3 critical) + 1 backend (critical), dépendances inutilisées. |
| Tests & CI | **F** | 0 test automatisé, 0 CI, script `lint` cassé (ESLint absent). |
| Conformité données de santé | **E** | Aucune trace de chiffrement, rétention, consentement, gestion des droits. |

### 1.2 Top 10 des risques (à traiter en priorité)

| # | Risque | Sévérité |
|---|---|---|
| 1 | Mot de passe par défaut `123456789` codé en dur et **affiché dans l'UI** | Critique |
| 2 | 3 vulnérabilités **critiques** de dépendances (shell-quote, proxy-addr) + `next` vulnérable | Critique |
| 3 | CSRF : `SameSite=None` en production + aucune protection anti-CSRF (auth par cookie) | Élevée |
| 4 | `trust proxy` absent → rate limiting et IP d'audit inopérants derrière le reverse proxy | Élevée |
| 5 | Élévation de privilèges : rôle non validé à la création d'utilisateur + IDOR généralisé | Élevée |
| 6 | Transactions non atomiques (`company-invoices`) → corruption de données | Élevée |
| 7 | En-têtes de sécurité absents côté Next.js (CSP, X-Frame-Options → clickjacking) | Moyenne |
| 8 | `typescript.ignoreBuildErrors: true` → build passe avec des erreurs de type | Moyenne |
| 9 | Données de santé sans chiffrement/rétention/consentement documentés | Élevée |
| 10 | Aucun test, aucune CI, `lint` cassé | Moyenne |

### 1.3 Points forts (à préserver)

- JWT stocké en **cookie httpOnly** (pas de `localStorage`) — bonne décision.
- **Révocation de tokens** via `users.token_version` vérifiée à chaque requête.
- Refus de démarrer sans `JWT_SECRET` ≥ 32 caractères.
- `helmet` + `x-powered-by` désactivé + CORS *allowlist* + `express.json({limit:'100kb'})`.
- Rate limiting dédié sur `/auth/login`.
- **Aucune fuite de `error.message`** brute vers le client (16 modules + handler global).
- SQL **entièrement paramétré** ; tri par **liste blanche** (`PATIENT_SORTS`).
- Mots de passe hachés avec **bcrypt**.
- Contraintes DB riches (CHECK, UNIQUE, FK, index) et **triggers d'audit** alimentés par un contexte de session PostgreSQL.
- Messages d'erreur d'authentification non énumérables (`Invalid pseudo or password` constant).

---

## 2. Méthodologie

| Étape | Outils / sources |
|---|---|
| Lecture intégrale du backend (15 modules + middleware + db + scripts) | Analyse manuelle |
| Lecture du frontend (pages, composants, `lib/`, `hooks/`) | Analyse manuelle |
| Configuration (tsconfig, next.config, .gitignore, opencode.json) | Analyse manuelle |
| Dépendances | `npm audit --json` (front + back) |
| Recherche de motifs à risque | `ripgrep` : `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function(`, `localStorage`, `console.*`, `: any`, `${req.` dans du SQL, `123456789` |
| Modélisation des menaces | OWASP Top 10 / ASVS, CWE |

### 2.1 Limites

- Pas d'analyse dynamique (SAST/DAST), pas de test d'intrusion.
- `git` étant bloqué par la politique locale (`opencode.json` → `git*: deny`), **l'historique Git n'a pas pu être inspecté** : la présence de secrets dans l'historique reste **à confirmer**.
- La base de données live n'a pas été interrogée : certains constats (colonnes, contraintes) sont basés sur `backend/src/db/schema.ts` et les fichiers `sql/`.
- Les fichiers `components/ui/*` (shadcn/ui) sont du code généré : audités de façon superficielle.

---

## 3. Constats de sécurité

### 3.1 Authentification, session et identité

| ID | Constat | Preuve | Impact | CWE / OWASP | Sévérité | Effort |
|---|---|---|---|---|---|---|
| SEC-01 | **Mot de passe par défaut `123456789` codé en dur** et réutilisé pour tous les comptes créés et les réinitialisations ; il est **affiché dans l'interface** (« Mot de passe par défaut : 123456789 ») | `backend/src/modules/users.ts:115` ; `app/admin/page.tsx:514,519,1263` | Tout compte créé est compromis par défaut ; un attaquant connaît le mot de passe de tout nouveau collaborateur | CWE-798, CWE-521 / A07 | **Critique** | S |
| SEC-02 | Mot de passe `Admin123!` codé en dur (script `create-admin`) et affiché en clair dans les logs de sortie | `backend/src/scripts/create-admin.ts:17,35,48` | Compromission du compte administrateur si le script est utilisé tel quel | CWE-798 / A07 | **Élevée** | XS |
| SEC-03 | **Politique de mot de passe faible** : longueur minimale de 6 caractères, aucune exigence de complexité, aucune vérification contre les mots de passe compromis, aucun historique | `backend/src/modules/users.ts:215,249` ; `lib/...` (pas de règle front) | Comptes vulnérables au bruteforce/dictionnaire | CWE-521 / A07 | **Élevée** | S |
| SEC-04 | Authentification par **cookie sans jeton CSRF**, et cookie `SameSite=None` **en production** | `backend/src/modules/auth.ts:13-23` ; `lib/api.ts:57` | Requêtes *state-changing* forgeables depuis un site tiers (selon navigateur et type de requête) | CWE-352 / A01 | **Élevée** | M |
| SEC-05 | `trust proxy` **non configuré** alors que l'app est déployée derrière un reverse proxy | `backend/src/index.ts` (aucun `app.set('trust proxy', …)`) | `req.ip` = IP du proxy → **rate limiting global partagé par tous les utilisateurs** (DoS trivial) et IP d'audit erronée | CWE-346, CWE-307 / A04 | **Élevée** | XS |
| SEC-06 | Aucun verrouillage/ralentissement **par compte** après échecs répétés (seul un rate limit par IP, contournable) | `backend/src/index.ts:89-95` | Attaque par dictionnaire distribuée | CWE-307 / A07 | Moyenne | S |
| SEC-07 | Payload JWT décodé et affecté à `req.user` **sans validation de schéma** (`const decoded: any`) | `backend/src/middleware/auth.ts:20-21` | Comportement indéfini si un token signé contient un payload inattendu (rôle forgé possible si le secret fuit) | CWE-20 / A08 | Moyenne | S |
| SEC-08 | Le rôle n'est **jamais validé** à la création d'utilisateur (`POST /users`) : toute valeur est acceptée | `backend/src/modules/users.ts:98-136` | Rôle arbitraire en base → incohérences d'autorisation, futures escalades | CWE-20, CWE-269 / A04 | **Élevée** | XS |
| SEC-09 | `authorize()` se contente d'un `includes` sur `req.user.role` ; aucun contrôle de rôle n'est centralisé pour les ressources (pas d'ABAC) | `backend/src/middleware/auth.ts:87-94` | Maintenabilité/robustesse des autorisations | CWE-863 / A01 | Moyenne | M |
| SEC-10 | **IDOR / accès horizontal** : toutes les routes GET détail (`/patients/:id`, `/payments/:id`, `/appointments/:id`, `/session-notes/:id`, `/company-invoices/:id`, `/patient-packs/patient/:id`…) sont accessibles à **tout utilisateur authentifié**, sans contrôle de périmètre | Modules `patients.ts`, `payments.ts`, `appointments.ts`, `session-notes.ts`, `company-invoices.ts`, `patient-packs.ts` | Un compte à faible privilège (coach) lit l'intégralité du dossier clinique | CWE-639 / A01 | **Élevée** *(à trancher : choix métier « tous voient tout » ?)* | M |

### 3.2 Secrets, configuration et exposition

| ID | Constat | Preuve | Impact | CWE / OWASP | Sévérité | Effort |
|---|---|---|---|---|---|---|
| SEC-11 | **`.env.example` absent** : aucune documentation des variables requises (le démarrage échoue silencieusement si `JWT_SECRET` manque) | `glob **/.env*` → aucun exemple ; `.gitignore:31-38` | Onboarding/erreurs de config, secrets improvisés | CWE-1104 / A05 | Moyenne | XS |
| SEC-12 | Secrets (`JWT_SECRET`, `DB_PASSWORD`) en clair dans `backend/.env` sur disque ; **historique Git non vérifiable** (git bloqué localement) | `backend/.env` ; `.gitignore:32-35` | Fuite de secrets si le fichier a déjà été committé | CWE-798 / A02 | **Élevée** *(à confirmer)* | S |
| SEC-13 | **Aucun en-tête de sécurité côté frontend Next.js** : pas de Content-Security-Policy, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS | `next.config.mjs` (aucun `headers()`) | Clickjacking, XSS non mitigé, fuite de Referer | CWE-1021, CWE-693 / A05 | Moyenne | S |
| SEC-14 | `opencode.json` committé expose des **chemins locaux absolus** (nom d'utilisateur) et une politique dont `git*: deny` | `opencode.json:38-45` | Fuite d'information mineure | CWE-200 | Faible | XS |
| SEC-15 | IP et origines privées **codées en dur** dans la configuration | `next.config.mjs:8` (`10.28.73.66`, `10.20.12.75`) ; `backend/src/index.ts:57-68` | Fuite d'infrastructure, configuration non portable | CWE-200 | Faible | XS |
| SEC-16 | `helmet` avec `crossOriginResourcePolicy: 'cross-origin'` (assouplissement volontaire) | `backend/src/index.ts:44-47` | Réduction de l'isolation des ressources | CWE-693 | Faible | XS |
| SEC-17 | CORS : requêtes **sans en-tête `Origin` acceptées** (`if (!origin) return true`) | `backend/src/index.ts:71-76` | Atténué (comportement standard), mais les clients non-navigateur ne sont pas filtrés | CWE-346 | Faible | XS |
| SEC-18 | Journalisation de données potentiellement sensibles dans la console (réponses API complètes, identifiants) | `lib/api.ts:64` (`console.error(..., data)`) ; `backend/src/modules/appointments.ts:137` | Fuite vers les DevTools/logs, données patients dans les logs | CWE-532 / A09 | Moyenne | S |
| SEC-19 | `metadata.generator: 'v0.app'` et artefacts d'outil laissés dans le code livré | `app/layout.tsx:14` | Fuite d'information, manque de professionnalisme | CWE-200 | Faible | XS |

### 3.3 Validation des entrées et intégrité

| ID | Constat | Preuve | Impact | CWE / OWASP | Sévérité | Effort |
|---|---|---|---|---|---|---|
| SEC-20 | `POST/PUT /users/:id` : aucune validation du rôle (cf. SEC-08) ; `PUT` accepte n'importe quel sous-ensemble | `backend/src/modules/users.ts:98-192` | Mass-assignment partiel, incohérences | CWE-20 | **Élevée** | XS |
| SEC-21 | **Transactions non atomiques** : `BEGIN`/`COMMIT`/`ROLLBACK` passent par `pool.query` (connexions potentiellement différentes) | `backend/src/modules/company-invoices.ts:96,170,174,199,301,305` | Facture/items partiellement écrits en cas d'erreur → corruption | CWE-754, CWE-362 / A04 | **Élevée** | S |
| SEC-22 | Aucune validation de cohérence temporelle (`endTime > startTime`, `expenseDate`, plages de dates) | `backend/src/modules/appointments.ts:113-132` | Données incohérentes, tris/récupérations erronés | CWE-20 | Moyenne | XS |
| SEC-23 | Champs texte **sans limite de longueur** (notes de séance, notes de paiement, changements observés) → jusqu'à 100 ko | `backend/src/modules/session-notes.ts:144-153` ; `express.json({limit:'100kb'})` | DoS applicatif léger, stockage abusif | CWE-770 / A04 | Moyenne | S |
| SEC-24 | `DELETE /patients/:id` supprime des **RDV partagés** multi-patients (impact sur des tiers) | `backend/src/modules/patients.ts:571-576` | Perte de données pour d'autres patients | CWE-863 | Moyenne | S |
| SEC-25 | Reconstruction de la table de jonction au `PUT /appointments/:id` → `CASCADE` sur `patient_pack_usages` **sans rendre les séances** | `backend/src/modules/appointments.ts:406-415` ; `schema.ts:53-59` | Désynchronisation packs/soldes | CWE-754 | **Élevée** | S |
| SEC-26 | Contrôle de chevauchement patient **contourné** quand `patientIds` n'est pas transmis au `PUT` (tableau vide) | `backend/src/modules/appointments.ts:372-387` | Double réservation d'un patient | CWE-20 | Moyenne | XS |
| SEC-27 | `POST /patient-packs` : patient/service inexistants → erreur SQL 500 (au lieu de 400/404) | `backend/src/modules/patient-packs.ts:60-67` | Messages d'erreur imprécis, fuite de structure | CWE-209 | Faible | XS |
| SEC-28 | Recherche `ILIKE '%…%'` non indexée (pas de `pg_trgm`) | `backend/src/modules/patients.ts:322-326` | Dégradation de performance (DoS par requêtes coûteuses) | CWE-400 | Moyenne | S |

### 3.4 Journalisation, audit et non-répudiation

| ID | Constat | Preuve | Impact | Sévérité | Effort |
|---|---|---|---|---|---|
| SEC-29 | **Erreurs d'audit avalées silencieusement** : `logActivity` attrape et ignore toute erreur | `backend/src/utils/activity-logger.ts:52-54` | Trou de traçabilité non détecté dans un contexte de santé (non-répudiation) | **Élevée** | S |
| SEC-30 | Le trigger `fn_audit_log` échoue en `RAISE WARNING` (opération métier poursuivie) | `sql/audit_trigger.sql` (bloc `EXCEPTION WHEN OTHERS`) | Ligne d'audit manquante sans alerte exploitable | Moyenne | S |
| SEC-31 | Colonne `activity_logs.user_pseudo` utilisée par le code mais **absente de `ensureSchema`** | `backend/src/db/schema.ts:196-214` vs `activity-logs.ts:32` / `activity-logger.ts:27` | Si absente en base : 500 sur `/activity-logs` et journalisation manuelle muette | **Élevée** *(à confirmer en base)* | XS |
| SEC-32 | Aucune purge/rétention du journal d'activité (croissance illimitée, `changes` en JSONB complet contenant potentiellement des données de santé) | `sql/audit_trigger.sql` (`jsonb_build_object('old', v_old, 'new', v_new)`) | Stockage non maîtrisé, données de santé dupliquées dans les logs | Moyenne | M |

### 3.5 Dépendances et chaîne d'approvisionnement

| ID | Constat | Preuve | Impact | CWE / OWASP | Sévérité | Effort |
|---|---|---|---|---|---|---|
| SEC-33 | **`concurrently` → `shell-quote` critique** : injection de commande via un terminateur de ligne après un jeton `{ comment }` | `npm audit` (frontend) | Exécution de commandes arbitraires si un script malveillant est exécuté en dev/CI | CWE-78 / A06 | **Critique** *(dev)* | XS |
| SEC-34 | **`proxy-addr` critique** : usurpation d'IP via sous-réseau de confiance IPv4-mapped IPv6 | `npm audit` (frontend **et** backend, transitif) | Falsification d'IP → contournement de rate limit / falsification de l'IP d'audit | CWE-346 / A06 | **Critique** | XS |
| SEC-35 | **`next` (high)** : SSRF dans l'optimisation d'images, empoisonnement de cache SSG/ISR, divulgation d'information (dev MCP, metadata) | `npm audit` (frontend) | SSRF, empoisonnement de cache, divulgation | CWE-918, CWE-345 / A06 | **Élevée** | XS |
| SEC-36 | **`source-map-js` (high)** : DoS de la boucle d'événements via des offsets de sections de source-map | `npm audit` (frontend) | Déni de service | CWE-400 / A06 | Moyenne | XS |
| SEC-37 | **Dépendances inutilisées dans le frontend** : `express`, `mongoose`, `cors`, `jsonwebtoken`, `bcryptjs`, `express-validator`, `dotenv`, `html2canvas`, `embla-carousel-react`, `input-otp`, `vaul`, `@hookform/resolvers`, `zod` | `package.json` racine vs absence d'import (ripgrep) | Surface d'attaque et `npm audit` pollués, installation alourdie, confusion d'architecture (code serveur dans un projet client) | CWE-1104 / A06 | Moyenne | S |
| SEC-38 | Double version de `bcryptjs` (v2 backend, v3 frontend) | `package.json` ×2 | Divergence de comportement/compatibilité | CWE-1104 | Faible | XS |

---

## 4. Constats — Qualité du code backend

| ID | Constat | Preuve | Impact | Sévérité | Effort |
|---|---|---|---|---|---|
| BQ-01 | **`strict: false` et `noImplicitAny: false`** : TypeScript n'apporte quasiment aucune garantie | `backend/tsconfig.json:9-10` | Erreurs de type non détectées en production | **Élevée** | M |
| BQ-02 | `: any` employé partout (payloads JWT, `req`, `changes`, erreurs, params SQL) | 31 occurrences relevées dans `backend/src` | Perte du typage, régressions silencieuses | **Élevée** | L |
| BQ-03 | **Duplication CRUD massive** : le même squelette `try { … } catch { res.status(500).json({message:'Erreur interne du serveur'}) }` est recopié dans les 15 modules ~90 fois | tous les `modules/*.ts` | Coût de maintenance, incohérences, correctifs à répéter | **Élevée** | L |
| BQ-04 | **Contrat d'API incohérent** : certains modules renvoient `{message}`, d'autres `{error}`, d'autres les deux ; certaines listes utilisent `count`, d'autres `total` ou `data.*` | `users.ts` (`error`), `patients.ts` (`message`+`count`), `activity-logs.ts` (`data.logs`) | Client fragile, intégrations imprévisibles | Moyenne | M |
| BQ-05 | **Validation hétérogène** : `express-validator` utilisé dans 8 modules mais absent de `payments`, `patient-packs`, `patient-outcomes` (partiel), `users` (partiel), `session-notes` (PUT) | comparaison des modules | Entrées non contrôlées, sécurité dépendante du développeur | **Élevée** | M |
| BQ-06 | Pas de **logger structuré** (niveau, corrélation, JSON) : uniquement `console.log/error`, avec logs de debug non conditionnés à `NODE_ENV` | `backend/src/db/index.ts:73-84` ; tous les modules | Observabilité insuffisante en production | Moyenne | M |
| BQ-07 | Requête `baseSelect` de `patients.ts` : **~160 lignes de SQL** avec 4 `LEFT JOIN LATERAL` imbriqués, dupliquant presque intégralement la logique de `pack_next` et `pack_list` | `backend/src/modules/patients.ts:87-246` | Performance (sous-requêtes corrélées sur toute la table), maintenance très difficile | **Élevée** | L |
| BQ-08 | **Logique métier dupliquée code + triggers** : le débit/rendu de séance existe à la fois dans `sync_pack_on_appointment_status` (SQL) **et** dans `appointments.ts` DELETE (TS) | `schema.ts:100-193` vs `appointments.ts:459-491` | Divergences garanties à terme (c'est déjà la source du « double débit » signalé) | **Élevée** | M |
| BQ-09 | **Pas d'outil de migration** : `ensureSchema()` exécute du DDL au démarrage et des fichiers `sql/*.sql` hétérogènes | `backend/src/db/schema.ts:8-395` ; `sql/` | Impossible de reconstruire l'état exact d'un environnement, dérive garantie | **Élevée** | L |
| BQ-10 | `ensureSchema` **supprime dynamiquement toutes les contraintes CHECK** de `activity_logs` au démarrage | `backend/src/db/schema.ts:220-229` | DDL destructif implicite, comportement non déterministe | Moyenne | S |
| BQ-11 | `sql/init_postgres.sql` référencé par `npm run db:init` **est absent du dépôt** | `backend/package.json` (`db:init`) ; `sql/` | Script inopérant, onboarding défaillant | Moyenne | XS |
| BQ-12 | Pool `pg` **non configuré** (max par défaut = 10) alors qu'un client est réservé le temps de chaque requête authentifiée | `backend/src/db/index.ts:19-46` ; `middleware/auth.ts:24-74` | Saturation/épuisement du pool sous charge, timeouts en cascade | **Élevée** | S |
| BQ-13 | `connectDB` fait `process.exit(1)` sur erreur, sans **retry/backoff** (échec au démarrage) | `backend/src/db/index.ts:88-92` | Instabilité au démarrage (orchestrateurs, DB lente) | Moyenne | S |
| BQ-14 | `seed.ts` **efface toutes les tables** (`DELETE FROM users, patients, …`) **sans garde `NODE_ENV`** | `backend/src/scripts/seed.ts:17-24` | Catastrophe irréversible si lancé par erreur en production | **Critique** *(conditionnel)* | XS |
| BQ-15 | Vocabulaire de statuts incohérent : le frontend `analytics` compte un statut `no-show` qui n'existe pas côté API (annulations = `cancelled`) | `app/analytics/page.tsx:80` | KPI faux | Moyenne | XS |
| BQ-16 | Sémantique « no-show » approximative : `consecutive_no_shows` compte les ANNULATIONS, pas les absences | `backend/src/modules/patients.ts:227-245` | Indicateur clinique trompeur | Moyenne | S |
| BQ-17 | Message d'erreur fautif et en anglais dans un produit francophone : `'A mount of 0 requires notes'` | `backend/src/modules/payments.ts:62` | Qualité perçue, i18n | Faible | XS |
| BQ-18 | Code mort : ancienne implémentation `resolveApiBaseUrl` commentée (12 lignes) ; exports inutilisés (`authorizeRole`, `getClient`, `closePool`) | `lib/api.ts:1-12` ; `middleware/auth.ts:97` ; `db/index.ts:56-68` | Confusion, dette | Faible | XS |
| BQ-19 | Encodage corrompu des accents dans les valeurs par défaut | `backend/src/db/patient-lists.ts` (`SalariǸ(e)`, `%tudiant(e)`) | Libellés corrompus si les défauts sont utilisés | Moyenne | XS |
| BQ-20 | Double source de vérité pour le praticien : colonne `patients.practitioner_id` (+ trigger `sync_patient_practitioner`) **et** calcul `LATERAL cur_prac` | `sql/integrity_fixes.sql` ; `backend/src/modules/patients.ts:125-133` | Divergences de données | Moyenne | M |
| BQ-21 | Pas de pagination sur la plupart des listes : `LIMIT` fixes (500, 1000, 2000) et `payments` plafonné à **100** lignes alors que `total` est global | `payments.ts:20` ; `patients.ts:250` ; etc. | Résultats tronqués silencieusement / incohérents avec les compteurs | Moyenne | M |
| BQ-22 | Absence de **transactions** pour les opérations multi-écritures (création patient + motifs + outcome ; RDV + jonction + pack ; facture + items) | `patients.ts:416-446` ; `appointments.ts:231-281` | États partiels en cas d'erreur au milieu | **Élevée** | M |
| BQ-23 | Alias/valeurs par défaut métier dispersés (rôle `'coach'` par défaut, `'Par cheque ou virement bancaire'`, durées) | `appointments.ts:14`, `company-invoices.ts:145` | Règles métier non centralisées | Faible | M |
| BQ-24 | Le package backend expose `express 4.18.2` en dépendance déclarée mais `express 5.2.1` figure côté frontend — **deux majors différents dans le même dépôt** | `package.json` ×2 | Confusion, deux comportements | Faible | S |
| BQ-25 | `export default router` + `export default protect` mélangés, conventions d'import `.js` explicites en TS ESM — cohérent mais fragile | `backend/src/**` | Lisibilité | Faible | XS |

---

## 5. Constats — Qualité du code frontend

| ID | Constat | Preuve | Impact | Sévérité | Effort |
|---|---|---|---|---|---|
| FQ-01 | **Composants monolithiques** : `admin` 1399 l., `dashboard` 1374 l., `appointments` 1178 l., `patient-form` 777 l., `payments` 654 l. — état, chargement, calculs métier, rendu et tables dans un seul fichier | `app/*/page.tsx`, `components/patient-form.tsx` | Complexité cyclomatique élevée, quasi non testable, revues impossibles | **Élevée** | XL |
| FQ-02 | **Monkey-patch du routeur Next.js** : `router.push` est remplacé dynamiquement pour bloquer la navigation | `app/payments/page.tsx:160-176` | Effet de bord global, API non publique, casse si deux composants le font, fuite de comportement entre pages | **Élevée** | S |
| FQ-03 | `window.prompt` / `window.confirm` utilisés au lieu des composants Dialog/AlertDialog du design system | `app/appointments/page.tsx:555` ; `app/admin/page.tsx:514` ; autres pages | UX incohérente, non internationalisable, non stylable, non testable | Moyenne | S |
| FQ-04 | `any` omniprésent (100+ occurrences dans `app/`), neutralisant `strict: true` | `app/page.tsx` (~70), `app/analytics/page.tsx`, etc. | Perte du typage sur les modèles métier critiques (patients, soldes, RDV) | **Élevée** | L |
| FQ-05 | **Absence de couche de données** : chaque page réimplémente fetch + état + transformation + cache ; pas de React Query/SWR ni de hooks dédiés | toutes les pages | Duplication massive, rechargements inutiles, incohérences | **Élevée** | L |
| FQ-06 | Duplication des interfaces de types d'une page à l'autre (Patient, Payment, Appointment redéclarés localement) | `app/payments/page.tsx`, `app/patients/page.tsx`, `app/appointments/page.tsx` | Dérives de contrat | Moyenne | M |
| FQ-07 | `apiRequest` **devine le type de données** par une cascade (`data.user || data.users || data.patients || … || data`) | `lib/api.ts:84` | Retourne la mauvaise entité dans certains cas limites, masque les erreurs de contrat | Moyenne | S |
| FQ-08 | `response.json()` appelé sans vérification du `Content-Type` : un HTML (502 proxy, page d'erreur) provoque une exception générique | `lib/api.ts:61` | Diagnostics impossibles en production | Moyenne | XS |
| FQ-09 | `resolveApiBaseUrl()` s'exécute **à l'import du module** et **lève** si `NEXT_PUBLIC_API_URL` est absent | `lib/api.ts:13-25` | Le build/rendu casse globalement pour une variable d'environnement manquante (pas de message actionnable) | Moyenne | S |
| FQ-10 | `Content-Type: application/json` envoyé sur les requêtes **GET** | `lib/api.ts:45-47` | Préflights CORS inutiles (perf), sémantique incorrecte | Faible | XS |
| FQ-11 | Gestion d'erreurs hétérogène : `console.error`, `setError`, toasts, `alert`, état local selon les écrans | pages + composants | Expérience utilisateur incohérente, erreurs silencieuses | Moyenne | M |
| FQ-12 | Aucun **Error Boundary** React ; une exception de rendu fait tomber la page entière | `app/layout.tsx`, pages | Crash total de l'interface | Moyenne | S |
| FQ-13 | Pages **inaccessibles** depuis la navigation : `/reports`, `/analytics`, `/patients/[id]/edit`, `/expenses/[id]` | `components/dashboard-nav.tsx` | Fonctionnalités livrées mais invisibles (dette fonctionnelle) | Moyenne | XS |
| FQ-14 | Onglet **« Évaluations »** absent de la fiche patient alors que `patientOutcomes` est chargé | `app/patients/[id]/page.tsx` | Fonctionnalité inaccessible | Moyenne | S |
| FQ-15 | Deux systèmes de toast coexistants (`components/ui/toast.tsx` + `sonner`) | `components/ui/` ; `app/layout.tsx:34` ; `lib/...` | Dette technique, incohérence visuelle | Faible | S |
| FQ-16 | `next.config.mjs` : **`typescript.ignoreBuildErrors: true`** | `next.config.mjs:10-12` | Un build « vert » peut contenir des erreurs de type | **Élevée** | XS |
| FQ-17 | `next.config.mjs` : `images.unoptimized: true` | `next.config.mjs:16-18` | Perte de performance/optimisation d'images | Faible | XS |
| FQ-18 | **ESLint non installé** (absent des `devDependencies`) alors que le script `lint: eslint .` existe → `npm run lint` échoue | `package.json` (scripts + devDependencies) | Aucun contrôle statique ; script trompeur | **Élevée** | XS |
| FQ-19 | Aucune configuration Prettier/EditorConfig → style non normé | racine du projet | Bruit dans les diffs | Faible | XS |
| FQ-20 | Composants UI shadcn générés mais inutilisés (dead code) | `components/ui/` (accordion, menubar, carousel…) | Maintenance inutile, poids du bundle potentiel | Faible | S |
| FQ-21 | Formulaires sans `react-hook-form` ni `zod` (pourtant en dépendances) : validation manuelle dispersée | `components/patient-form.tsx`, `appointment-form.tsx`, `payments/page.tsx` | Règles de validation dupliquées UI/API, risque de divergence | Moyenne | M |
| FQ-22 | Accessibilité non systématique : boutons-icônes sans `aria-label`, pas de vérification de focus/lecteurs d'écran | pages/composants | Non-conformité RGAA/WCAG, usage dégradé | Moyenne | M |
| FQ-23 | `metadata` générique (« Psychology Practice Manager ») : pas de `lang`/locale applicative, pas de titre par page visible | `app/layout.tsx:11-19` | SEO/UX mineurs | Faible | XS |
| FQ-24 | `console.error` laissés en production dans `lib/api.ts` et les pages | `lib/api.ts:64,89` ; pages | Fuite d'information vers la console, bruit | Faible | XS |

---

## 6. Constats — Configuration, exploitation et tests

| ID | Constat | Preuve | Impact | Sévérité | Effort |
|---|---|---|---|---|---|
| CFG-01 | **Aucun framework de test** (ni unitaire, ni intégration, ni E2E) | `package.json` (aucune dépendance de test) | Aucun filet de sécurité, régressions garanties | **Élevée** | XL |
| CFG-02 | **Aucune CI/CD** (pas de workflow GitHub Actions, pas de garde de branche) | absence de `.github/workflows/` | Qualité non vérifiée avant déploiement | **Élevée** | M |
| CFG-03 | Pas de vérification `typecheck` bloquante (le backend en a un script, le frontend non) | `package.json` | Erreurs de type livrées | Moyenne | XS |
| CFG-04 | Pas de `Dependabot`/Renovate, pas de contrôle de licence | — | Vulnérabilités qui s'accumulent (constat SEC-33→38) | Moyenne | XS |
| CFG-05 | `docker`/Procfile/`railway.json` absents du dépôt (déploiement non reproductible documenté) | racine | Déploiement manuel, dérive | Moyenne | M |
| CFG-06 | Pas de health check applicatif (DB incluse) : `/api/health` répond toujours OK même si la base est indisponible | `backend/src/index.ts:116-118` | Faux positifs d'orchestrateur | Moyenne | S |
| CFG-07 | Pas de limite/observation de performance (pas d'APM, pas de métriques) | — | Incidents non détectés | Faible | M |
| CFG-08 | `docs/documentation.md` **désynchronisée** (JWT en localStorage, `/auth/register`, `/dashboard` n'existent plus) | `docs/documentation.md:20-46` | Documentation trompeuse pour les mainteneurs | Moyenne | S |

---

## 7. Constats — Conformité « données de santé »

> Contexte : l'application traite des **données de santé** (motifs de consultation, comptes rendus, évaluations, suivis) — catégorie sensible au sens du RGPD (art. 9) et de la loi algérienne 18-07 sur la protection des données personnelles.

| ID | Constat | Impact | Sévérité | Effort |
|---|---|---|---|---|
| COMP-01 | Aucune trace de **chiffrement au repos** (colonne/fichier) ni de chiffrement applicatif des champs sensibles | Fuite complète en cas d'accès au disque/backup | **Élevée** | L |
| COMP-02 | **Suppression physique** des données (`DELETE`) sans politique de rétention ni corbeille → perte irréversible et non conforme à l'obligation de conservation des dossiers patients | Non-conformité légale, perte de preuve | **Élevée** | M |
| COMP-03 | Aucun mécanisme de **consentement**, d'**export** (droit d'accès) ni d'**effacement** encadré (droit à l'oubli) | Non-conformité RGPD/18-07 | **Élevée** | L |
| COMP-04 | Journal d'audit **non fiable** (erreurs avalées, `changes` en clair, pas de purge, pas de scellement) | Non-répudiation inopérante | **Élevée** | M |
| COMP-05 | Les données d'audit **dupliquent les données de santé** (`jsonb_build_object('old', v_old, 'new', v_new)`) dans une table sans contrôle d'accès autre que « admin » | Prolifération de données sensibles | Moyenne | M |
| COMP-06 | `@vercel/analytics` envoie des données de navigation à un tiers sans mention ni consentement | Conformité, transfert de données | Moyenne | S |
| COMP-07 | Authentification dépendante des cookies tiers (`SameSite=None`) en production → peut être bloquée par les navigateurs | Indisponibilité, contournement de sécurité | Moyenne | M |
| COMP-08 | Aucune minimisation : l'API renvoie des objets complets (ex. `changes.old/new`, listes non paginées) | Sur-exposition des données | Moyenne | M |

---

## 8. Plan de remédiation priorisé

### Sprint 0 — « Stop the bleeding » (< 1 jour, gains immédiats)

| Action | Constats | Effort |
|---|---|---|
| `npm audit fix` (front + back) et monter `next` / `concurrently` / `proxy-addr` | SEC-33→36 | XS |
| Supprimer le mot de passe par défaut : génération aléatoire + changement forcé à la 1ʳᵉ connexion | SEC-01, SEC-02 | S |
| Ajouter `app.set('trust proxy', 1)` et vérifier le rate limiting | SEC-05 | XS |
| Activer `strict: true` côté backend (le champ `type: module` est déjà présent) et installer/configurer ESLint (`next lint`) | FQ-18, BQ-01 | S |
| Retirer `typescript.ignoreBuildErrors` | FQ-16 | XS |
| Ajouter une garde `NODE_ENV !== 'production'` au script `seed` | BQ-14 | XS |
| Valider le rôle dans `POST/PUT /users` (liste blanche) | SEC-08, SEC-20 | XS |
| Ajouter `.env.example` | SEC-11 | XS |
| Corriger `activity_logs.user_pseudo` dans `ensureSchema` | SEC-31 | XS |
| Créer `.github/workflows/ci.yml` (typecheck + lint + audit) | CFG-02 | S |
| Ajouter les en-têtes de sécurité dans `next.config.mjs` | SEC-13 | S |

### Sprint 1 — Sécurité et robustesse (1-2 semaines)

- Protection CSRF (double-submit cookie ou en-tête personnalisé) — SEC-04.
- Revoir le modèle d'autorisation : scoper les lectures (au minimum vérifier le rôle pour les dossiers cliniques) — SEC-10.
- Rendre les transactions réellement atomiques (client dédié `getClient()` + `BEGIN/COMMIT` sur la même connexion) — SEC-21.
- Corriger la désynchronisation des packs au `PUT /appointments` — SEC-25.
- Ajouter la validation `endTime > startTime` et les listes blanches de champs — SEC-22, SEC-20.
- Limiter la longueur des champs texte — SEC-23.
- Politique de mot de passe (≥ 12 car., complexité, historique) + verrouillage par compte — SEC-03, SEC-06.
- Fiabiliser l'audit (ne pas avaler les erreurs, alerter) — SEC-29, SEC-30.
- Logger structuré + réduction des logs sensibles — SEC-18, BQ-06.

### Sprint 2 — Architecture et qualité (2-6 semaines)

- Migrations versionnées (node-pg-migrate, Prisma migrate, ou SQL versionné) — BQ-09.
- Découper les monolithes frontend (services, hooks, sous-composants) ; introduire React Query — FQ-01, FQ-05.
- Supprimer le monkey-patch du routeur ; utiliser la garde de navigation officielle — FQ-02.
- Créer une couche de types partagée (ou un package `shared/`) — FQ-06.
- Refondre `patients.ts` (`baseSelect`) — BQ-07.
- Unifier la logique packs : **une seule** source de vérité (trigger SQL) — BQ-08.
- Framework de test (Vitest + Supertest + Playwright) et couverture des règles critiques (solde, packs, conflits) — CFG-01.
- Conformité données de santé (rétention, chiffrement, consentement, export) — COMP-01→08.

---

## 9. Récapitulatif et mapping OWASP

### 9.1 Répartition des constats

| Catégorie | Critique | Élevée | Moyenne | Faible |
|---|---|---|---|---|
| Sécurité (SEC) | 3 | 13 | 15 | 7 |
| Qualité backend (BQ) | 1* | 9 | 10 | 5 |
| Qualité frontend (FQ) | 0 | 6 | 11 | 7 |
| Config / tests (CFG) | 0 | 2 | 5 | 1 |
| Conformité (COMP) | 0 | 4 | 4 | 0 |
| **Total** | **3 (+1*)** | **34** | **45** | **20** |

\* `BQ-14` (`seed` efface toute la base) est classé **Critique mais conditionnel** (déclenchement requis) et n'est donc pas compté dans le total « Critique » dur.

### 9.2 Mapping OWASP Top 10 (2021)

| Catégorie OWASP | Constats associés |
|---|---|
| A01 — Broken Access Control | SEC-04, SEC-08, SEC-09, SEC-10, SEC-24 |
| A02 — Cryptographic Failures | SEC-12, COMP-01 |
| A03 — Injection | (aucun constat SQL/XSS) · SEC-33 (injection de commande, dev) |
| A04 — Insecure Design | SEC-21, SEC-22, SEC-23, SEC-25, SEC-28, BQ-22 |
| A05 — Security Misconfiguration | SEC-11, SEC-13, SEC-15, SEC-16, CFG-06 |
| A06 — Vulnerable Components | SEC-33→38 |
| A07 — Identification & Auth Failures | SEC-01, SEC-02, SEC-03, SEC-06, SEC-07 |
| A08 — Software & Data Integrity | SEC-07, SEC-25, BQ-08 |
| A09 — Logging & Monitoring Failures | SEC-18, SEC-29, SEC-30, SEC-31, SEC-32, CFG-07 |
| A10 — SSRF | SEC-35 (Next.js Image Optimization) |

### 9.3 Tableau récapitulatif complet

| ID | Titre | Sévérité | Effort |
|---|---|---|---|
| SEC-01 | Mot de passe par défaut codé en dur et affiché | Critique | S |
| SEC-33 | `concurrently`/`shell-quote` — injection de commande | Critique | XS |
| SEC-34 | `proxy-addr` — usurpation d'IP | Critique | XS |
| BQ-14 | `seed` efface toute la base sans garde | Critique (conditionnel) | XS |
| SEC-02 | Mot de passe admin codé en dur | Élevée | XS |
| SEC-03 | Politique de mot de passe faible | Élevée | S |
| SEC-04 | CSRF (cookie `SameSite=None`, pas de jeton) | Élevée | M |
| SEC-05 | `trust proxy` absent | Élevée | XS |
| SEC-08 | Rôle non validé à la création d'utilisateur | Élevée | XS |
| SEC-10 | IDOR généralisé | Élevée | M |
| SEC-12 | Secrets en clair / historique Git non vérifié | Élevée | S |
| SEC-20 | Absence de validation des entrées (users) | Élevée | XS |
| SEC-21 | Transactions non atomiques | Élevée | S |
| SEC-25 | Désynchronisation packs au PUT RDV | Élevée | S |
| SEC-29 | Erreurs d'audit avalées | Élevée | S |
| SEC-31 | Colonne d'audit manquante au schéma | Élevée | XS |
| SEC-35 | `next` vulnérable (SSRF, cache poisoning) | Élevée | XS |
| BQ-01 | Backend `strict: false` | Élevée | M |
| BQ-02 | `any` généralisé | Élevée | L |
| BQ-03 | Duplication CRUD | Élevée | L |
| BQ-05 | Validation hétérogène | Élevée | M |
| BQ-07 | Requête `patients` monstrueuse | Élevée | L |
| BQ-08 | Logique métier code + triggers | Élevée | M |
| BQ-09 | Absence de migrations | Élevée | L |
| BQ-12 | Pool PostgreSQL sous-dimensionné | Élevée | S |
| BQ-22 | Absence de transactions multi-écritures | Élevée | M |
| FQ-01 | Composants monolithiques | Élevée | XL |
| FQ-02 | Monkey-patch du routeur Next | Élevée | S |
| FQ-04 | `any` omniprésent côté front | Élevée | L |
| FQ-05 | Absence de couche de données | Élevée | L |
| FQ-16 | `ignoreBuildErrors` | Élevée | XS |
| FQ-18 | ESLint absent / `lint` cassé | Élevée | XS |
| CFG-01 | Aucun test | Élevée | XL |
| CFG-02 | Aucune CI | Élevée | M |
| COMP-01 | Pas de chiffrement au repos | Élevée | L |
| COMP-02 | Suppression physique sans rétention | Élevée | M |
| COMP-03 | Pas de consentement/export/effacement | Élevée | L |
| COMP-04 | Audit non fiable | Élevée | M |
| SEC-06 | Pas de verrouillage par compte | Moyenne | S |
| SEC-07 | Payload JWT non validé | Moyenne | S |
| SEC-09 | Autorisation non centralisée | Moyenne | M |
| SEC-11 | `.env.example` absent | Moyenne | XS |
| SEC-13 | En-têtes de sécurité front absents | Moyenne | S |
| SEC-18 | Logs de données sensibles | Moyenne | S |
| SEC-22 | Pas de validation temporelle | Moyenne | XS |
| SEC-23 | Champs texte non bornés | Moyenne | S |
| SEC-24 | Suppression de RDV partagés | Moyenne | S |
| SEC-26 | Contrôle de chevauchement contourné au PUT | Moyenne | XS |
| SEC-28 | Recherche `ILIKE` non indexée | Moyenne | S |
| SEC-30 | Trigger d'audit en `RAISE WARNING` | Moyenne | S |
| SEC-32 | Journal sans purge | Moyenne | M |
| SEC-36 | `source-map-js` DoS | Moyenne | XS |
| SEC-37 | Dépendances inutilisées | Moyenne | S |
| BQ-04 | Contrat d'API incohérent | Moyenne | M |
| BQ-06 | Pas de logger structuré | Moyenne | M |
| BQ-10 | DDL destructif dans `ensureSchema` | Moyenne | S |
| BQ-11 | `db:init` cassé | Moyenne | XS |
| BQ-13 | `connectDB` sans retry | Moyenne | S |
| BQ-15 | Statut `no-show` inexistant | Moyenne | XS |
| BQ-16 | « no-show » mal défini | Moyenne | S |
| BQ-19 | Accents corrompus | Moyenne | XS |
| BQ-20 | Double source de vérité praticien | Moyenne | M |
| BQ-21 | Plafonds/LIMIT incohérents | Moyenne | M |
| FQ-03 | `window.prompt/confirm` | Moyenne | S |
| FQ-06 | Types dupliqués | Moyenne | M |
| FQ-07 | Détection de type fragile dans `apiRequest` | Moyenne | S |
| FQ-08 | `response.json()` non protégé | Moyenne | XS |
| FQ-09 | `resolveApiBaseUrl` lève à l'import | Moyenne | S |
| FQ-11 | Gestion d'erreurs hétérogène | Moyenne | M |
| FQ-12 | Pas d'Error Boundary | Moyenne | S |
| FQ-13 | Pages inaccessibles | Moyenne | XS |
| FQ-14 | Onglet Évaluations absent | Moyenne | S |
| FQ-21 | Validation UI/API divergente | Moyenne | M |
| FQ-22 | Accessibilité non systématique | Moyenne | M |
| CFG-03 | `typecheck` non bloquant | Moyenne | XS |
| CFG-04 | Pas de gestion de dépendances | Moyenne | XS |
| CFG-05 | Déploiement non reproductible | Moyenne | M |
| CFG-06 | Health check non probant | Moyenne | S |
| CFG-08 | Documentation obsolète | Moyenne | S |
| COMP-05 | Données sensibles dupliquées dans l'audit | Moyenne | M |
| COMP-06 | Analytics tiers sans consentement | Moyenne | S |
| COMP-07 | Dépendance aux cookies tiers | Moyenne | M |
| COMP-08 | Absence de minimisation | Moyenne | M |
| SEC-14 | Chemins locaux dans `opencode.json` | Faible | XS |
| SEC-15 | IP codées en dur | Faible | XS |
| SEC-16 | `crossOriginResourcePolicy` assoupli | Faible | XS |
| SEC-17 | CORS sans `Origin` accepté | Faible | XS |
| SEC-19 | Artefacts `v0.app` | Faible | XS |
| SEC-27 | Erreurs SQL 500 non traduites | Faible | XS |
| SEC-38 | Double version `bcryptjs` | Faible | XS |
| BQ-17 | Message d'erreur fautif (EN) | Faible | XS |
| BQ-18 | Code mort | Faible | XS |
| BQ-23 | Constantes métier dispersées | Faible | M |
| BQ-24 | Deux majors Express | Faible | S |
| BQ-25 | Conventions d'export hétérogènes | Faible | XS |
| FQ-10 | `Content-Type` sur les GET | Faible | XS |
| FQ-15 | Deux systèmes de toast | Faible | S |
| FQ-17 | Images non optimisées | Faible | XS |
| FQ-19 | Pas de Prettier/EditorConfig | Faible | XS |
| FQ-20 | Composants UI morts | Faible | S |
| FQ-23 | Métadonnées génériques | Faible | XS |
| FQ-24 | `console.error` en production | Faible | XS |
| CFG-07 | Pas d'APM/métriques | Faible | M |

### 9.4 Points positifs

| ID | Bonne pratique |
|---|---|
| POS-01 | JWT en cookie `httpOnly` (pas de `localStorage`) |
| POS-02 | Révocation de tokens via `users.token_version` |
| POS-03 | Refus de démarrage si `JWT_SECRET` < 32 caractères |
| POS-04 | `helmet`, `x-powered-by` désactivé, `express.json({limit})`, CORS *allowlist* |
| POS-05 | Rate limiting sur l'authentification |
| POS-06 | Aucune fuite de `error.message` |
| POS-07 | SQL paramétré + tri en liste blanche |
| POS-08 | bcrypt pour les mots de passe |
| POS-09 | Contraintes DB (CHECK, UNIQUE, FK, index) et triggers d'audit |
| POS-10 | Contexte utilisateur PostgreSQL pour l'audit + nettoyage après réponse |
| POS-11 | Seeds et scripts d'administration séparés |
| POS-12 | Soft delete des services |

---

## 10. Annexes

### 10.1 Commandes de vérification utilisées

```bash
npm audit --json                     # frontend : 5 vulnérabilités (2 high, 3 critical)
npm --prefix backend audit --json    # backend  : 1 vulnérabilité (critical)
```

Recherches `ripgrep` :

```
dangerouslySetInnerHTML|innerHTML|eval\(|new Function\(|localStorage|sessionStorage|document\.write
process\.env\.[A-Z_]+            (backend)
console\.(log|error|warn|debug)  (backend)
: any|as any|@ts-ignore          (backend)
\$\{req\.                       (backend — recherche d'interpolation SQL)
123456789|Admin123|password123
```

### 10.2 Checklist de revue de code (à intégrer en PR)

- [ ] Aucun secret ni identifiant par défaut dans le code
- [ ] Entrée validée côté API (schéma, liste blanche de champs, bornes, dates)
- [ ] Autorisation vérifiée (rôle **et** périmètre de la ressource)
- [ ] Requêtes SQL paramétrées, tri en liste blanche
- [ ] Transactions pour toute opération multi-écritures
- [ ] Erreurs journalisées (logger structuré) et **non avalées**
- [ ] Pas de `any` nouveau ; `strict` respecté
- [ ] Composant < 300 lignes ; logique métier hors du rendu
- [ ] Tests ajoutés/mis à jour ; `typecheck` + `lint` + `audit` verts
- [ ] Aucune donnée personnelle dans les logs
- [ ] Nouvelle dépendance justifiée, à jour et sans vulnérabilité

### 10.3 Fichiers examinés

`backend/src/**` (index, middleware/auth, db/index, db/schema, db/patient-lists, modules/{auth,users,patients,services,appointments,session-notes,payments,patient-packs,patient-outcomes,waiting-list,expenses,companies,company-invoices,settings,activity-logs}, utils/activity-logger, scripts/{seed,create-admin}) · `app/**` · `components/**` · `lib/**` · `hooks/**` · `sql/**` · `package.json` ×2 · `tsconfig.json` ×2 · `next.config.mjs` · `.gitignore` · `opencode.json` · `docs/documentation.md`

---

*Fin du rapport d'audit. Les constats marqués « à confirmer » nécessitent une vérification en base de données ou un accès à l'historique Git.*
