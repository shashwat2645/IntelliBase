from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.document import Document, DocumentChunk

async def create_document_with_chunks(
    db: AsyncSession,
    user_id: int,
    filename: str,
    chunks_data: List[Tuple[int, str, List[float]]],
    file_path: str = None
) -> Document:
    # 1. Create document record
    doc = Document(user_id=user_id, filename=filename, file_path=file_path)
    db.add(doc)
    await db.flush()  # flushes to populate doc.id

    # 2. Add each chunk with its vector embedding
    for index, content, embedding in chunks_data:
        chunk = DocumentChunk(
            document_id=doc.id,
            chunk_index=index,
            content=content,
            embedding=embedding
        )
        db.add(chunk)

    await db.commit()
    await db.refresh(doc)
    return doc

async def get_user_documents(db: AsyncSession, user_id: int) -> List[Document]:
    result = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return result.scalars().all()

async def get_document_by_id(db: AsyncSession, doc_id: int, user_id: int) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user_id)
    )
    return result.scalars().first()


async def search_user_chunks(
    db: AsyncSession,
    user_id: int,
    query_vector: List[float],
    top_k: int = 4
) -> List[Tuple[DocumentChunk, str]]:
    """Retrieves top-K most semantically similar chunks belonging to user_id via cosine distance."""
    stmt = (
        select(DocumentChunk, Document.filename)
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(Document.user_id == user_id)
        .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
        .limit(top_k)
    )
    result = await db.execute(stmt)
    return result.all()
