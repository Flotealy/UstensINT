#!/usr/bin/env bash
# ==============================================================================
# UstensINT — Définir ou promouvoir un utilisateur Administrateur
# Usage:
#   ./set-admin.sh prenom.nom@telecom-sudparis.eu
#   ./set-admin.sh prenom.nom@telecom-sudparis.eu moderator
# ==============================================================================

set -euo pipefail

if [ $# -eq 0 ]; then
    read -rp "Entrez l'adresse email à passer administrateur : " TARGET_EMAIL
else
    TARGET_EMAIL="$1"
fi

ROLE="${2:-admin}"

echo "Attribution du rôle '$ROLE' à l'adresse '$TARGET_EMAIL'..."
docker compose exec -T backend uv run python -m app.scripts.set_admin "$TARGET_EMAIL" "$ROLE"
