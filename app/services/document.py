import io
import unicodedata
from typing import List
from pypdf import PdfReader

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts all plain text from PDF bytes, decomposes ligatures, and removes null characters."""
    reader = PdfReader(io.BytesIO(file_bytes))
    extracted_text = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            cleaned = unicodedata.normalize("NFKD", page_text).replace("\x00", "")
            if cleaned.strip():
                extracted_text.append(cleaned)
    return "\n".join(extracted_text)

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[str]:
    """Splits text into chunks of roughly chunk_size characters with sliding overlap."""
    clean_text = " ".join(text.replace("\x00", "").split())
    if not clean_text:
        return []


    chunks = []
    start = 0
    total_len = len(clean_text)

    while start < total_len:
        end = min(start + chunk_size, total_len)
        chunk = clean_text[start:end]
        chunks.append(chunk)

        if end == total_len:
            break

        start += (chunk_size - chunk_overlap)

    return chunks
