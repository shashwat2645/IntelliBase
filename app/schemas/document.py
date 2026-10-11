from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel

class DocumentUploadResponse(BaseModel):
    document_id: int
    filename: str
    chunk_count: int
    message: str

class DocumentItem(BaseModel):
    id: int
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    conversation_id: Optional[int] = None
    query: str
    top_k: Optional[int] = 8

class ChunkSource(BaseModel):
    document_id: Optional[int] = None
    filename: str
    snippet: Optional[str] = None

class QueryResponse(BaseModel):
    conversation_id: int
    conversation_title: Optional[str] = None
    query: str
    answer: str
    sources: List[ChunkSource]

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationDetailResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    messages: List[MessageResponse]

    class Config:
        from_attributes = True
