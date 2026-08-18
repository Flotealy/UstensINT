"""
Script CLI — Définir ou pré-créer un utilisateur administrateur.
Usage:
    uv run python -m app.scripts.set_admin email@domaine.fr [admin|moderator|user]
"""

import asyncio
import sys

from sqlalchemy import select

from app.database import async_session
from app.models.user import User
from app.utils.email import deduce_display_name


async def set_user_role(email: str, role: str = "admin") -> None:
    email = email.strip().lower()

    if not email or "@" not in email:
        print(f"❌ Erreur: Adresse email invalide '{email}'", file=sys.stderr)
        sys.exit(1)

    if "+" in email:
        print(f"❌ Erreur: Les alias avec '+' ne sont pas autorisés ('{email}')", file=sys.stderr)
        sys.exit(1)

    role = role.strip().lower()
    if role not in ("admin", "moderator", "user"):
        print(f"❌ Erreur: Rôle '{role}' invalide. Rôles valides: admin, moderator, user", file=sys.stderr)
        sys.exit(1)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            old_role = user.role
            user.role = role
            user.is_blocked = False
            await session.commit()
            print(f"✅ [SUCCÈS] L'utilisateur existant '{email}' a été mis à jour : rôle '{old_role}' ➔ '{role}'.")
        else:
            display_name = deduce_display_name(email)
            new_user = User(
                email=email,
                display_name=display_name,
                role=role,
                is_blocked=False,
            )
            session.add(new_user)
            await session.commit()
            print(f"✅ [SUCCÈS] Compte pré-créé pour '{email}' ({display_name}) avec le rôle '{role}'.")
            print(f"👉 Dès sa première connexion par code email, l'utilisateur aura directement les droits '{role}'.")


def main():
    if len(sys.argv) < 2:
        print("Usage: uv run python -m app.scripts.set_admin <email> [role]")
        sys.exit(1)

    email = sys.argv[1]
    role = sys.argv[2] if len(sys.argv) > 2 else "admin"

    asyncio.run(set_user_role(email, role))


if __name__ == "__main__":
    main()
