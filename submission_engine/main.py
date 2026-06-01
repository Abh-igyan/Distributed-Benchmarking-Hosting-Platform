from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiofiles
import asyncio
import uuid
import os
from sandbox import SandboxManager
import httpx

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173"
).split(",")

LOAD_GENERATOR_URL = os.getenv(
    "LOAD_GENERATOR_URL",
    "http://localhost:8001"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
sandbox=SandboxManager()
leaderboard={}
websocket_clients=set()

SUBMISSION_DIR = "/tmp/iicpc_submissions"
os.makedirs(SUBMISSION_DIR, exist_ok=True)

async def background_deploy(submission_id, zip_path, metadata):
    try:
        image_tag = await sandbox.build(submission_id, zip_path)
        sandbox.containers[submission_id]["status"] = "starting_correctness"

        async with httpx.AsyncClient() as client:
            correctness_endpoint = await sandbox.run(
                submission_id,
                image_tag,
                purpose="correctness",
            )
            sandbox.containers[submission_id]["status"] = "checking_correctness"

            await wait_for_health(client, correctness_endpoint)
            correctness_score = await run_correctness_check(client, correctness_endpoint)

            sandbox.containers[submission_id]["status"] = "restarting_for_benchmark"
            await asyncio.to_thread(sandbox.stop_container, submission_id)

            benchmark_endpoint = await sandbox.run(
                submission_id,
                image_tag,
                purpose="benchmark",
            )
            sandbox.containers[submission_id]["status"] = "starting_benchmark"
            await wait_for_health(client, benchmark_endpoint)

            go_payload={
                "submission_id": submission_id,
                "endpoint": benchmark_endpoint,
                "concurrency": 100,         # Dynamically spin up 100 bot loops
                "duration_seconds": 10      # Storm target for 15 seconds
            }
            sandbox.containers[submission_id]["status"]="benchmarking"
            response=await client.post(
                f"{LOAD_GENERATOR_URL}/benchmark",
                json=go_payload,
                timeout=go_payload["duration_seconds"]+20
            )
            if response.status_code==200:
                print(f"[{submission_id}] Successfully handed off to Go Load Generator.")
                
                result=response.json()
                result["submission_id"] = submission_id
                result.update(metadata)
                result["correctness_score"] = correctness_score["score"]
                result["correctness_checks"]= correctness_score["checks"]
                result["score"] = calculate_score(result, correctness_score["score"])
                leaderboard[submission_id]=result
                sandbox.containers[submission_id]["status"]="completed"
                sandbox.containers[submission_id]["result"]=result
                await broadcast_leaderboard()
            else:
                print(f"[{submission_id}] Go load generator rejected request: {response.text}")
                sandbox.containers[submission_id]["status"] = "failed_handoff"



    except Exception as e:
        print(f"[{submission_id}] Deployment failed: {str(e)}")
        existing_data = sandbox.containers.get(submission_id, {})
        existing_data.update({"status": "failed", "error": str(e)})
        sandbox.containers[submission_id] = existing_data
    finally:
        await asyncio.to_thread(sandbox.stop_container, submission_id)

@app.post("/submit")
async def submit_code(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    contestant_name: str = Form("Anonymous"),
    language: str = Form("Unspecified"),
):
    if file.filename is None or not file.filename.endswith(".zip"):
        raise HTTPException(400, "Only .zip files accepted")
    submission_id=str(uuid.uuid4())
    save_path=f"{SUBMISSION_DIR}/{submission_id}"
    os.makedirs(save_path,exist_ok=True)

    zip_path=f"{save_path}/code.zip"
    async with aiofiles.open(zip_path,'wb') as f:
        while chunk := await file.read(1024* 1024):
            await f.write(chunk)
    metadata = {
        "contestant_name": contestant_name.strip() or "Anonymous",
        "language": language.strip() or "Unspecified",
    }

    sandbox.containers[submission_id]={"status": "building", **metadata}
    background_tasks.add_task(background_deploy, submission_id, zip_path, metadata)

    # 5. Instantly return a success response to the client
    return JSONResponse({
        "submission_id": submission_id,
        **metadata,
        "status": "queued",
        "message": "Your code is being extracted and built."
    })
    
    
@app.get("/status/{submission_id}")
async def get_status(submission_id: str):
    status=sandbox.get_status(submission_id)
    if not status:
        raise HTTPException(404,"submission not found")
    return status

@app.delete("/status/{submission_id}")
async def stop_submission(submission_id : str):
    sandbox.stop_container(submission_id)
    if submission_id in sandbox.containers:
        sandbox.containers[submission_id]["status"] = "stopped"
    return {"message": f"Submission {submission_id} stopped"}

@app.get("/health")
async def health():
    return {"health": "ok"}



# normal API for fetching leaderboard manually
@app.get("/leaderboard")
async def get_leaderboard():
    return sorted(
        leaderboard.values(), 
        key=lambda x: x.get("score",0),
        reverse=True
    )


# sends latest leaderboard to every connected frontend
async def broadcast_leaderboard():
    data= await get_leaderboard()
    dead_clients=[]

    for ws in websocket_clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead_clients.append(ws)
    for ws in dead_clients:
        websocket_clients.discard(ws)



# live connection for automatic leaderboard updates
@app.websocket("/ws/leaderboard")
async def leaderboard_ws(websocket : WebSocket):
    await websocket.accept()
    websocket_clients.add(websocket)
    try:
        await websocket.send_json(await get_leaderboard())
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        websocket_clients.discard(websocket)

async def run_correctness_check(client, endpoint):
    try:
        # Place resting sell order
        r1 = await client.post(
            endpoint + "/order",
            json={
                "order_type": "LIMIT",
                "side": "SELL",
                "price": 100,
                "quantity": 10
            },
            timeout=5
        )

        # Place crossing buy order
        r2 = await client.post(
            endpoint + "/order",
            json={
                "order_type": "LIMIT",
                "side": "BUY",
                "price": 105,
                "quantity": 4
            },
            timeout=5
        )
        invalid_order=await client.post(
            endpoint+"/order",
            json={
                "order_type": "LIMIT",
                "side": "NOPE",
                "price": 99,
                "quantity": 1
            },
            timeout=5
        )

        # Inspect orderbook
        r3 = await client.get(endpoint + "/orderbook", timeout=5)
        if r1.status_code not in (200, 201) or r2.status_code not in (200, 201) or r3.status_code != 200:
            return {
                "score": 0.0,
                "checks": {},
            }

        book = r3.json()
        asks = book.get("asks", [])
        trades = book.get("trades", [])

        score = 0.0

        # Expected: buy should match against sell at resting sell price 100
        if trades and trades[-1].get("price") == 100:
            score += 40

        if trades and trades[-1].get("quantity") == 4:
            score += 30

        # Expected remaining ask: 6 quantity at price 100
        if asks and asks[0].get("price") == 100 and asks[0].get("quantity") == 6:
            score += 20
        if invalid_order.status_code in (400,422):
            score+=10

        return {
            "score": score,
            "checks": {
                "trade_price": trades and trades[-1].get("price") == 100,
                "trade_quantity": trades and trades[-1].get("quantity") == 4,
                "remaining_ask": asks and asks[0].get("price") == 100 and asks[0].get("quantity") == 6,
                "invalid_order_rejected": invalid_order.status_code in (400,422)
            }
        }

    except Exception:
        return {
            "score": 0.0,
            "checks": {},
        }

async def wait_for_health(client, endpoint):
    for _ in range(30):
        try:
            resp = await client.get(endpoint + "/health", timeout=5)
            if resp.status_code == 200:
                return
        except Exception:
            pass
        await asyncio.sleep(1)
    raise Exception("Container health check failed")
    
def calculate_score(result, correctness_score):
    error_rate = result.get("error_rate", 100)
    p99 = result.get("p99_latency_ms", 9999)
    tps = result.get("tps", 0)

    success_score = max(0, 100 - error_rate)
    latency_score = max(0, 100 - p99)
    tps_score = min(100, tps / 100)

    return (
        success_score * 0.35 +
        latency_score * 0.20 +
        tps_score * 0.20 +
        correctness_score * 0.25
    )
