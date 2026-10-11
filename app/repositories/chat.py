from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.chat import Conversation, Message

async def get_user_conversations(db: AsyncSession, user_id: int) -> List[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
    )
    return result.scalars().all()

async def get_conversation_with_messages(
    db: AsyncSession,
    conversation_id: int,
    user_id: int
) -> Optional[Conversation]:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
    )
    return result.scalars().first()

async def create_conversation(
    db: AsyncSession,
    user_id: int,
    title: str = "New Chat"
) -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv

async def add_message(
    db: AsyncSession,
    conversation_id: int,
    role: str,
    content: str,
    sources: Optional[List[dict]] = None
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        sources=sources
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

async def update_conversation_title(
    db: AsyncSession,
    conversation_id: int,
    title: str
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalars().first()
    if conv:
        conv.title = title
        await db.commit()

async def delete_conversation(
    db: AsyncSession,
    conversation_id: int,
    user_id: int
) -> bool:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)
    )
    conv = result.scalars().first()
    if conv:
        await db.delete(conv)
        await db.commit()
        return True
    return False
