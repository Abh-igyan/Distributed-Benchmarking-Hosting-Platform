# Distributed Benchmarking and Hosting Platform

Prototype for the IICPC Summer Hackathon 2026 challenge: securely host contestant trading infrastructure, stress it with a bot fleet, collect performance/correctness metrics, and stream results to a live leaderboard.

## Current Status

This repository currently contains a working end-to-end prototype split into three main pieces:

- `submission_engine/`: FastAPI service that accepts zipped submissions, builds Docker images, runs sandboxed containers, performs readiness/correctness checks, calls the load generator, stores results, and exposes leaderboard APIs.
- `load_generator/`: Go HTTP load generator that sends concurrent order traffic to a submitted service and returns latency, throughput, success, failure, and status-code metrics.
- `frontend/`: React/Vite dashboard for upload/status/leaderboard UI work.

The current demo pipeline is:

```text
Upload zip
-> Build Docker image
-> Run isolated container
-> Health/readiness check
-> Correctness check
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
- In-memory leaderboard.
- `GET /leaderboard` endpoint.
- `WS /ws/leaderboard` live leaderboard stream.
- React/Vite frontend scaffold.

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
```

## Current Limitations

- Leaderboard storage is in memory, so results are lost when the FastAPI process restarts.
- Correctness checking currently mutates the same container that is later benchmarked.
- Docker sandboxing is a prototype and should be hardened before running untrusted code.
- The load generator is currently a single Go service, not yet a distributed fleet.
- No persistent metrics database yet.
- No message/event pipeline yet.

## Near-Term Plan

1. Finish the React dashboard:
   - upload form
   - submission status timeline
   - live leaderboard table
   - metric cards for TPS, p99 latency, correctness, and score
2. Improve correctness checking:
   - use multiple deterministic test cases
   - restart or recreate container before performance benchmark
   - add stricter validation for price-time priority
3. Improve sandboxing:
   - container timeout and cleanup
   - PID/file-descriptor limits
   - stricter CPU and memory controls
   - safer network assumptions
4. Add Docker Compose for local startup.
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
Code Upload -> Containerized Deployment -> Load Test -> Correctness Check -> Scoring -> Live Leaderboard
```

The current architecture intentionally prioritizes an end-to-end working prototype first, with clear upgrade paths for distributed systems components.
