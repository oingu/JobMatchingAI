from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_PROFICIENCY = 5


class SkillEntry(BaseModel):
    """A single skill with a proficiency level (1-5).

    1 = Beginner, 2 = Elementary, 3 = Intermediate,
    4 = Advanced, 5 = Expert.
    """

    name: Annotated[str, Field(min_length=1, max_length=80)]
    level: int = Field(ge=1, le=MAX_PROFICIENCY)


class UserCreate(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=120)]
    email: Annotated[str, Field(min_length=5, max_length=200)]
    password: str = Field(min_length=6)
    role: str = Field(pattern="^(candidate|recruiter)$")
    is_online: bool = False


class UserOnlineUpdate(BaseModel):
    is_online: bool


class CandidateProfileCreate(BaseModel):
    user_id: int
    skills: Annotated[list[SkillEntry], Field(min_length=1)]
    experience_level: Literal["junior", "middle", "senior"]
    preferred_locations: Annotated[list[str], Field(min_length=1)]
    preferred_salary_min: int = Field(ge=0)
    birth_date: str = Field(min_length=4)
    phone: str = Field(default="")


class RecruiterProfileCreate(BaseModel):
    user_id: int
    company_name: Annotated[str, Field(min_length=2, max_length=255)]
    phone: str = Field(default="")


class JobCreate(BaseModel):
    recruiter_id: int
    title: Annotated[str, Field(min_length=2, max_length=255)]
    brief_description: Annotated[str, Field(max_length=3000)] = ""
    required_skills: Annotated[list[SkillEntry], Field(min_length=1)]
    location: Annotated[str, Field(min_length=2, max_length=100)]
    salary_min: int = Field(ge=0)
    salary_max: int = Field(ge=0)
    experience_level: Literal["junior", "middle", "senior"]
    start_date: datetime | None = None
    end_date: datetime | None = None

    @model_validator(mode="after")
    def validate_salary(self) -> "JobCreate":
        if self.salary_min > self.salary_max:
            raise ValueError("salary_min must be <= salary_max")
        return self

    @model_validator(mode="after")
    def validate_dates(self) -> "JobCreate":
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        return self


class JobUpdate(BaseModel):
    title: Annotated[str, Field(min_length=2, max_length=255)]
    brief_description: Annotated[str, Field(max_length=3000)] = ""
    required_skills: Annotated[list[SkillEntry], Field(min_length=1)]
    location: Annotated[str, Field(min_length=2, max_length=100)]
    salary_min: int = Field(ge=0)
    salary_max: int = Field(ge=0)
    experience_level: Literal["junior", "middle", "senior"]
    start_date: datetime | None = None
    end_date: datetime | None = None

    @model_validator(mode="after")
    def validate_salary(self) -> "JobUpdate":
        if self.salary_min > self.salary_max:
            raise ValueError("salary_min must be <= salary_max")
        return self

    @model_validator(mode="after")
    def validate_dates(self) -> "JobUpdate":
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        return self


class InteractionCreate(BaseModel):
    user_id: int
    job_id: int | None = None
    event_type: str = Field(pattern="^(view|click|apply|login)$")
    event_metadata: dict[str, Any] = {}


class EventOut(BaseModel):
    id: int
    event_type: str
    status: str
    payload: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    job_id: int
    cover_letter: str = ""


class ApplicationReview(BaseModel):
    status: Literal["ACCEPTED", "REJECTED"]


class LoginRequest(BaseModel):
    email: str
    password: str
