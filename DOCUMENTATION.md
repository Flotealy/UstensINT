# UstensINT — Documentation Projet (Cook'It)

> **Plateforme de prêt de matériel de cuisine et gestion de stock pour le club Cook'It** (Télécom SudParis).
> Licence MIT — © 2026 Cook'It & Flotealy

---

## 1. Présentation

**UstensINT** est une application web bilingue (FR/EN) et responsive conçue sur-mesure pour le club de cuisine **Cook'It** de Télécom SudParis. Elle permet :
1. Aux **Étudiants** de consulter le catalogue de matériel culinaire, vérifier la disponibilité en temps réel, composer un panier et réserver du matériel.
2. Aux membres du **Mandat** de valider les demandes, modifier les dates et cautions des prêts, ajouter des notes internes privées, gérer le matériel/catégories, et administrer le **stock de nourriture et consommables** du club.
3. Aux **Administrateurs** de gérer les utilisateurs et leurs rôles, suivre le **journal d'audit complet (RGPD)**, et configurer finement l'ensemble des règles de la plateforme depuis un panneau d'administration catégorisé.

---

## 2. Stack Technique

| Couche | Technologie | Description |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack) | React 19, TypeScript, Vanilla CSS design system |
| **Backend / API** | FastAPI (Python 3.12) | SQLAlchemy 2.0 Async, Pydantic v2 |
| **Base de données** | PostgreSQL 16 | Schéma relationnel avec contraintes d'intégrité et clés étrangères |
| **Authentification** | JWT Bearer (7 jours) | Déduction automatique du nom, restriction par domaine email |
| **Reverse Proxy** | Nginx Alpine | Routage `/api` vers FastAPI et `/*` vers Next.js |
| **Gestionnaire Python** | Astral `uv` | Compilation et installation ultra-rapide des dépendances |
| **Conteneurisation** | Docker Compose | 4 conteneurs isolés : `proxy`, `frontend`, `backend`, `db` |
| **Internationalisation** | i18n FR / EN | Bascule fluide sans rechargement, sélecteur segmenté |
| **Conformité RGPD** | Respect de la vie privée | Anonymisation IP, export de données JSON, suppression de compte |

---

## 3. Architecture des Conteneurs (`compose.yaml`)

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Web / Mobile)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ :80 / :443
┌──────────────────────────────▼──────────────────────────────┐
│                     Nginx (proxy)                           │
└───┬─────────────────────────────────────────────────────┬───┘
    │ /api/*                                              │ /*
┌───▼──────────────────────────┐     ┌────────────────────▼───┐
│       FastAPI (backend)      │     │    Next.js (frontend)  │
└───┬──────────────────────────┘     └────────────────────────┘
    │ SQLAlchemy Async
┌───▼──────────────────────────┐
│      PostgreSQL 16 (db)      │
└──────────────────────────────┘
```

---

## 4. Modèle de Données Relationnel

### 4.1 `equipment` (Matériel)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `name` | VARCHAR | Nom de l'ustensile / appareil (ex: "Appareil à raclette 8 pers.") |
| `label` | VARCHAR | Numéro d'étiquette unique collé sur le matériel (ex: "COOK-RAC-001") |
| `category_id` | FK → `categories` | Catégorie associée |
| `location` | VARCHAR | Emplacement de stockage (local Cook'It, placard BDE...) |
| `purchase_cost`| DECIMAL | Coût d'achat |
| `deposit_amount`| DECIMAL | Montant de caution unitaire demandé |
| `status` | VARCHAR | État ("Neuf", "Bon état", "Usé", "En réparation", "Hors service") |
| `photo_url` | VARCHAR | URL externe d'illustration |
| `photo_upload` | VARCHAR | Chemin du fichier image téléversé |
| `comments` | TEXT | Précautions d'usage ou accessoires fournis |
| `is_archived` | BOOLEAN | Archivage doux |
| `archive_comment`| TEXT | Motif d'archivage (cassé, perdu, donné...) |
| `created_at` | TIMESTAMP | Horodatage de création |

### 4.2 `categories` (Catégories)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `name` | VARCHAR | Nom unique (ex: "Cuisson", "Pâtisserie", "Électroménager") |
| `description` | TEXT | Description des objets couverts |

### 4.3 `users` (Utilisateurs)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `email` | VARCHAR | Adresse email (ex: `prenom.nom@telecom-sudparis.eu`) |
| `display_name`| VARCHAR | Déduit automatiquement (`prenom.nom` $\rightarrow$ `Prénom Nom`) |
| `role` | VARCHAR | Rôle : `user` (Étudiant), `moderator` (Mandat), `admin` (Admin) |
| `is_blocked` | BOOLEAN | Indicateur de compte bloqué |
| `created_at` | TIMESTAMP | Horodatage d'inscription |

### 4.4 `reservations` (Emprunts)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `user_id` | FK → `users` | Emprunteur |
| `status` | VARCHAR | Statut : `active` (en attente), `approved` (en cours), `returned` (rendue), `cancelled` (annulée) |
| `start_date` | DATE | Date de début du prêt |
| `end_date` | DATE | Date de restitution prévue |
| `total_deposit`| DECIMAL | Somme des cautions du panier |
| `deposit_type` | VARCHAR | Mode de remise (Liquide, Virement, Chèque...) |
| `phone` | VARCHAR | Numéro de contact |
| `comments` | TEXT | Commentaire public de l'étudiant (besoin, horaire) |
| `staff_comment`| TEXT | **Note interne privée du mandat** (invisible pour l'étudiant) |
| `cancel_comment`| TEXT | Motif d'annulation ou de refus |
| `returned_by` | FK → `users` | Membre du mandat ayant validé la restitution |
| `returned_at` | TIMESTAMP | Horodatage de retour effectif |
| `created_at` | TIMESTAMP | Horodatage de réservation |

### 4.5 `reservation_items` (Lignes d'emprunt)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `reservation_id`| FK → `reservations` | Prêt parent |
| `equipment_id` | FK → `equipment` | Matériel emprunté |

### 4.6 `club_stock` (Stock & Nourriture Club)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `name` | VARCHAR | Nom de l'ingrédient ou consommable |
| `category` | VARCHAR | Nourriture, Épices, Boissons, Consommables, Matériel club |
| `quantity` | VARCHAR | Quantité en réserve (ex: "5 kg", "3 bouteilles") |
| `status` | VARCHAR | État / Fraîcheur (Frais, Bon état, Entamé...) |
| `location` | VARCHAR | Emplacement (Frigo Cook'It, Placard haut BDE...) |
| `expiration_date`| DATE | Date limite de consommation (DLC / DDM) |
| `comments` | TEXT | Allergènes, affectation à un événement club |
| `created_at` | TIMESTAMP | Horodatage de création |
| `updated_at` | TIMESTAMP | Horodatage de modification |

### 4.7 `audit_logs` (Journal d'Audit RGPD)
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Clé primaire |
| `user_id` | FK → `users` | Auteur de l'action |
| `user_email` | VARCHAR | Email de l'auteur |
| `user_name` | VARCHAR | Nom affiché de l'auteur |
| `action` | VARCHAR | Type d'événement (`AUTH_LOGIN`, `RESERVATION_CREATE`, `EQUIPMENT_EDIT`...) |
| `target_type` | VARCHAR | Ressource impactée (`user`, `reservation`, `equipment`, `stock`...) |
| `target_id` | UUID | Identifiant de la ressource |
| `details` | JSONB | Métadonnées synthétiques de l'action |
| `ip_address` | VARCHAR | Adresse IP anonymisée (dernier octet masqué) |
| `created_at` | TIMESTAMP | Horodatage précis |

### 4.8 `settings` (Configuration Dynamique)
| Clé | Valeur par défaut | Description |
|---|---|---|
| `max_reservation_days` | `"14"` | Durée maximale d'un prêt en jours |
| `max_advance_days` | `"0"` | Anticipation max en jours (0 = illimité) |
| `auto_approve_reservations` | `"false"` | Validation immédiate des réservations sans action manuelle |
| `require_phone` | `"false"` | Obligation de saisir un numéro de téléphone |
| `require_comments` | `"false"` | Obligation de renseigner un commentaire |
| `deposit_types` | `["Liquide", "Virement", "Chèque"]` | Modes de caution proposés |
| `equipment_statuses` | `["Neuf", "Bon état", "Usé", "En réparation", "Hors service"]` | Liste des états du matériel |
| `blocking_equipment_statuses` | `["En réparation", "Hors service"]` | États empêchant la réservation |
| `allowed_domains` | `["telecom-sudparis.eu"]` | Domaines autorisés à l'inscription |
| `discord_webhook_url` | `""` | Webhook Discord pour les alertes |

---

## 5. Matrice des Rôles & Permissions

| Fonctionnalité | Étudiant (`user`) | Mandat (`moderator`) | Admin (`admin`) |
|---|:---:|:---:|:---:|
| Consulter le catalogue public & photos | ✅ | ✅ | ✅ |
| Réserver du matériel (panier & dates) | ✅ | ✅ | ✅ |
| Suivre et annuler ses propres réservations | ✅ | ✅ | ✅ |
| Télécharger ses données personnelles (RGPD) | ✅ | ✅ | ✅ |
| Supprimer / anonymiser son compte | ✅ | ✅ | ✅ |
| Gestion des prêts (validation, retour, refus) | ❌ | ✅ | ✅ |
| **Modifier les prêts (dates, cautions, infos)** | ❌ | ✅ | ✅ |
| **Notes internes privées sur les prêts** | ❌ | ✅ | ✅ |
| CRUD matériel (détails, coût, emplacement) | ❌ | ✅ | ✅ |
| CRUD catégories | ❌ | ✅ | ✅ |
| **CRUD Stock & Nourriture du club** | ❌ | ✅ | ✅ |
| Gestion des utilisateurs & attribution des rôles | ❌ | ❌ | ✅ |
| Blocage / déblocage de comptes | ❌ | ❌ | ✅ |
| **Journal d'Audit complet traçable** | ❌ | ❌ | ✅ |
| **Panneau de Configuration (tous réglages)** | ❌ | ❌ | ✅ |

---

## 6. Guide de Démarrage Rapide

### Prérequis
- Docker & Docker Compose
- Node.js 22+ (pour développement local frontend)
- Python 3.12+ avec `uv` (pour développement local backend)

### Lancement avec Docker Compose
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Construire et démarrer les conteneurs
docker compose up --build -d

# Vérifier l'état des services
docker compose ps
```

L'application est disponible sur :
- Application Web : **http://localhost**
- API Backend : **http://localhost/api**
- Documentation Swagger API : **http://localhost/api/docs**

### Identifiants Administrateur par défaut
- Email : `admin@telecom-sudparis.eu`
- Rôle : `admin`
