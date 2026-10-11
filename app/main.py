from fastapi import FastAPI
from app.routers import auth

app = FastAPI(
    title="AI Knowledge Base API",
    description="Backend for RAG-powered knowledge base",
    version="0.1.0",
)

app.include_router(auth.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the AI Knowledge Base API. See /docs for the API documentation."}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

