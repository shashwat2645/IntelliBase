from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.document import (
    QueryRequest,
    QueryResponse,
    ChunkSource,
    ConversationResponse,
    ConversationDetailResponse,
)
from app.services.ai import get_embedding, generate_rag_response
from app.repositories.document import search_user_chunks
from app.repositories.chat import (
    get_user_conversations,
    get_conversation_with_messages,
    create_conversation,
    add_message,
    delete_conversation,
    update_conversation_title,
)

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all chat threads for the current user."""
    return await get_user_conversations(db, current_user.id)

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def start_new_conversation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new blank chat session."""
    return await create_conversation(db, current_user.id, title="New Chat")

@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full conversation with historical message stream."""
    conv = await get_conversation_with_messages(db, conversation_id, current_user.id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv

@router.delete("/conversations/{conversation_id}")
async def remove_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a chat thread and all its history."""
    deleted = await delete_conversation(db, conversation_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"message": "Conversation deleted successfully"}

@router.post("/query", response_model=QueryResponse)
async def query_knowledge_base(
    query_in: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    clean_query = query_in.query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query string cannot be empty."
        )

    # 1. Resolve or create active Conversation
    if query_in.conversation_id:
        conv = await get_conversation_with_messages(db, query_in.conversation_id, current_user.id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    else:
        # Auto-title conversation with the first 35 characters of user question
        title = clean_query[:35] + ("..." if len(clean_query) > 35 else "")
        conv = await create_conversation(db, current_user.id, title=title)

    # 2. Persist user message to chat history
    await add_message(db, conversation_id=conv.id, role="user", content=clean_query)

    # 3. Generate 768-dim vector embedding for the query
    query_vector = get_embedding(clean_query)

    # 4. Vector search pgvector for the most semantically relevant chunks
    matched_results = await search_user_chunks(
        db=db,
        user_id=current_user.id,
        query_vector=query_vector,
        top_k=query_in.top_k or 4
    )

    if not matched_results:
        no_docs_msg = "I couldn't find any relevant information in your uploaded documents. Please make sure you have uploaded relevant PDFs to your knowledge base."
        await add_message(db, conversation_id=conv.id, role="assistant", content=no_docs_msg, sources=[])
        return QueryResponse(
            conversation_id=conv.id,
            query=clean_query,
            answer=no_docs_msg,
            sources=[]
        )

    # 5. Extract context chunks and clean source references (clean, human-friendly citations)
    context_chunks = []
    sources = []
    seen_sources = set()

    for chunk, filename in matched_results:
        context_chunks.append(chunk.content)
        # Avoid duplicate citations for same passage snippet
        key = (filename, chunk.content[:80])
        if key not in seen_sources:
            seen_sources.add(key)
            sources.append(
                ChunkSource(
                    filename=filename,
                    snippet=chunk.content
                )
            )

    # 6. Synthesize natural, ChatGPT-style answer via Gemini
    ai_answer = generate_rag_response(
        query=clean_query,
        context_chunks=context_chunks
    )

    # 7. Persist assistant response with citations to database
    sources_dict_list = [s.dict() for s in sources]
    await add_message(
        db=db,
        conversation_id=conv.id,
        role="assistant",
        content=ai_answer,
        sources=sources_dict_list
    )

    # If conversation was "New Chat", rename it to the question summary
    if conv.title == "New Chat":
        new_title = clean_query[:35] + ("..." if len(clean_query) > 35 else "")
        await update_conversation_title(db, conv.id, new_title)

    return QueryResponse(
        conversation_id=conv.id,
        query=clean_query,
        answer=ai_answer,
        sources=sources
    )
