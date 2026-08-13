import argparse
from getpass import getpass

from email_validator import EmailNotValidError, validate_email

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create the initial production administrator.")
    parser.add_argument("--email", help="Administrator e-mail. Prompted when omitted.")
    parser.add_argument("--name", help="Administrator display name. Prompted when omitted.")
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="Reset the matching user's password and restore administrator access.",
    )
    return parser.parse_args()


def read_nonempty(value: str | None, prompt: str) -> str:
    result = (value or input(prompt)).strip()
    if not result:
        raise ValueError("Value cannot be empty.")
    return result


def read_email(value: str | None) -> str:
    raw_email = read_nonempty(value, "Administrator e-mail: ")
    try:
        return validate_email(raw_email, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise ValueError(f"Invalid e-mail address: {exc}") from exc


def validate_password(password: str) -> None:
    password_bytes = password.encode("utf-8")
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters.")
    if len(password_bytes) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes for bcrypt.")

    categories = (
        any(character.islower() for character in password),
        any(character.isupper() for character in password),
        any(character.isdigit() for character in password),
        any(not character.isalnum() for character in password),
    )
    if sum(categories) < 3:
        raise ValueError("Password must use at least three of: lowercase, uppercase, digits, symbols.")


def read_password() -> str:
    password = getpass("Administrator password: ")
    validate_password(password)
    confirmation = getpass("Repeat password: ")
    if password != confirmation:
        raise ValueError("Passwords do not match.")
    return password


def create_admin() -> None:
    args = parse_args()
    name = read_nonempty(args.name, "Administrator name: ")
    email = read_email(args.email)
    password = read_password()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).one_or_none()
        if user and not args.update_existing:
            raise ValueError(
                "A user with this e-mail already exists. "
                "Use --update-existing only for an intentional administrator reset."
            )

        if user:
            user.name = name
            user.password_hash = hash_password(password)
            user.role = "admin"
            user.is_active = True
            action = "updated"
        else:
            user = User(
                name=name,
                email=email,
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
            db.add(user)
            action = "created"

        db.commit()
        print(f"Administrator {email} was {action} successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        create_admin()
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
