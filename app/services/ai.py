import os
from typing import List
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set!")

client = genai.Client(api_key=API_KEY)

EMBEDDING_MODEL = "gemini-embedding-001"
GENERATION_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]

from fastapi import HTTPException, status


def get_embedding(text: str) -> List[float]:
    """Generates a 768-dimensional vector embedding for the input text."""
    try:
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return response.embeddings[0].values
        return response.embedding.values
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate embedding from Gemini API: {str(e)}"
        )

def get_embeddings_batch(texts: List[str], batch_size: int = 50) -> List[List[float]]:
    """Generates 768-dimensional embeddings in batches for high speed."""
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            for item in response.embeddings:
                all_embeddings.append(item.values)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to generate embeddings from Gemini API: {str(e)}"
            )
    return all_embeddings


def generate_rag_response(query: str, context_chunks: List[str]) -> str:
    """Generates a natural, comprehensive, ChatGPT-style answer using the retrieved context with automatic fallback."""
    context_text = "\n\n---\n\n".join(context_chunks)
    prompt = f"""You are an expert, articulate, and engaging AI knowledge assistant with the conversational mastery, depth, and intelligence of ChatGPT.
The reference material from the user's uploaded documents is provided below. You must ground your facts, findings, and technical assertions firmly in this reference material.

STRICT INSTRUCTIONS FOR YOUR RESPONSE:
1. EXPLAIN IN YOUR OWN WORDS: Synthesize and explain the concepts thoroughly, intelligently, and clearly in your own natural voice. Do not merely copy-paste raw text; teach and explain with depth, clarity, and precision.
2. COMPREHENSIVE & STRUCTURED: Give a complete, rich explanation. Break down the topic into logical sections using clean Markdown:
   - Use headings (`### Topic Section`)
   - Use bullet points and numbered lists for steps or key points
   - Bold important terms (`**keyword**`)
   - Include code blocks or quotes when relevant
   Avoid overly short, shallow, or single-sentence answers.
3. FORBIDDEN ROBOTIC PHRASES: NEVER start with or use phrases such as:
   - "Based on the provided context..."
   - "According to the uploaded document..."
   - "Based on the text provided..."
   - "The context mentions that..."
   Jump straight into answering the user's query naturally, authoritatively, and conversationally.
4. HONESTY: If the reference material genuinely does not cover what the user is asking, politely mention what details are absent, while answering what is available.

Reference Context:
{context_text}

User Question: {query}

Your In-Depth Answer:"""


    last_error = None
    for model_name in GENERATION_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            last_error = e
            continue

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Failed to generate answer from Gemini API: {str(last_error)}"
    )


