"""
FastAPI backend stub for SIH26150 DVR/NVR Forensic Recovery Tool
Run with: uvicorn backend:app --reload --port 8000

Install: pip install fastapi uvicorn python-multipart
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import hashlib
import uuid
import asyncio
import random

app = FastAPI(
    title="ForensicDVR API",
    description="Backend API for SIH26150 DVR/NVR Forensic Recovery Tool",
    version="0.9.0-prototype",
)

# Allow the frontend (file:// or localhost) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-memory store (replace with DB in production) ---
cases_db: dict = {}
jobs_db: dict = {}


# ============================================================
# MODELS
# ============================================================

class CaseCreate(BaseModel):
    case_id: Optional[str] = None
    fir_number: str
    case_name: str
    court: str
    seize_date: str
    officer: str
    unit: str
    location: Optional[str] = ""
    suspect: Optional[str] = ""
    dataset_label: str  # SYNTHETIC | PUBLIC-EXPORT | REAL-DISK
    image_source: str   # local | url | device
    image_path: str
    image_hash: Optional[str] = ""
    vendor: Optional[str] = ""


class CaseStatus(BaseModel):
    case_id: str
    name: str
    fir: str
    status: str  # pending | running | complete | error
    created_at: str
    dataset_label: str


# ============================================================
# HEALTH
# ============================================================

@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "version": "0.9.0-prototype",
        "tool": "ForensicDVR",
        "supported_vendors": [
            "Hikvision", "Dahua", "CP Plus", "Axis", "Hanwha", "Bosch"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# CASES
# ============================================================

@app.get("/cases", tags=["Cases"])
async def list_cases(limit: int = 10, offset: int = 0, q: Optional[str] = None):
    all_cases = list(cases_db.values())
    if q:
        q = q.lower()
        all_cases = [c for c in all_cases if q in c["case_id"].lower() or q in c["case_name"].lower()]
    total = len(all_cases)
    items = all_cases[offset: offset + limit]
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": [
            {
                "id": c["case_id"],
                "name": c["case_name"],
                "created_at": c["created_at"],
                "status": c["status"],
                "dataset_label": c["dataset_label"],
            }
            for c in items
        ],
    }


@app.post("/cases", status_code=201, tags=["Cases"])
async def create_case(payload: CaseCreate, background_tasks: BackgroundTasks):
    case_id = payload.case_id or f"CASE-{uuid.uuid4().hex[:8].upper()}"
    if case_id in cases_db:
        raise HTTPException(400, f"Case {case_id} already exists")

    now = datetime.now(timezone.utc).isoformat()
    case = {
        "case_id": case_id,
        "case_name": payload.case_name,
        "fir_number": payload.fir_number,
        "court": payload.court,
        "officer": payload.officer,
        "unit": payload.unit,
        "seize_date": payload.seize_date,
        "location": payload.location,
        "dataset_label": payload.dataset_label,
        "image_source": payload.image_source,
        "image_path": payload.image_path,
        "image_hash": payload.image_hash,
        "vendor": payload.vendor,
        "status": "pending",
        "created_at": now,
        "audit_log": [
            {
                "seq": 1,
                "event": "Case Created",
                "actor": payload.officer,
                "timestamp": now,
                "note": f"Case {case_id} created. FIR: {payload.fir_number}",
            }
        ],
    }
    cases_db[case_id] = case

    # Start analysis in background
    background_tasks.add_task(run_analysis, case_id)

    return {"case_id": case_id, "status": "pending"}


@app.get("/cases/{case_id}", tags=["Cases"])
async def get_case(case_id: str):
    if case_id not in cases_db:
        raise HTTPException(404, f"Case {case_id} not found")
    return cases_db[case_id]


@app.delete("/cases/{case_id}", tags=["Cases"])
async def cancel_case(case_id: str):
    if case_id not in cases_db:
        raise HTTPException(404, f"Case {case_id} not found")
    if cases_db[case_id]["status"] == "running":
        cases_db[case_id]["status"] = "cancelled"
    return {"case_id": case_id, "status": cases_db[case_id]["status"]}


# ============================================================
# RESULTS
# ============================================================

@app.get("/cases/{case_id}/results", tags=["Results"])
async def get_results(case_id: str):
    if case_id not in cases_db:
        raise HTTPException(404, f"Case {case_id} not found")
    case = cases_db[case_id]
    if case["status"] != "complete":
        raise HTTPException(409, f"Analysis not complete. Current status: {case['status']}")
    return case.get("results", {})


@app.get("/cases/{case_id}/custody", tags=["Chain of Custody"])
async def get_custody(case_id: str):
    if case_id not in cases_db:
        raise HTTPException(404, f"Case {case_id} not found")
    return {"audit_log": cases_db[case_id].get("audit_log", [])}


# ============================================================
# VERIFY
# ============================================================

class VerifyRequest(BaseModel):
    file_hash: str  # SHA-256 of uploaded report file
    case_id: Optional[str] = None


@app.post("/verify", tags=["Verify"])
async def verify_report(payload: VerifyRequest):
    """Verify a report by its SHA-256 hash."""
    results = {
        "hash_match": False,
        "signature_valid": False,
        "metadata_intact": False,
    }

    if payload.case_id and payload.case_id in cases_db:
        case = cases_db[payload.case_id]
        stored_hash = case.get("report_hash", "")
        results["hash_match"] = stored_hash == payload.file_hash
        results["signature_valid"] = case.get("report_signed", False)
        results["metadata_intact"] = results["hash_match"]
    else:
        # Demo: all pass for any 64-char hex hash
        if len(payload.file_hash) == 64:
            results = {"hash_match": True, "signature_valid": True, "metadata_intact": True}

    all_pass = all(results.values())
    return {
        "overall": "pass" if all_pass else "fail",
        "checks": results,
    }


# ============================================================
# ANALYSIS SIMULATION
# ============================================================

async def run_analysis(case_id: str):
    """Simulates the analysis pipeline."""
    case = cases_db[case_id]
    case["status"] = "running"
    now = lambda: datetime.now(timezone.utc).isoformat()

    steps = [
        ("Image Acquisition Started", "System", "Read-only acquisition initiated.", 2),
        ("SHA-256 Computed (Before)", "System", "Hash locked.", 1),
        ("Index-based Recovery Complete", "System", "18,432 frames recovered.", 3),
        ("Carve-based Recovery Complete", "System", "2,847 frames carved.", 4),
        ("Tamper Analysis Complete", "System", "3 tamper flags raised.", 2),
        ("Report Generated", "System", "case-report.pdf generated.", 1),
    ]

    for i, (event, actor, note, sleep_secs) in enumerate(steps, start=2):
        await asyncio.sleep(sleep_secs)
        entry = {
            "seq": i,
            "event": event,
            "actor": actor,
            "timestamp": now(),
            "note": note,
        }
        case["audit_log"].append(entry)

    # Store results
    fake_hash = hashlib.sha256(case_id.encode()).hexdigest()
    case["image_sha256"] = fake_hash
    case["report_hash"] = hashlib.sha256(b"report" + case_id.encode()).hexdigest()
    case["report_signed"] = False
    case["results"] = {
        "total_frames": 21847,
        "recovered": 18432,
        "tamper_flags": 3,
        "channels": 8,
        "sha256_before": fake_hash,
        "sha256_after": fake_hash,
        "hash_match": True,
        "concordance": {
            "agree": 15200,
            "recovered_deleted": 2847,
            "index_only": 415,
            "unindexed": 385,
        },
        "tamper_flags_detail": [
            {"id": "TF-001", "title": "Recording Discontinuity — Channel 3", "severity": "high"},
            {"id": "TF-002", "title": "Timestamp Rollback — Channel 5", "severity": "high"},
            {"id": "TF-003", "title": "Frame Header Corruption — Channels 1, 2", "severity": "medium"},
        ],
    }
    case["status"] = "complete"


# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)
