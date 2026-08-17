# UstensINT — Cook'It 🍳

> **Plateforme de gestion et de réservation de matériel culinaire & stock du club Cook'It** (Télécom SudParis).

[![Docker Compose](https://img.shields.io/badge/Docker_Compose-Ready-blue.svg)](compose.yaml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-336791.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Fonctionnalités Principales

### 🎓 Espace Étudiant
- **Catalogue interactif** : Consultation du matériel avec photos, étiquettes, états, descriptions et montants de caution.
- **Panier & Réservation dynamique** : Sélection multiple d'ustensiles, choix des dates avec calcul de durée et calendrier en temps réel.
- **Suivi des emprunts** : Historique et statuts des réservations (en attente, en cours, rendue, annulée).
- **Conformité RGPD** : Export au format JSON des données personnelles et anonymisation/suppression de compte.
- **Bilingue FR / EN** : Sélecteur de langue fluide intégré.

### 🧑‍🍳 Espace Mandat
- **Gestion des prêts** : Validation, confirmation des retours, signalement et refus motivé.
- **Édition complète des prêts** : Ajustement des dates, du téléphone, des montants et modes de caution.
- **Notes internes privées** : Ajout de notes d'équipe confidentielles visibles uniquement par le mandat et les administrateurs.
- **Inventaire Matériel & Catégories** : CRUD complet des ustensiles (prix d'achat, caution, emplacement, upload photos).
- **Stock & Nourriture Club** : Gestion des ingrédients, consommables, dates limites (DLC/DDM) et emplacements de stockage du club.

### 🛡️ Espace Administration
- **Panneau de configuration catégorisé** :
  - *Règles & Réservations* (durées max, auto-approbation des prêts, champs de formulaire obligatoires/facultatifs).
  - *Matériel & Caution* (types de caution, états du catalogue, sélection des statuts bloquant l'emprunt).
  - *Accès & Inscription* (restriction aux domaines `@telecom-sudparis.eu`).
  - *Notifications & Discord* (Webhook pour alertes en temps réel).
- **Gestion des Utilisateurs** : Attribution des rôles (*Étudiant*, *Mandat*, *Administrateur*) et blocage de comptes.
- **Journal d'Audit traçable (RGPD)** : Historique horodaté des actions avec anonymisation des adresses IP.

---

## 🚀 Démarrage Rapide

### Prérequis
- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/)

### Lancement en un clic
```bash
# 1. Cloner le dépôt
git clone https://github.com/Flotealy/UstensINT.git
cd UstensINT

# 2. Configurer les variables d'environnement
cp .env.example .env

# 3. Démarrer l'ensemble des conteneurs
docker compose up --build -d
```

L'application est immédiatement accessible :
- **Application Web** : [http://localhost](http://localhost)
- **API Backend** : [http://localhost/api](http://localhost/api)
- **Swagger / OpenAPI** : [http://localhost/api/docs](http://localhost/api/docs)

### Compte Administrateur Initial
- **Email** : `admin@telecom-sudparis.eu`
- **Rôle** : `admin`

---

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                    Navigateur / Mobile                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ :80
┌──────────────────────────────▼──────────────────────────────┐
│                    Proxy Inverse Nginx                      │
└───┬─────────────────────────────────────────────────────┬───┘
    │ /api/*                                              │ /*
┌───▼──────────────────────────┐     ┌────────────────────▼───┐
│     FastAPI 0.115 (uv)       │     │     Next.js 16 (React) │
│     Python 3.12 + Pydantic   │     │     Turbopack + CSS    │
└───┬──────────────────────────┘     └────────────────────────┘
    │ SQLAlchemy 2.0 Async
┌───▼──────────────────────────┐
│      PostgreSQL 16 (db)      │
└──────────────────────────────┘
```

---

## 📖 Documentation Complète

Pour plus de détails sur l'architecture, la matrice des droits et les schémas de base de données, consultez [`DOCUMENTATION.md`](DOCUMENTATION.md).

---

## 📄 Licence

Distribué sous licence MIT. Développé pour le club **Cook'It** — Télécom SudParis.