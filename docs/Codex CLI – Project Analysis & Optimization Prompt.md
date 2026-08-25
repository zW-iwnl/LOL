You are performing a deep technical audit of this repository.

Your goal is to understand the system first, then identify the highest-value opportunities for optimization and simplification.

## Phase 1 — Understand the project

Do NOT modify any files yet.

Inspect the repository thoroughly.

Determine:

- overall architecture
- application entry points
- major modules and their responsibilities
- critical execution paths
- data flows
- external integrations
- persistence/data-access layer
- concurrency / async behavior
- caching strategy
- configuration and environment handling
- build and deployment structure
- test strategy
- major dependencies and why they are used

Read the relevant source files rather than inferring behavior from filenames.

Trace important workflows end-to-end.

## Phase 2 — Audit

Identify concrete issues in the following areas:

### Performance
- unnecessary I/O
- redundant database/API calls
- N+1 patterns
- repeated computation
- inefficient algorithms or data structures
- excessive allocations
- blocking operations
- poor concurrency
- missing or ineffective caching
- unnecessary serialization/deserialization

### Architecture
- excessive coupling
- duplicated responsibilities
- unclear boundaries
- overly complex abstractions
- unnecessary abstraction layers
- dead or obsolete code
- duplicated logic
- problematic dependency direction

### Reliability
- race conditions
- resource leaks
- error handling gaps
- retry/timeout problems
- inconsistent state
- edge cases
- failure modes

### Maintainability
- unnecessary complexity
- large or overloaded modules/functions
- confusing control flow
- duplicated code
- inconsistent conventions
- weak typing/contracts where relevant

### Dependencies
- unnecessary dependencies
- heavyweight dependencies used for trivial functionality
- outdated architectural patterns
- opportunities to replace custom code with standard primitives

## Phase 3 — Prioritize

Do NOT optimize merely for fewer lines of code.

Prioritize improvements by:

1. expected real-world impact
2. risk
3. implementation effort
4. architectural benefit

For every significant finding provide:

- location
- current behavior
- why it is a problem
- expected impact
- proposed solution
- implementation complexity
- regression risk

Classify each recommendation as:

- CRITICAL
- HIGH
- MEDIUM
- LOW

## Phase 4 — Produce an optimization plan

Before changing anything, give me:

1. Architecture summary
2. Critical execution paths
3. Top performance bottlenecks
4. Architectural problems
5. Reliability problems
6. Dead/redundant code
7. Recommended changes ranked by ROI
8. Changes you explicitly recommend NOT making
9. Step-by-step implementation plan

Separate findings supported directly by code from hypotheses that would require profiling or production metrics to verify.

Do not make speculative performance claims without evidence.

After presenting the analysis, STOP and wait before implementing changes.