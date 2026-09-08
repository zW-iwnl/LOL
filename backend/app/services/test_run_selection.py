"""Resolve repository selections using the same DAG rules as the repository."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models import SuiteGroup, TestCase, TestCaseTagAssignment, TestSuite
from app.schemas.test_run_selection import (
    RunSelection, SelectionCase, SelectionCatalog, SelectionChild,
    SelectionGroup, SelectionPreview, SelectionSuite,
)
from app.services.suite_groups import group_test_cases_cte


def selection_catalog(db: Session) -> SelectionCatalog:
    suites = db.query(TestSuite).order_by(TestSuite.sort_order, TestSuite.name, TestSuite.id).populate_existing().all()
    active_suites = {suite.id for suite in suites if suite.is_active}
    cases = db.query(TestCase).options(
        selectinload(TestCase.tag_assignments).selectinload(TestCaseTagAssignment.tag),
    ).order_by(TestCase.code, TestCase.id).populate_existing().all()
    case_rows = []
    by_suite: dict[int, list[int]] = {}
    for case in cases:
        by_suite.setdefault(case.suite_id, []).append(case.id)
        reason = None
        if case.status == "deprecated":
            reason = "Vyřazený test case"
        elif case.status != "ready" or not case.current_approved_version_id:
            reason = "Chybí schválená verze"
        elif case.suite_id not in active_suites:
            reason = "Neaktivní test suita"
        case_rows.append(SelectionCase(
            id=case.id, code=case.code, title=case.title, suite_id=case.suite_id,
            version_id=case.current_approved_version_id,
            tags=sorted({tag.name for tag in case.tags}), exclusion_reason=reason,
        ))
    visible = group_test_cases_cte()
    by_group: dict[int, list[int]] = {}
    for group_id, case_id in db.query(visible.c.group_id, visible.c.test_case_id).all():
        by_group.setdefault(group_id, []).append(case_id)
    groups = []
    group_rows = db.query(SuiteGroup).options(
        selectinload(SuiteGroup.memberships),
        selectinload(SuiteGroup.test_case_memberships),
        selectinload(SuiteGroup.outgoing_relations),
    ).order_by(SuiteGroup.sort_order, SuiteGroup.name, SuiteGroup.id).populate_existing().all()
    for group in group_rows:
        own_ids = {member.test_case_id for member in group.test_case_members}
        for member in group.members:
            own_ids.update(by_suite.get(member.suite_id, []))
        groups.append(SelectionGroup(
            id=group.id, name=group.name, case_ids=sorted(by_group.get(group.id, [])),
            own_case_ids=sorted(own_ids), suite_ids=[member.suite_id for member in group.members],
            children=[SelectionChild(group_id=relation.child_group_id,
                                     include_descendants=relation.include_descendants)
                      for relation in group.child_relations],
        ))
    return SelectionCatalog(
        cases=case_rows,
        suites=[SelectionSuite(id=suite.id, name=suite.name, case_ids=by_suite.get(suite.id, []))
                for suite in suites],
        groups=groups,
    )


def preview_selection(db: Session, selection: RunSelection, *, lock: bool = False) -> SelectionPreview:
    catalog = selection_catalog(db)
    suites = {item.id: item for item in catalog.suites}
    groups = {item.id: item for item in catalog.groups}
    cases = {item.id: item for item in catalog.cases}
    selected = set(selection.test_case_ids)
    for suite_id in selection.suite_ids:
        if suite_id not in suites:
            raise HTTPException(422, "Vybraná test suita již neexistuje. Obnovte nabídku.")
        selected.update(suites[suite_id].case_ids)
    for entry in selection.groups:
        if entry.group_id not in groups:
            raise HTTPException(422, "Vybraná skupina již neexistuje. Obnovte nabídku.")
        group = groups[entry.group_id]
        selected.update(group.case_ids if entry.include_descendants else group.own_case_ids)
    if selected - cases.keys():
        raise HTTPException(422, "Vybraný test case již neexistuje. Obnovte nabídku.")
    if lock:
        # Publications and deprecations lock these same rows. Refresh after waiting
        # for a concurrent publisher so the fingerprint describes the bound versions.
        db.query(TestCase).filter(TestCase.id.in_(selected)).order_by(TestCase.id).with_for_update().all()
        return preview_selection(db, selection)
    selected_cases = [cases[case_id] for case_id in sorted(selected)]
    fingerprint = hashlib.sha256(json.dumps(
        [item.model_dump() for item in selected_cases], sort_keys=True,
        ensure_ascii=False, separators=(",", ":"),
    ).encode()).hexdigest()
    return SelectionPreview(
        cases=[item for item in selected_cases if item.exclusion_reason is None],
        excluded_cases=[item for item in selected_cases if item.exclusion_reason is not None],
        fingerprint=fingerprint,
    )
