"""
UstensINT — Backend FastAPI
Point d'entrée de l'application.
"""

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.config import settings
from app.database import engine, async_session, Base
from app.models import *  # noqa: F401, F403 — registers all models with Base.metadata
from app.seed import seed_database
from app.services.scheduler import run_scheduler
from app.routers import auth as auth_router
from app.routers import categories as categories_router
from app.routers import equipment as equipment_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup and seed default data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure new schema columns exist if table was created previously
        await conn.execute(text("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS staff_comment TEXT;"))
        await conn.execute(
            text(
                "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;"
            )
        )
    async with async_session() as session:
        await seed_database(session)

    # Rappels de restitution et alertes de retard.
    scheduler_task = asyncio.create_task(run_scheduler())
    try:
        yield
    finally:
        scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await scheduler_task
        await engine.dispose()


app = FastAPI(
    title="UstensINT API",
    description="API de réservation de matériel de cuisine — Télécom SudParis",
    version="0.1.0",
    lifespan=lifespan,
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth_router.router)
app.include_router(categories_router.router)
app.include_router(equipment_router.router)
from app.routers import reservations as reservations_router
app.include_router(reservations_router.router)
from app.routers import users as users_router
app.include_router(users_router.router)
from app.routers import settings as settings_router
app.include_router(settings_router.router)
from app.routers import stock as stock_router
app.include_router(stock_router.router)
from app.routers import audit_logs as audit_logs_router
app.include_router(audit_logs_router.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "ustensint-api"}

