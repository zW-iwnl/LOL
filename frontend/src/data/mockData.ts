export type TestCaseStatus = "draft" | "ready" | "deprecated";
export type TestRunStatus = "open" | "in_progress" | "completed";
export type Result = "not_run" | "passed" | "failed" | "blocked" | "skipped";

export type TestSuite = {
  id: number;
  name: string;
  path: string;
  level: number;
  parentId: number | null;
  testCaseCount: number;
};

export type TestStep = {
  id: number;
  order: number;
  action: string;
  expected: string;
  data?: string;
};

export type TestCase = {
  id: number;
  code: string;
  title: string;
  suiteId: number;
  status: TestCaseStatus;
  owner: string;
  preconditions: string;
  expectedSummary: string;
  steps: TestStep[];
};

export type TestRunCase = {
  id: number;
  testCaseId: number;
  result: Result;
  tester: string;
};

export type TestRun = {
  id: number;
  name: string;
  status: TestRunStatus;
  environment: string;
  version: string;
  progress: string;
  passRate: number;
  startedAt: string;
  cases: TestRunCase[];
};

export const suites: TestSuite[] = [
  { id: 1, name: "Backend API", path: "/Backend API", level: 0, parentId: null, testCaseCount: 5 },
  { id: 2, name: "Authentication API", path: "/Backend API/Authentication API", level: 1, parentId: 1, testCaseCount: 3 },
  { id: 3, name: "Checkout", path: "/Checkout", level: 0, parentId: null, testCaseCount: 4 },
  { id: 4, name: "Administrace", path: "/Administrace", level: 0, parentId: null, testCaseCount: 2 },
];

export const testCases: TestCase[] = [
  {
    id: 101,
    code: "ESHOP-TC-001",
    title: "Přihlášení platného uživatele",
    suiteId: 2,
    status: "ready",
    owner: "Jana Nováková",
    preconditions: "Uživatel má aktivní účet a dostupné testovací prostředí.",
    expectedSummary: "API vrátí access token a profil uživatele.",
    steps: [
      { id: 1, order: 1, action: "Odeslat platné přihlašovací údaje.", expected: "API vrátí access token.", data: "admin@example.com" },
      { id: 2, order: 2, action: "Načíst profil přihlášeného uživatele.", expected: "API vrátí detail uživatele." },
    ],
  },
  {
    id: 102,
    code: "ESHOP-TC-002",
    title: "Odmítnutí neplatného hesla",
    suiteId: 2,
    status: "ready",
    owner: "Petr Svoboda",
    preconditions: "Uživatel existuje v databázi.",
    expectedSummary: "API vrátí chybu 401 bez vydání tokenu.",
    steps: [
      { id: 1, order: 1, action: "Odeslat login s neplatným heslem.", expected: "API vrátí chybu 401.", data: "wrong-password" },
    ],
  },
  {
    id: 103,
    code: "ESHOP-TC-003",
    title: "Dokončení objednávky kartou",
    suiteId: 3,
    status: "ready",
    owner: "Lucie Dvořáková",
    preconditions: "Košík obsahuje produkt skladem a platební brána je v test módu.",
    expectedSummary: "Objednávka je vytvořena a platba potvrzena.",
    steps: [
      { id: 1, order: 1, action: "Přidat produkt do košíku.", expected: "Produkt je v košíku.", data: "SKU-1001" },
      { id: 2, order: 2, action: "Vyplnit dodací údaje.", expected: "Dodací údaje jsou uloženy." },
      { id: 3, order: 3, action: "Potvrdit platbu kartou.", expected: "Objednávka je vytvořena.", data: "test-card" },
    ],
  },
  {
    id: 104,
    code: "ESHOP-TC-004",
    title: "Zobrazení historie objednávek",
    suiteId: 4,
    status: "draft",
    owner: "Jana Nováková",
    preconditions: "Uživatel má alespoň jednu dokončenou objednávku.",
    expectedSummary: "Historie zobrazí objednávky se správným stavem.",
    steps: [
      { id: 1, order: 1, action: "Otevřít zákaznický účet.", expected: "Sekce účtu je dostupná." },
      { id: 2, order: 2, action: "Přejít na historii objednávek.", expected: "Zobrazí se seznam objednávek." },
    ],
  },
];

export const testRuns: TestRun[] = [
  {
    id: 201,
    name: "Smoke test E-shop",
    status: "in_progress",
    environment: "Staging",
    version: "2026.05",
    progress: "8/12",
    passRate: 82,
    startedAt: "05.05.2026 09:15",
    cases: [
      { id: 301, testCaseId: 101, result: "passed", tester: "Jana Nováková" },
      { id: 302, testCaseId: 102, result: "failed", tester: "Petr Svoboda" },
      { id: 303, testCaseId: 103, result: "not_run", tester: "Lucie Dvořáková" },
    ],
  },
  {
    id: 202,
    name: "Regression 2026.05",
    status: "open",
    environment: "QA",
    version: "2026.05",
    progress: "0/48",
    passRate: 0,
    startedAt: "Plánováno",
    cases: [{ id: 304, testCaseId: 104, result: "not_run", tester: "Jana Nováková" }],
  },
  {
    id: 203,
    name: "Hotfix checkout",
    status: "completed",
    environment: "Production shadow",
    version: "2026.04.3",
    progress: "6/6",
    passRate: 100,
    startedAt: "04.05.2026 16:40",
    cases: [{ id: 305, testCaseId: 103, result: "passed", tester: "Lucie Dvořáková" }],
  },
];


export function suiteName(suiteId: number) {
  return suites.find((suite) => suite.id === suiteId)?.name ?? "Počátek vesmíru";
}

export function resultLabel(result: Result) {
  return {
    not_run: "Nespuštěno",
    passed: "Passed",
    failed: "Failed",
    blocked: "Blocked",
    skipped: "Skipped",
  }[result];
}
