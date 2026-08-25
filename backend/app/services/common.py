from fastapi import HTTPException, status

def not_found(entity: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} nenalezen.")


def apply_updates(model, data) -> None:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(model, field, value)
