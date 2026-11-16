import io
import re

MAX_BYTES_DEFAULT = 15 * 1024 * 1024
ALLOWED = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "image/png": "img", "image/jpeg": "img",
}
MAGIC = {"pdf": b"%PDF", "pptx": b"PK", "docx": b"PK"}


def validate(content_type: str, data: bytes, max_mb: int) -> str:
    kind = ALLOWED.get(content_type)
    if not kind:
        raise ValueError(f"Unsupported file type: {content_type}")
    if len(data) > max_mb * 1024 * 1024:
        raise ValueError(f"File exceeds {max_mb} MB")
    if kind in MAGIC and not data.startswith(MAGIC[kind]):
        raise ValueError("File content does not match its declared type")
    return kind


def clean(text: str) -> str:
    text = re.sub(r"-\n(\w)", r"\1", text)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()


def extract_text(kind: str, data: bytes) -> str:
    if kind == "pdf":
        import fitz
        with fitz.open(stream=data, filetype="pdf") as d:
            return clean("\n".join(p.get_text() for p in d))
    if kind == "pptx":
        from pptx import Presentation
        prs = Presentation(io.BytesIO(data))
        return clean("\n".join(sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame))
    if kind == "docx":
        import docx
        return clean("\n".join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs))
    if kind == "txt":
        return clean(data.decode("utf-8", errors="ignore"))
    if kind == "img":
        # Phase 7: route to a vision/OCR model through AIProvider. Placeholder keeps the pipeline typed.
        return ""
    raise ValueError("unknown kind")
