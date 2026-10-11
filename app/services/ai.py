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
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
]

from typing import Optional
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


def generate_rag_response(
    query: str, 
    context_chunks: List[str],
    chat_history: Optional[List[dict]] = None
) -> str:
    """Generates a natural, comprehensive, ChatGPT-style answer using the retrieved context with automatic fallback."""
    context_text = "\n\n---\n\n".join(context_chunks)

    history_section = ""
    if chat_history and len(chat_history) > 0:
        lines = []
        for msg in chat_history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "").strip()
            if content:
                lines.append(f"{role}: {content}")
        if lines:
            history_section = "### Conversation Context & Previous Discussion:\n" + "\n".join(lines) + "\n\n---\n\n"

    prompt = f"""You are an elite, highly articulate, and deeply knowledgeable AI assistant with the conversational mastery, reasoning depth, and polish of ChatGPT Plus.
You are assisting a user who has uploaded reference documents into their knowledge base.

{history_section}### Reference Material From User's Uploaded Documents:
{context_text}

---

### User Question:
{query}

### CRITICAL GUIDELINES FOR YOUR RESPONSE:
1. DELIVER SATISFYING, IN-DEPTH, AND THOROUGH ANSWERS:
   - Avoid shallow, terse, or superficial summaries. Provide rich, insightful explanations that thoroughly unpack the subject matter.
   - Explain the "why" and "how", not just the "what". Teach the underlying concepts clearly so the user walks away fully satisfied.
   - Address EVERY aspect of the user's inquiry directly.
2. BALANCED GROUNDING & GENERAL EXPERTISE:
   - Ground specific facts, metrics, terminology, policies, and findings faithfully in the provided document context.
   - If the user asks for real-world examples, practical applications, or foundational concepts (e.g., neural networks, activation functions, mathematical principles), provide authentic, industry-standard examples and explanations.
   - DO NOT artificially force unrelated topics from the document (like database indexes or search algorithms) into examples where they do not naturally belong.
3. CONVERSATIONAL CONTINUITY:
   - If previous conversation messages are provided, maintain natural context and conversational flow, honoring any clarifications or references made earlier.
4. ELEGANT MARKDOWN STRUCTURE:
   - Use clean, modern Markdown: descriptive section headings (`### ...`), bold key concepts, clear bullet points, numbered workflows, and code/math formatting where appropriate.
   - Conclude with a helpful summary or key takeaways when appropriate.
5. ZERO ROBOTIC DISCLAIMERS:
   - NEVER use robotic phrases like "Based on the provided context...", "According to the uploaded documents...", "As stated in the text...".
   - Speak naturally, authoritatively, and conversationally in your own expert voice.
6. STRICT PRIVACY & ZERO PERSONAL DATA LEAKS:
   - NEVER mention, reference, disclose, or leak any personal user details, user IDs, emails, personal identities, local filesystem paths (e.g., /Users/...), or internal system metadata.
   - Maintain a neutral, professional, and universally accessible tone suitable for public or random users. Treat all inquiries objectively based on subject matter and document concepts.

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


def generate_conversation_title(query: str) -> str:
    """Generates a concise 2-5 word ChatGPT-style topic title summarizing the question."""
    prompt = f"""You are a chat title generator like ChatGPT. Generate a concise, natural, and punchy title (2 to 5 words maximum, Title Case, no quotes, no punctuation at the end) that captures the core topic of the user's question.
Do NOT repeat the whole question or use phrases like "Question about..." or "How to...". Just name the topic directly.

User Question: {query}
Concise Title:"""
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(max_output_tokens=20, temperature=0.3)
        )
        title = response.text.strip().replace('"', '').replace("'", "").replace("*", "").strip()
        title = title.rstrip(".:- ")
        if title and 3 <= len(title) <= 45:
            return title
    except Exception:
        pass

    # Intelligent algorithmic fallback if API is unavailable:
    words = [
        w for w in query.replace("?", "").replace("!", "").replace(".", "").split()
        if w.lower() not in {
            "what", "is", "the", "how", "to", "can", "you", "please", "explain",
            "give", "me", "a", "an", "for", "in", "my", "about", "of", "and",
            "do", "does", "why", "are", "tell"
        }
    ]
    fallback = " ".join(words[:4]).title()
    return fallback if fallback else "New Discussion"


