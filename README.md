# IICPC Distributed Benchmarking Platform

Prototype for the IICPC Summer Hackathon 2026 challenge: securely host contestant trading infrastructure, stress it with a bot fleet, collect performance/correctness metrics, and stream results to a live leaderboard.

## Current Status

This repository contains a working end-to-end prototype split into three main services:

- `submission_engine/`: FastAPI service that accepts zipped submissions, builds Docker images, runs sandboxed containers, performs readiness/correctness checks, calls the load generator, stores results, and exposes leaderboard APIs.
- `load_generator/`: Go HTTP load generator that sends concurrent order traffic to a submitted service and returns latency, throughput, success, failure, and status-code metrics.
- `frontend/`: React/Vite dashboard with separate sections for package submission, contestant result tracking, and the live leaderboard.

The current demo pipeline is:

```text
Contestant submits zip + metadata
-> Build Docker image
-> Run isolated correctness container
-> Health/readiness check + deterministic correctness checks
-> Restart into benchmark container
-> Go load generator sends orders
-> FastAPI calculates score
-> Leaderboard API/WebSocket updates clients
```

## Implemented

- Zip upload endpoint in FastAPI.
- Docker image build from uploaded submission source.
- Container run with basic sandbox limits.
- Health/readiness check before benchmarking.
- Deterministic correctness check using order placement and `/orderbook`.
- Separate correctness and benchmark container phases.
- Go load generator with concurrent bot loops.
- Metrics collection:
  - total requests
  - successes
  - failures
  - TPS
  - error rate
  - average/min/max latency
  - p50/p90/p99 latency
  - HTTP status-code counts
- Python-side composite scoring.
- Optional contestant/team name and language metadata for submissions.
- In-memory leaderboard.
- `GET /leaderboard` endpoint.
- `WS /ws/leaderboard` live leaderboard stream.
- React/Vite console dashboard:
  - Submit view
  - My Results view
  - Live Leaderboard view
  - local recent-submission tracking
  - WebSocket connection status
- Configurable load generator URL, CORS origins, frontend API URL, and frontend WebSocket URL.

## Repository Layout

```text
.
├── frontend/              # React/Vite dashboard
├── load_generator/        # Go load generation service
└── submission_engine/     # FastAPI submission/sandbox/orchestration service
```

## Local Ports

```text
FastAPI submission engine: http://localhost:8000
Go load generator:        http://localhost:8001
React frontend:           http://localhost:5173
Submission containers:    random Docker host ports
```

The frontend should call FastAPI only. FastAPI coordinates Docker containers and the Go load generator.

## Configuration

Submission engine environment variables:

```bash
LOAD_GENERATOR_URL=http://localhost:8001
CORS_ORIGINS=http://localhost:5173
```

Docker Compose or service-network example:

```bash
LOAD_GENERATOR_URL=http://load-generator:8001
CORS_ORIGINS=http://localhost:5173,http://frontend:5173
```

Frontend environment variables:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/leaderboard
```

If the frontend variables are not set, the dashboard defaults to local FastAPI at `http://localhost:8000`.

## Backend API

Submission engine:

```text
POST /submit
GET  /status/{submission_id}
DELETE /status/{submission_id}
GET  /leaderboard
WS   /ws/leaderboard
GET  /health
```

`POST /submit` accepts `multipart/form-data`:

```text
file: zipped submission artifact
contestant_name: optional team/contestant label
language: optional language label
```

Load generator:

```text
POST /benchmark
```

Expected benchmark request:

```json
{
  "submission_id": "uuid",
  "endpoint": "http://localhost:32768",
  "concurrency": 100,
  "duration_seconds": 10
}
```

## Running Locally

Prerequisites:

- Docker available to the submission engine.
- Python dependencies from `submission_engine/requirements.txt`.
- Go installed for the load generator.
- Node/npm installed for the Vite dashboard.
- `runsc`/gVisor available if using the current sandbox runtime setting.

Start the Go load generator:

```bash
cd load_generator
go run .
```

Start the submission engine:

```bash
cd submission_engine
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
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

## Frontend Dashboard

The dashboard is organized so future sections can be added or removed cleanly:

- `Submit`: upload a `.zip`, enter contestant/team name, choose language, and enqueue a run.
- `My Results`: track one selected submission, including status, score, correctness, TPS, success rate, latency, failures, and deterministic correctness checks.
- `Leaderboard`: view live ranked benchmark results streamed from the backend WebSocket.

Recent submissions are stored in browser local storage so contestants can switch between their latest local runs.

## Submission Contract

Contestant containers are expected to expose:

```text
GET  /health
POST /order
GET  /orderbook
```

Current order payload shape:

```json
{
  "order_type": "LIMIT",
  "side": "BUY",
  "price": 100,
  "quantity": 10
}
```

The correctness checker currently validates a simple crossing-order scenario:

```text
SELL 100 x 10
BUY  105 x 4
expected trade: price 100, quantity 4
expected remaining ask: price 100, quantity 6
invalid side should be rejected with 400 or 422
```

Correctness scoring currently checks:

```text
trade price:              40 points
trade quantity:           30 points
remaining ask quantity:   20 points
invalid order rejection:  10 points
```

The benchmark score combines load-generator metrics and correctness:

```text
success score:     35%
p99 latency score: 20%
TPS score:         20%
correctness score: 25%
```

## Current Limitations

- Leaderboard storage is in memory, so results are lost when the FastAPI process restarts.
- Docker sandboxing is a prototype and should be hardened before running untrusted code.
- The load generator is currently a single Go service, not yet a distributed fleet.
- No persistent metrics database yet.
- No message/event pipeline yet.
- Contestant identity is lightweight metadata only; there is no authentication/user system yet.
- Recent submissions in the frontend are local to one browser.

## Near-Term Plan

1. Improve correctness checking:
   - use multiple deterministic test cases
   - add stricter validation for price-time priority
   - report richer check-level failure messages
2. Improve sandboxing:
   - container timeout and cleanup
   - PID/file-descriptor limits
   - stricter CPU and memory controls
   - safer network assumptions
3. Add Docker Compose for local startup.
4. Add persistent storage:
   - submissions
   - contestant/team records
   - leaderboard results
   - benchmark artifacts
5. Add architecture document covering:
   - services
   - data flow
   - scoring model
   - sandboxing strategy
   - scale-up design

## Future Scale-Up Plan

For the hackathon prototype, FastAPI memory is enough to prove the complete pipeline. For a production-grade distributed design:

- Redpanda/Kafka for benchmark metric events.
- ClickHouse for high-volume analytical queries.
- Redis for live leaderboard cache/pub-sub.
- Kubernetes jobs/pods for distributed bot fleets.
- Object storage for uploaded submissions and benchmark artifacts.
- Postgres for submission metadata and user/team records.

## Hackathon Goal

The main objective is to demonstrate a complete, understandable, high-signal pipeline:

```text
Code Upload -> Containerized Deployment -> Correctness Check -> Load Test -> Scoring -> Live Leaderboard
```

The current architecture intentionally prioritizes an end-to-end working prototype first, with clear upgrade paths for distributed systems components.
