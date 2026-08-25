You are performing a deep database architecture, schema, and performance audit of this repository.

Your goal is to understand how the application uses the database, identify real performance and data-model issues, and produce a prioritized optimization plan.

Do NOT modify any files, migrations, schemas, indexes, constraints, or queries yet.

## Phase 1 — Understand the database architecture

Inspect the repository thoroughly and determine:

- database engine(s) and version assumptions
- ORM / query builder / raw SQL usage
- database configuration
- connection pooling
- transaction handling
- migration system
- schema definitions
- tables, views, materialized views, sequences, triggers, procedures, and functions
- relationships between entities
- foreign keys
- primary keys
- unique constraints
- indexes
- partitioning
- generated/computed columns
- JSON / JSONB / array / blob usage
- soft-delete patterns
- audit/history tables
- caching related to database access
- read/write separation or replicas
- background jobs touching the DB
- batch-processing patterns

Do not infer schema behavior only from ORM models.

Inspect migrations, raw SQL, repository/service code, and actual query construction.

Build a mental model of:

1. the logical data model
2. the physical schema
3. the most important read paths
4. the most important write paths
5. high-volume tables
6. frequently joined tables
7. frequently filtered/sorted columns

## Phase 2 — Map application queries to tables

Trace important workflows end-to-end.

For each important table determine:

- where it is read
- where it is written
- common WHERE predicates
- JOIN columns
- ORDER BY columns
- GROUP BY columns
- pagination strategy
- expected cardinality
- expected row growth
- update frequency
- delete behavior
- whether the workload is read-heavy or write-heavy

Identify query patterns that appear frequently or are likely to operate over large datasets.

Do not assume a query is slow purely because it looks complex.

Separate:

- issues proven directly from code/schema
- likely issues
- hypotheses requiring EXPLAIN / EXPLAIN ANALYZE / production metrics

## Phase 3 — Audit table design

For every significant table evaluate:

### Primary keys

Check for:

- missing primary keys
- unnecessarily wide primary keys
- poor composite primary keys
- UUID vs integer tradeoffs
- random UUID insertion impact
- sequence usage
- key choice causing index bloat or poor locality

Do not recommend changing primary keys unless the practical benefit outweighs migration risk.

### Data types

Identify:

- oversized VARCHAR/TEXT usage where relevant
- incorrect integer widths
- numeric/decimal misuse
- inefficient timestamp/date representation
- timezone problems
- boolean/state representations
- unnecessary JSON storage
- data stored as strings that should be structured
- duplicated derived values
- nullable columns that should not be nullable

Estimate storage/performance implications where possible.

### Normalization

Check for:

- unnecessary duplication
- repeated attributes
- update anomalies
- excessive normalization creating expensive join chains
- EAV-style anti-patterns
- tables that should potentially be merged or split

Do NOT recommend normalization or denormalization without explaining the workload tradeoff.

### Constraints

Check:

- missing NOT NULL
- missing UNIQUE
- missing CHECK constraints
- weak referential integrity
- orphaned-data risk
- business invariants enforced only in application code

## Phase 4 — Index audit

Perform a detailed index analysis.

For each table identify:

- existing indexes
- columns covered
- index order
- unique vs non-unique
- single-column vs composite
- overlapping indexes
- duplicate indexes
- likely unused indexes
- indexes implied by PK/FK constraints
- write overhead caused by indexes

Identify potentially missing indexes based on actual query patterns.

Evaluate especially:

- WHERE predicates
- JOIN keys
- ORDER BY
- GROUP BY
- DISTINCT
- partial indexes
- expression/function indexes
- covering indexes
- INCLUDE columns where supported

For composite indexes, explicitly reason about:

- column order
- selectivity
- equality vs range predicates
- ORDER BY compatibility
- leftmost-prefix behavior

Do not propose an index simply because a column appears in a WHERE clause.

For every proposed index explain:

- exact query/query family it helps
- why the current index set is insufficient
- proposed column order
- whether it can become a covering index
- expected read benefit
- expected write/storage cost
- confidence level

Also identify indexes that could potentially be removed.

Never recommend dropping an index without proving that it is redundant or requesting usage statistics.

## Phase 5 — Query performance audit

Identify:

### N+1 queries

Find ORM/service patterns where one query triggers additional queries per row.

Show the exact execution path.

Recommend:

- eager loading
- joins
- batching
- prefetching
- IN queries
- restructuring

depending on the workload.

### Redundant queries

Look for:

- repeated identical queries
- queries retrieving data already loaded
- unnecessary existence checks
- repeated aggregates
- count queries used inefficiently
- duplicate joins
- redundant subqueries

### Over-fetching

Identify:

- SELECT *
- loading large entities when only a few fields are required
- unnecessary relations
- large TEXT / JSON / BLOB fields fetched unnecessarily

### Expensive query structures

Look for:

- correlated subqueries
- unnecessary DISTINCT
- unnecessary GROUP BY
- OR predicates that defeat indexes
- functions applied to indexed columns
- implicit casts
- wildcard searches
- leading-wildcard LIKE
- inefficient NOT IN / NOT EXISTS patterns
- poorly structured joins
- unnecessary CTE materialization where relevant
- repeated window functions

Do not rewrite queries for aesthetics.

Only recommend changes with a clear optimizer/runtime reason.

## Phase 6 — Pagination audit

Find all pagination patterns.

Check for:

- OFFSET/LIMIT over large tables
- unstable ordering
- missing deterministic secondary sort
- expensive COUNT(*)
- pagination after joining large datasets

Identify where keyset/cursor pagination would be more efficient.

For each candidate give the proposed cursor key.

Example:

WHERE (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT ?

Explain why it is safe and deterministic.

## Phase 7 — Foreign keys and relationships

Audit foreign keys for:

- missing indexes on referencing columns
- cascading delete/update risks
- excessive cascading
- missing referential integrity
- cyclic dependencies
- heavy many-to-many tables
- junction-table indexing

For junction tables, evaluate whether they should typically have:

- composite primary/unique key
- index in the reverse lookup direction

Example:

PRIMARY KEY (user_id, role_id)

and potentially:

INDEX (role_id, user_id)

depending on query patterns.

## Phase 8 — Large and growing tables

Identify tables likely to grow significantly.

Estimate risk from:

- table scans
- index growth
- vacuum/maintenance pressure
- dead tuples where relevant
- fragmentation
- historical data
- event/log tables

Evaluate whether any table could benefit from:

- partitioning
- archival
- retention policy
- aggregation tables
- materialized views

Do not recommend partitioning unless there is a concrete operational reason.

## Phase 9 — JSON / semi-structured data

Audit JSON/JSONB usage.

Determine:

- what data is stored in JSON
- how it is queried
- whether properties are indexed
- whether frequently accessed fields should be real columns
- whether JSON is being used as an escape hatch around schema design

Where appropriate evaluate:

- GIN/GiST indexes
- expression indexes
- generated columns

Do not automatically replace JSON with relational columns.

## Phase 10 — Transactions and locking

Inspect transaction boundaries.

Look for:

- transactions held open too long
- database calls combined with external API calls inside transactions
- unnecessary transaction scope
- inconsistent lock ordering
- SELECT ... FOR UPDATE usage
- potential deadlocks
- high-contention rows
- counters updated centrally
- lost-update risk
- incorrect isolation assumptions

Identify operations where optimistic concurrency could be preferable.

## Phase 11 — Write performance

Analyze inserts and updates.

Look for:

- row-by-row inserts instead of batches
- unnecessary updates
- updating unchanged values
- excessive index maintenance
- repeated upserts
- heavy ON CONFLICT patterns
- large transactions
- expensive triggers
- hot rows
- ORM flush patterns

Evaluate bulk operations where appropriate.

## Phase 12 — Aggregations and reporting

Identify expensive:

- COUNT
- SUM
- GROUP BY
- DISTINCT
- dashboard/report queries

Determine whether they could benefit from:

- indexes
- preaggregation
- summary tables
- materialized views
- incremental aggregation
- caching

Avoid introducing materialized data unless query volume justifies the consistency complexity.

## Phase 13 — Connection and runtime configuration

Inspect application/database configuration for:

- pool size
- connection lifetime
- idle connections
- acquisition timeout
- statement timeout
- transaction timeout
- retry behavior
- prepared statements
- batch size
- ORM fetch size

Flag suspicious settings, but clearly distinguish repository evidence from recommendations requiring production workload metrics.

## Phase 14 — Schema cleanup

Identify:

- obsolete tables
- obsolete columns
- duplicate columns
- legacy relationships
- unused indexes
- abandoned migrations/features
- data fields written but never read
- fields read but apparently never populated

Do NOT recommend deletion until usage has been proven.

Mark cleanup candidates separately.

## Phase 15 — Rank tables by risk

Create a table ranking the most important database tables by:

- expected size
- read frequency
- write frequency
- query complexity
- index quality
- contention risk
- growth risk
- optimization potential

Use:

CRITICAL
HIGH
MEDIUM
LOW

## Phase 16 — Optimization recommendations

For every significant recommendation provide:

### Finding
Describe the issue.

### Location
Specify:

- table
- columns
- query
- source files/functions using it

### Evidence
Explain exactly what evidence in the repository supports the finding.

### Impact
Describe expected effects on:

- latency
- CPU
- I/O
- memory
- storage
- write amplification
- lock contention

### Proposed change
Provide the concrete recommended change.

Where relevant include example SQL such as:

CREATE INDEX ...

ALTER TABLE ...

but do NOT execute or apply anything.

### Tradeoffs
Explain:

- write cost
- storage cost
- migration risk
- operational risk
- compatibility implications

### Validation
Specify how the recommendation should be verified.

Examples:

EXPLAIN (ANALYZE, BUFFERS)

index usage statistics

slow-query logs

production tracing

query latency percentiles

table/index size statistics

lock statistics

### Priority

Classify as:

CRITICAL
HIGH
MEDIUM
LOW

### Confidence

Classify as:

HIGH CONFIDENCE
MEDIUM CONFIDENCE
HYPOTHESIS

## Phase 17 — Final report

Produce the final report in this structure:

# Database Architecture Summary

Summarize the database architecture and major access patterns.

# Schema Map

List important tables and their relationships.

# Critical Tables

Identify the tables most important for performance and reliability.

# Critical Findings

Issues that should be addressed first.

# Index Audit

Include:

- missing index candidates
- redundant/overlapping index candidates
- incorrect composite-index ordering
- covering-index opportunities

# Query Audit

List problematic query patterns and their locations.

# Table Design Issues

List schema/type/normalization/constraint issues.

# Transaction and Concurrency Risks

List locking, transaction, race-condition, and contention issues.

# Scaling Risks

Identify what is likely to become problematic as data grows by:

10x
100x

# Recommended Optimizations

Rank recommendations by ROI:

1. highest-value change
2. second-highest
3. etc.

For each estimate:

Impact: HIGH / MEDIUM / LOW
Effort: HIGH / MEDIUM / LOW
Risk: HIGH / MEDIUM / LOW

# Recommended Index Changes

Provide proposed SQL, but DO NOT execute it.

Separate into:

ADD
MODIFY / REPLACE
POSSIBLE REMOVAL

# Recommended Schema Changes

Provide proposed changes and migration implications.

# Profiling Required

List every hypothesis that cannot be proven from static repository analysis.

For each one, specify exactly what metric or EXPLAIN output should be collected.

# Things NOT to Optimize

Identify areas where optimization would add complexity without meaningful benefit.

# Implementation Plan

Create a safe step-by-step sequence for implementing the recommendations.

Prefer:

1. measurement
2. low-risk indexes/query fixes
3. validation
4. schema changes
5. larger architectural changes

Include rollback and validation considerations.

---

## Critical rules

Do NOT modify the database or repository during this audit.

Do NOT create migrations.

Do NOT blindly add indexes.

Do NOT assume that more indexes are better.

Do NOT recommend schema redesign based only on theoretical normalization.

Do NOT claim a query is slow unless supported by evidence or explicitly label it as a hypothesis.

Do NOT make production-cardinality assumptions without marking them as assumptions.

Prefer improvements with measurable impact over stylistic database cleanup.

For every recommendation consider BOTH read performance and write cost.

Whenever repository evidence is insufficient, explicitly state what production data is required to decide correctly.

After completing the audit and optimization plan, STOP. Do not implement any changes.