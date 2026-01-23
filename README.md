# 📊 FX Daily Newsletter Generator

Générateur automatique de newsletters FX personnelles depuis ING Think, avec résumés par devise en français.

## ✨ Fonctionnalités

- 🔍 **Détection automatique** : Récupère le dernier article FX Daily d'ING Think
- 💱 **Analyse par devise** : Résumés structurés pour USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF, CNY
- 🇫🇷 **Traduction française** : Tout le contenu est traduit en français via l'IA
- 📧 **Envoi automatique** : Notification email dès qu'un nouvel article est publié
- 🤖 **Résumés IA** : Utilise Google Gemini pour des analyses intelligentes

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditez .env avec vos clés API et configuration
```

## 📖 Commandes

### Récupérer le dernier article ING Think FX

```bash
node index.js ing                    # Aperçu local uniquement
node index.js ing --send             # Aperçu + envoi par email
```

### 🆕 Surveillance automatique (détection de nouveaux articles)

```bash
# Lancer la surveillance continue (vérifie toutes les 30 min)
node index.js watch

# Personnaliser l'intervalle (ex: toutes les 15 min)
node index.js watch --interval=15

# Vérification unique (pour cron/tâches planifiées)
node index.js check
```

### Traiter une URL spécifique

```bash
node index.js https://think.ing.com/articles/...
node index.js https://think.ing.com/articles/... --send
```

## ⚙️ Configuration (.env)

```env
# Google Gemini API (pour résumés IA en français)
# Obtenez votre clé: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=votre_clé_gemini

# Configuration SMTP (pour l'envoi d'emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application

# Adresses email
EMAIL_FROM="FX Newsletter <votre_email@gmail.com>"
RECIPIENT_EMAIL=destinataire@email.com
```

### 🔐 Configuration Gmail

Pour utiliser Gmail comme serveur SMTP :

1. Activez la [validation en 2 étapes](https://myaccount.google.com/security)
2. Créez un [mot de passe d'application](https://myaccount.google.com/apppasswords)
3. Utilisez ce mot de passe dans `SMTP_PASSWORD`

## 🤖 Déploiement Automatique (GitHub Actions)

Ce projet est configuré pour vérifier automatiquement les nouveaux articles toutes les 15 minutes (Lun-Ven, à partir de 9h) via GitHub Actions.

### Configuration sur GitHub :

1. **Créez un dépôt sur GitHub** et poussez votre code.
2. Allez dans **Settings > Secrets and variables > Actions**.
3. Ajoutez les **New repository secrets** suivants :
   - `GEMINI_API_KEY` : Votre clé Google Gemini.
   - `RESEND_API_KEY` : Votre clé Resend API.
   - `RECIPIENT_EMAIL` : Votre adresse email de réception.
4. Activez les permissions d'écriture pour les Actions :
   - **Settings > Actions > General**.
   - Dans "Workflow permissions", cochez **"Read and write permissions"** (nécessaire pour sauvegarder l'état).

Le script s'exécutera tout seul selon le planning défini dans `.github/workflows/check-fx.yml`.

## 📁 Structure du projet

```
forex_newsletter/
├── index.js                    # Point d'entrée principal
├── src/
│   ├── scraper.js              # Extraction de contenu web
│   ├── summarizer.js           # Résumé IA par devise + traduction
│   ├── emailer.js              # Template email et envoi
│   ├── watcher.js              # Surveillance des nouveaux articles
│   └── sources/
│       └── ing-think.js        # Scraper spécifique ING Think
├── output/                     # Newsletters HTML générées
├── .watcher-state.json         # État du watcher (dernier article traité)
├── .env                        # Configuration (à créer)
└── .env.example                # Exemple de configuration
```

## 🎨 Format de la newsletter

La newsletter générée inclut :

| Section                   | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| 📊 **Titre**              | Titre traduit en français                                       |
| 📝 **Introduction**       | Contexte général du marché FX                                   |
| 💱 **Analyse par devise** | Section pour chaque devise mentionnée avec sentiment (📈/📉/➡️) |
| 💡 **Point clé**          | Le takeaway principal pour un trader                            |
| 📈 **Perspectives**       | Conclusion et outlook                                           |

### Devises suivies

| Code | Nom                  |
| ---- | -------------------- |
| USD  | Dollar américain     |
| EUR  | Euro                 |
| GBP  | Livre sterling       |
| JPY  | Yen japonais         |
| AUD  | Dollar australien    |
| NZD  | Dollar néo-zélandais |
| CAD  | Dollar canadien      |
| CHF  | Franc suisse         |
| CNY  | Yuan chinois         |

## 🔧 Dépannage

### "GEMINI_API_KEY not found"

Ajoutez votre clé API Gemini dans le fichier `.env`. Sans cette clé, le résumé sera basique (extraction simple sans traduction).

### "SMTP configuration missing"

Vérifiez que `SMTP_HOST`, `SMTP_USER`, et `SMTP_PASSWORD` sont définis dans `.env`.

### L'email n'arrive pas

- Vérifiez vos spams
- Pour Gmail, utilisez un mot de passe d'application (pas votre mot de passe habituel)
- Vérifiez que le port 587 n'est pas bloqué

## 📝 License

ISC
