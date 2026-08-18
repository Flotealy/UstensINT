#!/usr/bin/env bash
# ==============================================================================
# UstensINT — Peupler la base de données avec des données de démo Cook'It
# ==============================================================================

set -euo pipefail

echo "🌱 Injection des données de démonstration Cook'It dans la base PostgreSQL..."
docker compose exec -T backend uv run python -m app.scripts.seed_demo
echo "🎉 Terminé ! Rendez-vous sur votre site pour voir le catalogue complet."
