from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routers import auth, documents, chat

app = FastAPI(
    title="AI Knowledge Base API",
    description="Backend for RAG-powered knowledge base",
    version="0.1.0",
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)

# Mount static assets
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
async def root():
    return FileResponse("app/static/index.html")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


