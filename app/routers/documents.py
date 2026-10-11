import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.document import DocumentUploadResponse, DocumentItem
from app.services.document import extract_text_from_pdf, chunk_text
from app.services.ai import get_embeddings_batch
from app.repositories.document import create_document_with_chunks, get_user_documents, get_document_by_id
from app.repositories.user import get_user_by_email
from app.utils.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = os.path.abspath("uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are currently supported."
        )

    # 1. Read uploaded file content
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty."
        )

    # 2. Save physical PDF file to uploads directory
    safe_name = f"{current_user.id}_{uuid.uuid4().hex[:8]}_{file.filename}"
    saved_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(saved_path, "wb") as f:
        f.write(contents)

    # 3. Extract text from PDF
    text = extract_text_from_pdf(contents)
    if not text.strip():
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from this PDF."
        )

    # 4. Chunk text
    text_chunks = chunk_text(text, chunk_size=500, chunk_overlap=100)
    if not text_chunks:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to generate text chunks from the document."
        )

    # 5. Generate embeddings for all chunks in batch
    embeddings = get_embeddings_batch(text_chunks)
    chunks_data = [
        (index, chunk, embeddings[index])
        for index, chunk in enumerate(text_chunks)
    ]

    # 6. Persist document and chunk vectors into PostgreSQL
    saved_doc = await create_document_with_chunks(
        db=db,
        user_id=current_user.id,
        filename=file.filename,
        chunks_data=chunks_data,
        file_path=saved_path
    )

    return DocumentUploadResponse(
        document_id=saved_doc.id,
        filename=saved_doc.filename,
        chunk_count=len(chunks_data),
        message="Document uploaded, chunked, and vectorized successfully!"
    )

@router.get("", response_model=List[DocumentItem])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all documents uploaded by the current user."""
    docs = await get_user_documents(db, current_user.id)
    return docs

@router.get("/{document_id}/view")
async def view_document(
    document_id: int,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Allows opening and viewing the uploaded PDF in browser."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    doc = await get_document_by_id(db, document_id, user.id)
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found on disk")

    import urllib.parse
    encoded_name = urllib.parse.quote(doc.filename)
    return FileResponse(
        doc.file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{doc.filename}\"; filename*=UTF-8''{encoded_name}"}
    )

@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a document, its vector chunks, and its file on disk."""
    doc = await get_document_by_id(db, document_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted successfully"}
