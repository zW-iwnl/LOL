from typing import Literal
from pydantic import BaseModel, EmailStr, Field, SecretStr, model_validator


class UserRoleUpdate(BaseModel):
    role: Literal["tester", "reviewer", "test_lead", "admin"]


class UserCreate(UserRoleUpdate):
    role: Literal["tester", "reviewer", "test_lead", "admin"] = "tester"
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: SecretStr = Field(min_length=12, max_length=72)

    @model_validator(mode="after")
    def validate_user(self):
        self.name = self.name.strip()
        if not self.name or len(self.password.get_secret_value().encode("utf-8")) > 72:
            raise ValueError("Vyplňte jméno; heslo musí mít alespoň 12 znaků a nejvýše 72 bajtů UTF-8.")
        return self
