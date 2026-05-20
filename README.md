# World Cup 2026 — App de Pronostics

Application web de pronostics entre amis pour la Coupe du Monde FIFA 2026. Auto-hébergée sur un serveur local (LAN), sans déploiement cloud.

## Prérequis

- **Node.js 18+**
- Un projet **Firebase** avec la Realtime Database activée
- Accès au réseau local (Wi-Fi) pour les autres joueurs

## Installation

### 1. Cloner / récupérer le projet

```bash
cd worldcup2026
```

### 2. Configurer Firebase (client)

```bash
cp client/.env.example client/.env
```

Remplir `client/.env` avec les valeurs Firebase du projet (disponibles dans la console Firebase → Paramètres du projet → Apps web) :

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=https://VOTRE-PROJET-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Configurer Firebase (serveur)

```bash
cp server/.env.example server/.env
```

Remplir `server/.env` avec les identifiants du **compte de service** Firebase Admin (Firebase Console → Paramètres → Comptes de service → Générer une nouvelle clé privée) :

```
ADMIN_PASSWORD=admin2026
FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@votre-projet.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://votre-projet-default-rtdb.firebaseio.com
PORT=3001
```

### 4. Installer les dépendances

```bash
# Client
cd client && npm install

# Serveur
cd ../server && npm install
```

## Lancer en développement

Ouvrir **deux terminaux** :

```bash
# Terminal 1 — serveur Express
cd server
node index.js

# Terminal 2 — client Vite (hot-reload)
cd client
npm run dev
```

L'app sera disponible sur `http://localhost:5173`.

## Build production

```bash
cd client
npm run build
```

Puis lancer uniquement le serveur :

```bash
cd server
NODE_ENV=production node index.js
```

Express servira automatiquement les fichiers buildés depuis `client/dist`.

## Accès réseau local (LAN)

Le serveur écoute sur `0.0.0.0` — il est accessible depuis n'importe quelle machine du réseau local.

Trouver l'adresse IP locale de la machine hôte :
```bash
# Windows
ipconfig

# Linux/Mac
ip addr show
```

Les autres joueurs accèdent à : `http://192.168.X.X:3001`

## Règles Firebase Realtime Database

Configurer les règles dans la console Firebase :

```json
{
  "rules": {
    "players": { ".read": true, ".write": true },
    "bets": { ".read": true, ".write": true },
    "matches": { ".read": true, ".write": false },
    "settings": { ".read": false, ".write": false }
  }
}
```

## Fonctionnalités

- **Connexion** : pseudo + avatar emoji, sans email ni mot de passe
- **Calendrier** : 104 matchs de la Coupe du Monde 2026 (groupes A–L + phases éliminatoires)
- **Paris** : 3 issues en phase de groupes (1/N/2), 2 en phases éliminatoires (pas de nul)
- **Classement** : points temps réel, détail par phase, classements des groupes avec critères FIFA
- **Admin** : saisie des scores via panneau protégé par mot de passe (vérification côté serveur)

## Barème des points

| Phase | Points |
|-------|--------|
| Phase de groupes | 1 |
| 32e de finale | 2 |
| 16e de finale | 3 |
| Quarts de finale | 4 |
| Demi-finales | 5 |
| 3e place | 3 |
| Finale | 6 |
