"""
Script de seed — Données initiales.
Insère les paramètres par défaut, les catégories de base et un utilisateur admin
si la base est vide.
"""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Setting, User

logger = logging.getLogger(__name__)

# --- Paramètres par défaut ---
DEFAULT_SETTINGS: list[dict[str, str]] = [
    {
        "key": "max_reservation_days",
        "value": "14",
        "description": "Durée maximale d'une réservation en jours",
    },
    {
        "key": "max_advance_days",
        "value": "0",
        "description": "Nombre maximum de jours à l'avance pour réserver (0 = illimité)",
    },
    {
        "key": "deposit_types",
        "value": json.dumps(["Liquide", "Virement", "Chèque"]),
        "description": "Types de caution disponibles (JSON array)",
    },
    {
        "key": "equipment_statuses",
        "value": json.dumps(
            ["Neuf", "Bon état", "Usé", "En réparation", "Hors service"]
        ),
        "description": "États possibles du matériel (JSON array)",
    },
    {
        "key": "blocking_equipment_statuses",
        "value": json.dumps(["En réparation", "Hors service"]),
        "description": "États du matériel qui bloquent la réservation (JSON array)",
    },
    {
        "key": "auto_approve_reservations",
        "value": "false",
        "description": "Approuver automatiquement les nouvelles demandes de réservation (true/false)",
    },
    {
        "key": "require_phone",
        "value": "false",
        "description": "Rendre le numéro de téléphone obligatoire lors de la réservation (true/false)",
    },
    {
        "key": "require_comments",
        "value": "false",
        "description": "Rendre le commentaire obligatoire lors de la réservation (true/false)",
    },
    {
        "key": "allowed_domains",
        "value": json.dumps(["telecom-sudparis.eu"]),
        "description": "Domaines email autorisés pour l'inscription (JSON array)",
    },
    {
        "key": "discord_webhook_url",
        "value": "",
        "description": "URL du webhook Discord pour les notifications de réservation",
    },
]

# --- Catégories par défaut ---
DEFAULT_CATEGORIES: list[dict[str, str]] = [
    {"name": "Cuisson", "description": "Poêles, casseroles, plaques, fours..."},
    {"name": "Préparation", "description": "Planches, couteaux, bols, fouets..."},
    {"name": "Pâtisserie", "description": "Moules, spatules, poches à douille..."},
    {"name": "Électroménager", "description": "Robots, mixeurs, blenders..."},
    {"name": "Service", "description": "Plats, assiettes, couverts, verrerie..."},
    {"name": "Autre", "description": "Matériel divers"},
]


async def seed_database(session: AsyncSession) -> None:
    """Insert default data if the database is empty."""

    # --- Settings ---
    existing_settings = await session.execute(select(Setting.key))
    existing_keys = {row[0] for row in existing_settings}

    settings_added = 0
    for setting_data in DEFAULT_SETTINGS:
        if setting_data["key"] not in existing_keys:
            session.add(Setting(**setting_data))
            settings_added += 1

    if settings_added:
        logger.info("Seed: %d paramètres ajoutés", settings_added)

    # --- Categories ---
    existing_categories = await session.execute(select(Category.name))
    existing_names = {row[0] for row in existing_categories}

    categories_added = 0
    for cat_data in DEFAULT_CATEGORIES:
        if cat_data["name"] not in existing_names:
            session.add(Category(**cat_data))
            categories_added += 1

    if categories_added:
        logger.info("Seed: %d catégories ajoutées", categories_added)

    await session.commit()
    logger.info("Seed: terminé")
