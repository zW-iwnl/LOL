from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.schemas.dashboard import DashboardRead
from app.schemas.defect import DefectCreate, DefectRead, DefectUpdate
from app.schemas.project import ProjectCreate, ProjectListItem, ProjectRead, ProjectUpdate
from app.schemas.test_case import (
    TestCaseCreate,
    TestCaseRead,
    TestCaseUpdate,
    TestStepCreate,
    TestStepRead,
    TestStepUpdate,
)
from app.schemas.test_run import (
    AddTestCasesRequest,
    TestRunAddCasesRequest,
    TestRunCaseRead,
    TestRunCreate,
    TestRunExecutionRead,
    TestRunListItem,
    TestRunRead,
    TestRunUpdate,
    UpdateResultRequest,
)
from app.schemas.test_suite import TestSuiteCreate, TestSuiteRead, TestSuiteTreeNode, TestSuiteUpdate
