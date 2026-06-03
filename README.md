# Vahini: Trading Code Benchmarking & Hosting Platform

Vahini is a benchmarking and hosting platform for evaluating contestant-submitted trading engines. It accepts source-code ZIP submissions, builds and runs them in isolated Docker containers, validates exchange correctness, drives high-concurrency order traffic with a Go load generator, persists benchmark results in PostgreSQL, and streams rankings to a React leaderboard.

The name **Vahini** means "flowing" or "stream" in Hindi and Sanskrit, reflecting the platform's focus on continuous order flow, pressure testing, and live benchmark visibility.

![Vahini overview dashboard](docs/images/vahini-overview.png)

> Screenshot status: save the Vahini overview screenshot as `docs/images/vahini-overview.png` so it renders on GitHub.

## Current Status

Vahini is a working local prototype. The end-to-end judging pipeline is implemented and running locally with Docker, FastAPI, Go, React, and PostgreSQL.

AWS deployment is **in progress**. The planned first deployment target is a single EC2 instance running the FastAPI submission engine, Go load generator, Docker sandbox runtime, and built React frontend, with PostgreSQL moved to Amazon RDS after local DB validation.

## What It Does

```text
Upload ZIP + metadata
-> Build Docker image
-> Run isolated correctness container
-> Health check + deterministic correctness checks
-> Stop correctness container
-> Start fresh benchmark container
-> Go bot fleet sends concurrent order traffic
-> Collect TPS, failures, status codes, p50/p90/p99 latency
-> Calculate composite score
-> Persist results in PostgreSQL
-> Stream live leaderboard over WebSocket
```

## Implemented Features

- FastAPI submission engine for ZIP uploads and orchestration.
- Docker-based build and container lifecycle management.
- gVisor runtime support through `runsc` for stronger sandbox isolation.
- CPU, memory, read-only filesystem, tmpfs, and no-new-privileges container limits.
- Fresh container restart between correctness checking and benchmark execution.
- Postgres-backed submission, correctness, and benchmark result persistence.
- Deterministic correctness checks for:
  - resting-order trade price
  - fill quantity
  - remaining ask state
  - invalid order rejection
- Go load generator for concurrent REST order traffic.
- Metrics collection:
  - total requests
  - successes
  - failures
  - TPS
  - error rate
  - average/min/max latency
  - p50/p90/p99 latency
  - HTTP status-code distribution
- Composite scoring from correctness and performance metrics.
- React/Vite dashboard branded as Vahini:
  - Overview
  - Submit
  - My Results
  - Leaderboard
- Live leaderboard updates via FastAPI WebSockets.
- Local recent-submission tracking in browser storage.
- Configurable backend, frontend, CORS, DB, and load-generator URLs.

## Tech Stack

```text
Frontend:          React, Vite
Submission API:    FastAPI, asyncpg
Load generator:    Go
Sandboxing:        Docker, gVisor/runsc
Database:          PostgreSQL
Realtime:          WebSockets
```

## Repository Layout

```text
.
├── frontend/              # React/Vite Vahini dashboard
├── load_generator/        # Go load generation service
├── submission_engine/     # FastAPI submission/sandbox/orchestration service
├── stress_submissions/    # Local test ZIPs for failure-mode validation
└── docs/images/           # README screenshots
```

## Local Ports

```text
FastAPI submission engine: http://localhost:8000
Go load generator:        http://localhost:8001
React frontend:           http://localhost:5173
PostgreSQL:               localhost:5432
Submission containers:    random Docker host ports
```

The frontend talks only to FastAPI. FastAPI coordinates Docker containers, PostgreSQL, and the Go load generator.

## Configuration

Submission engine environment variables:

```bash
DATABASE_URL=postgresql://iicpc:iicpc_password@localhost:5432/iicpc
LOAD_GENERATOR_URL=http://localhost:8001
CORS_ORIGINS=http://localhost:5173
```

Frontend environment variables:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/leaderboard
```

If frontend variables are not set, the dashboard defaults to local FastAPI at `http://localhost:8000`.

## Running Locally

Start PostgreSQL:

```bash
docker start iicpc-postgres
```

If the container does not exist yet:

```bash
docker run --name iicpc-postgres \
  -e POSTGRES_USER=iicpc \
  -e POSTGRES_PASSWORD=iicpc_password \
  -e POSTGRES_DB=iicpc \
  -p 5432:5432 \
  -d postgres:16
```

Start the Go load generator:

```bash
cd load_generator
go run .
```

Start the submission engine:

```bash
cd submission_engine
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Database Schema

Vahini currently uses PostgreSQL tables for persistent submission and result state:

```text
submissions
benchmark_results
correctness_checks
```

The submission table stores:

```text
id
filename
contestant_name
language
metadata
status
endpoint
error
created_at
updated_at
```

The benchmark results table stores:

```text
submission_id
total_requests
success
failures
tps
error_rate
avg_latency_ms
p50_latency_ms
p90_latency_ms
p99_latency_ms
correctness_score
score
status_codes
created_at
```

The correctness table stores check-level JSON:

```json
{
  "trade_price": true,
  "trade_quantity": true,
  "remaining_ask": true,
  "invalid_order_rejected": true
}
```

## API Surface

Submission engine:

```text
POST   /submit
GET    /status/{submission_id}
DELETE /status/{submission_id}
GET    /leaderboard
WS     /ws/leaderboard
GET    /health
```

Load generator:

```text
POST /benchmark
```

Example benchmark request:

```json
{
  "submission_id": "uuid",
  "endpoint": "http://localhost:32768",
  "concurrency": 100,
  "duration_seconds": 10
}
```

## Submission Contract

Contestant containers are expected to expose:

```text
GET  /health
POST /order
GET  /orderbook
```

Current order payload:

```json
{
  "order_type": "LIMIT",
  "side": "BUY",
  "price": 100,
  "quantity": 10
}
```

Current correctness scenario:

```text
SELL 100 x 10
BUY  105 x 4
expected trade: price 100, quantity 4
expected remaining ask: price 100, quantity 6
invalid side should be rejected with 400 or 422
```

Correctness scoring:

```text
trade price:              40 points
trade quantity:           30 points
remaining ask quantity:   20 points
invalid order rejection:  10 points
```

Composite score:

```text
success score:     35%
p99 latency score: 20%
TPS score:         20%
correctness score: 25%
```

## Stress Test Fixtures

`stress_submissions/` contains local ZIP fixtures for validating platform behavior:

```text
good.zip
slow.zip
bad_status.zip
crashing.zip
invalid_order.zip
matching_engine.zip
```

These are useful for checking latency degradation, incorrect behavior, invalid-order handling, and crash/failure paths.

## AWS Deployment Status

AWS deployment is not live yet.

Planned first AWS setup:

```text
EC2:
  - FastAPI submission engine
  - Go load generator
  - Docker daemon for sandboxed submissions
  - built React frontend served by nginx or a static server

RDS PostgreSQL:
  - submissions
  - benchmark_results
  - correctness_checks
```

Deployment considerations before going live:

- Confirm gVisor/runsc availability on the EC2 host, or provide a Docker runtime fallback.
- Replace hard-coded localhost assumptions if services are split across machines.
- Configure security groups for frontend/API access and private DB connectivity.
- Move secrets and DB URLs into environment variables.
- Add container/image cleanup policies.
- Add log collection for failed submissions and benchmark runs.

## Current Limitations

- The load generator is a single Go service, not yet a distributed fleet.
- REST order traffic is implemented; FIX and WebSocket adapters are planned but not built.
- Only limit-order traffic is currently generated during benchmark runs.
- Authentication and team/user management are not implemented.
- Sandbox hardening is prototype-level and should be reviewed before accepting truly untrusted public code.
- No object storage yet for uploaded artifacts.
- No Redpanda/Kafka or ClickHouse yet; these remain scale-up options.

## Future Work

- Add Docker Compose for local one-command startup.
- Add Go and Rust submission auto-detection.
- Add market orders, cancels, and mixed traffic profiles.
- Add richer correctness cases for price-time priority.
- Add benchmark profiles configurable from the frontend.
- Add AWS deployment scripts or Terraform.
- Add Redpanda/Kafka for benchmark metric events.
- Add ClickHouse for high-volume analytical queries.
- Add S3-compatible storage for submitted artifacts.

## Hackathon Goal

Vahini prioritizes a complete, explainable systems pipeline:

```text
Code Upload -> Containerized Deployment -> Correctness Check -> Load Test -> Scoring -> Persistent Leaderboard
```

The current architecture is intentionally practical: a working end-to-end prototype first, with clear upgrade paths toward a distributed benchmarking platform.
