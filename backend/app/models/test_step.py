from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin


class TestStep(TimestampMixin, Base):
    __tablename__ = "test_steps"
    __table_args__ = (
        UniqueConstraint("test_case_id", "step_order", name="uq_test_steps_case_order"),
        CheckConstraint("step_order >= 1", name="ck_test_steps_order_positive"),
        CheckConstraint("step_type IN ('test', 'information')", name="ck_test_steps_type"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    step_type: Mapped[str] = mapped_column(String(30), nullable=False, default="test")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    test_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    test_case = relationship("TestCase", back_populates="steps")
