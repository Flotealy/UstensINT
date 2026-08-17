# --- Backend Dockerfile (uv + FastAPI) ---
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Enable bytecode compilation for faster startup
ENV UV_COMPILE_BYTECODE=1
# Use copy link mode for uv
ENV UV_LINK_MODE=copy

# Install dependencies first (layer caching)
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# Copy application code
COPY . .
RUN uv sync --no-dev

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
