# 🚀 Guide de Démarrage Rapide

## Étape 1: Démarrer MongoDB

Assurez-vous que MongoDB est en cours d'exécution. Si vous n'avez pas MongoDB installé, vous pouvez utiliser Docker:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Étape 2: Configurer le Backend

```bash
# Allez dans le dossier backend
cd backend

# Installez les dépendances
npm install

# Créez un compte admin
npm run create-admin

# Démarrez le serveur backend
npm run dev
```

Le serveur devrait s'exécuter sur `http://localhost:5000`

Vous verrez:
```
✅ Admin account created successfully!

📧 Email: admin@gmail.com
🔐 Password: Admin@123
👤 Role: Admin
```

## Étape 3: Configurer le Frontend

1. Cliquez sur le bouton **Settings** (engrenage) en haut à droite
2. Allez dans l'onglet **Vars**
3. Ajoutez une nouvelle variable:
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `http://localhost:5000/api`
4. Enregistrez et actualisez la page d'aperçu

## Étape 4: Connectez-vous

Utilisez les identifiants suivants (après `npm run create-admin`):

```
📧 Email: admin@gmail.com
🔐 Password: Admin@123
```

## Mode Démo (sans base de données)

Si vous voulez juste tester l'interface sans MongoDB ni backend:

1. Créez un fichier `.env.local` à la racine
2. Ajoutez:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

3. Redémarrez le frontend (`npm run dev`)

Comptes de démo disponibles:
- Email: `test@demo.local` / Password: `demo123`
- Email: `admin@demo.local` / Password: `demo123`
- Email: `reception@demo.local` / Password: `demo123`

## Comptes Disponibles

Après avoir exécuté `npm run seed`, vous aurez accès à:

### Admin
- Email: `admin@example.com`
- Password: `admin123`
- Rôle: admin

### Praticien (compte test)
- Email: `test@gmail.com`
- Password: `1234`
- Rôle: practitioner

### Réceptionniste
- Email: `receptionist@example.com`
- Password: `password123`
- Rôle: receptionist

## Dépannage

### "NetworkError when attempting to fetch"
- Assurez-vous que le backend est en cours d'exécution (`npm run dev`)
- Vérifiez que `NEXT_PUBLIC_API_URL` est défini dans les variables d'environnement
- Vérifiez que MongoDB est en cours d'exécution

### "Invalid email or password"
- Créez un nouveau compte avec `npm run create-admin`
- Ou exécutez `npm run seed` pour remplir la base de données avec des données de test

### MongoDB refuse de se connecter
- Assurez-vous que MongoDB est en cours d'exécution
- Vérifiez que la variable `MONGODB_URI` est correcte ou utilisez le port par défaut 27017

## Accès à l'Application

Une fois connecté, vous avez accès à:
- 📊 Dashboard avec KPIs
- 👥 Gestion des clients
- 📅 Calendrier des rendez-vous
- 💼 Gestion des services
- 📝 Notes de session
- 📄 Facturation et paiements
- 📈 Analyse et rapports
