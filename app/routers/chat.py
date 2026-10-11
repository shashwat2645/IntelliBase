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
from app.services.ai import get_embedding, generate_rag_response, generate_conversation_title
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
    is_new_conversation = False
    if query_in.conversation_id:
        conv = await get_conversation_with_messages(db, query_in.conversation_id, current_user.id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    else:
        is_new_conversation = True
        conv = await create_conversation(db, current_user.id, title="New Chat")

    # 2. Capture prior conversation messages for conversational continuity
    chat_history = []
    if query_in.conversation_id and conv:
        try:
            if conv.messages:
                for msg in conv.messages[-6:]:
                    chat_history.append({"role": msg.role, "content": msg.content})
        except Exception:
            chat_history = []

    # 3. Persist user message to chat history
    await add_message(db, conversation_id=conv.id, role="user", content=clean_query)

    # 4. Generate 768-dim vector embedding for the query
    query_vector = get_embedding(clean_query)

    # 5. Vector search pgvector for the most semantically relevant chunks
    matched_results = await search_user_chunks(
        db=db,
        user_id=current_user.id,
        query_vector=query_vector,
        top_k=query_in.top_k or 8
    )

    if not matched_results:
        no_docs_msg = "I couldn't find any relevant information in your uploaded documents. Please make sure you have uploaded relevant PDFs to your knowledge base."
        await add_message(db, conversation_id=conv.id, role="assistant", content=no_docs_msg, sources=[])
        
        # Title conversation if new
        conv_title = conv.title
        if is_new_conversation or conv.title == "New Chat":
            conv_title = generate_conversation_title(clean_query)
            await update_conversation_title(db, conv.id, conv_title)

        return QueryResponse(
            conversation_id=conv.id,
            conversation_title=conv_title,
            query=clean_query,
            answer=no_docs_msg,
            sources=[]
        )

    # 6. Extract context chunks and unique source document references
    context_chunks = []
    sources = []
    seen_docs = set()

    for chunk, filename in matched_results:
        context_chunks.append(chunk.content)
        if filename not in seen_docs:
            seen_docs.add(filename)
            sources.append(
                ChunkSource(
                    document_id=chunk.document_id,
                    filename=filename,
                    snippet=None
                )
            )

    # 7. Synthesize natural, in-depth, ChatGPT-style answer via Gemini
    ai_answer = generate_rag_response(
        query=clean_query,
        context_chunks=context_chunks,
        chat_history=chat_history
    )

    # 8. Persist assistant response with citations to database
    sources_dict_list = [s.dict() for s in sources]
    await add_message(
        db=db,
        conversation_id=conv.id,
        role="assistant",
        content=ai_answer,
        sources=sources_dict_list
    )

    # 9. Generate a concise ChatGPT-style conversation title if new or default
    conv_title = conv.title
    if is_new_conversation or conv.title == "New Chat":
        conv_title = generate_conversation_title(clean_query)
        await update_conversation_title(db, conv.id, conv_title)

    return QueryResponse(
        conversation_id=conv.id,
        conversation_title=conv_title,
        query=clean_query,
        answer=ai_answer,
        sources=sources
    )
