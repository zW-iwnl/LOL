"""Canonical draft content, immutable snapshots and stable step identities."""
from copy import deepcopy
import hashlib
import json
from uuid import UUID, NAMESPACE_URL, uuid5

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import TestCase, TestCaseTag
from app.schemas.test_case_workflow import DraftContent
from app.services.test_case_tags import validate_tag_ids


def content_hash(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def legacy_step_key(case_id: int, step_id: int) -> str:
    return str(uuid5(NAMESPACE_URL, f"test-manager/case/{case_id}/step/{step_id}"))


def from_live(case: TestCase) -> dict:
    return DraftContent.model_validate({
        **{field: getattr(case, field) for field in ("title", "description", "preconditions", "expected_summary", "automated", "tag_ids")},
        "steps": [{
            **{field: getattr(s, field) for field in ("step_order", "action", "step_type", "note", "expected_result", "test_data")},
            "step_key": legacy_step_key(case.id, s.id),
        } for s in case.steps],
    }).model_dump(mode="json")


def from_snapshot(snapshot: dict) -> dict:
    data = deepcopy(snapshot)
    data["tag_ids"] = data.get("tag_ids", [t["id"] for category in ("business_areas", "application_domains", "object_types") for t in data.get(category, [])])
    for step in data.get("steps", []):
        step.setdefault("step_key", legacy_step_key(data["id"], step["id"]))
    return DraftContent.model_validate(data).model_dump(mode="json")


def validate_content(db: Session, content: dict, *, executable: bool = False) -> dict:
    data = DraftContent.model_validate(content).model_dump(mode="json")
    validate_tag_ids(db, data["tag_ids"])
    if executable:
        steps = [s for s in data["steps"] if s["step_type"] == "test"]
        if not steps or any(not s["action"].strip() or not (s["expected_result"] or "").strip() for s in steps):
            raise HTTPException(422, "Pro provedení nebo schválení je nutný testovací krok s akcí a očekávaným výsledkem.")
    return data


def snapshot(db: Session, case: TestCase, content: dict) -> dict:
    data = deepcopy(content)
    data.update(id=case.id, code=case.code, suite_id=case.suite_id, suite_name=case.suite.name, schema_version=1)
    tags = db.query(TestCaseTag).filter(TestCaseTag.id.in_(content["tag_ids"])).order_by(TestCaseTag.id).all()
    data["tags"] = [{"id": t.id, "name": t.name, "category": t.category} for t in tags]
    for category, key in (("business_area", "business_areas"), ("application_domain", "application_domains"), ("object_type", "object_types")):
        data[key] = [{"id": t.id, "name": t.name} for t in tags if t.category == category]
        data[category] = data[key][0] if data[key] else None
    for step in data["steps"]:
        # Exact integers in both JavaScript and BIGINT; never a live TestStep FK.
        step["id"] = UUID(step["step_key"]).int % (2**52) + 1
    if len({s["id"] for s in data["steps"]}) != len(data["steps"]):
        raise HTTPException(409, "Kolize identifikátoru kroku. Založte dotčený krok znovu.")
    return data


def diff(before: dict, after: dict) -> list[dict]:
    changes = []
    for field in ("title", "description", "preconditions", "expected_summary", "automated", "tags"):
        if before.get(field) != after.get(field):
            changes.append({"field": field, "before": before.get(field), "after": after.get(field)})
    left = {s.get("step_key", str(s.get("id"))): s for s in before.get("steps", [])}
    right = {s.get("step_key", str(s.get("id"))): s for s in after.get("steps", [])}
    for key in sorted(left.keys() | right.keys()):
        if left.get(key) != right.get(key):
            changes.append({"field": f"steps.{key}", "before": left.get(key), "after": right.get(key)})
    return changes
