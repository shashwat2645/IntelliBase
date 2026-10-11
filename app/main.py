import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, documents, chat

load_dotenv()

# Ensure uploads directory exists on host or container filesystem
os.makedirs(os.path.abspath("uploads"), exist_ok=True)

# Toggle interactive Swagger/OpenAPI docs via environment variable (disabled by default in production)
SHOW_DOCS = os.getenv("SHOW_DOCS", "false").lower() in ("true", "1", "yes")

app = FastAPI(
    title="AI Knowledge Base API",
    description="Backend for RAG-powered knowledge base",
    version="1.0.0",
    docs_url="/docs" if SHOW_DOCS else None,
    redoc_url="/redoc" if SHOW_DOCS else None,
    openapi_url="/openapi.json" if SHOW_DOCS else None,
)

# Configure CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)

# Mount static web assets
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
async def root():
    return FileResponse("app/static/index.html")

@app.get("/health")
async def health_check():
    """Lightweight health check endpoint for container orchestrators and pingers."""
    return {"status": "healthy", "service": "AI Knowledge Base"}
