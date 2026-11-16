from typing import Any, Literal
from pydantic import BaseModel, Field


class StudentInput(BaseModel):
    """Common representation for every input modality (text now; voice/image/code later)."""
    type: Literal["text", "voice", "image", "code"] = "text"
    content: str = ""
    extracted_text: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def text(self) -> str:
        return (self.extracted_text or self.content or "").strip()


class SignupIn(BaseModel):
    name: str
    email: str
    role: Literal["student", "professor"] = "student"


class CustomConceptIn(BaseModel):
    name: str
    subject: str = "General Knowledge"
    description: str = ""
    material_id: str | None = None


class SessionCreate(BaseModel):
    concept_id: str
    material_id: str | None = None


class MessageIn(BaseModel):
    input: StudentInput


class TransferAnswerIn(BaseModel):
    input: StudentInput


class CourseCreate(BaseModel):
    name: str


class AddStudent(BaseModel):
    student_id: str
