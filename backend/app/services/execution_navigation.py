"""Current repository placements, restricted to cases in the selected execution.

No readiness/approval filters: retired and unapproved definitions remain visible
in execution history. Case content continues to come from attempt snapshots.
"""
from sqlalchemy.orm import Session, selectinload

from app.models import SuiteGroup, TestCase, TestSuite
from app.schemas.execution_navigation import ExecutionNavigation, ExecutionNavigationGroup
from app.schemas.test_run_selection import SelectionChild, SelectionSuite
from app.services.suite_groups import group_test_cases_cte


def execution_navigation(db: Session, case_ids: list[int]) -> ExecutionNavigation:
    if not case_ids:
        return ExecutionNavigation()
    case_ids_set = set(case_ids)
    by_suite: dict[int, list[int]] = {}
    for case_id, suite_id in db.query(TestCase.id, TestCase.suite_id).filter(TestCase.id.in_(case_ids)).all():
        by_suite.setdefault(suite_id, []).append(case_id)
    suites = db.query(TestSuite).filter(TestSuite.id.in_(by_suite)).order_by(
        TestSuite.sort_order, TestSuite.name, TestSuite.id,
    ).all()

    visible = group_test_cases_cte()
    by_group: dict[int, set[int]] = {}
    for group_id, case_id in db.query(visible.c.group_id, visible.c.test_case_id).filter(
        visible.c.test_case_id.in_(case_ids),
    ).all():
        by_group.setdefault(group_id, set()).add(case_id)
    groups = db.query(SuiteGroup).filter(SuiteGroup.id.in_(by_group)).options(
        selectinload(SuiteGroup.memberships),
        selectinload(SuiteGroup.test_case_memberships),
        selectinload(SuiteGroup.outgoing_relations),
    ).order_by(SuiteGroup.sort_order, SuiteGroup.name, SuiteGroup.id).all()
    rows = []
    for group in groups:
        direct_ids = {member.test_case_id for member in group.test_case_members} & case_ids_set
        suite_ids = [member.suite_id for member in group.members if member.suite_id in by_suite]
        own_ids = direct_ids | {case_id for suite_id in suite_ids for case_id in by_suite[suite_id]}
        rows.append(ExecutionNavigationGroup(
            id=group.id, name=group.name, case_ids=sorted(by_group[group.id]),
            own_case_ids=sorted(own_ids), direct_case_ids=sorted(direct_ids), suite_ids=suite_ids,
            children=[SelectionChild(group_id=edge.child_group_id, include_descendants=edge.include_descendants)
                      for edge in group.child_relations if edge.child_group_id in by_group],
        ))
    return ExecutionNavigation(
        suites=[SelectionSuite(id=suite.id, name=suite.name, case_ids=sorted(by_suite[suite.id])) for suite in suites],
        groups=rows,
    )
