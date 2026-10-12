import logging
import os
import tempfile
import time

import cv2
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from isl_infer import NoPersonDetected, get_translator

logger = logging.getLogger("setu-ai-new-model-backend")

MAX_CLIP_SECONDS = 15

app = FastAPI(
    title="Setu AI - ISL-CSLTR Model API",
    description="Backend serving the ISL-CSLTR fine-tuned model (MediaPipe pose + VideoMAE -> BART decoder, "
                 "snapped to a 101-sentence bank). See ISL_Integration_Brief.md for the full contract.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    import isl_infer
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "backend": "FastAPI",
        "model": "isl-csltr",
        "model_loaded": isl_infer._singleton is not None,
    }


@app.get("/api/model-info")
def model_info():
    translator = get_translator()
    return {
        "model_name": "isl-csltr-gan-production",
        "best_run": "adv1_s43 (GAN alignment gave no measurable benefit; kept only because it had the best validation score)",
        "architecture": "MediaPipe pose/hand landmarks + VideoMAE RGB -> Transformer encoder -> BART-base decoder, "
                        "snapped to a fixed 101-sentence bank",
        "dataset": "ISL-CSLTR (101 fixed sentences, 687 clips)",
        "sentence_bank_size": len(translator.bank),
        "held_out_test_metrics": {
            "snapped_sentence_accuracy": 0.091,
            "accuracy_95pct_ci": [0.04, 0.15],
            "bleu": 12.1,
            "wer": 0.93,
            "chance_accuracy": round(1 / len(translator.bank), 4),
        },
        "caveats": [
            "Research demo only, not reliable enough for real communication.",
            "Only recognizes the 101 sentences in the bank; anything else is snapped to the nearest known sentence.",
            "Confidence is a coarse indicator (over-confident, ECE 0.50), not a calibrated probability.",
        ],
    }


def _clip_duration_seconds(path: str) -> float:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frames = 0
    while cap.read()[0]:
        frames += 1
    cap.release()
    return frames / fps if fps else 0.0


@app.post("/api/translate")
async def translate(file: UploadFile = File(...)):
    if file.content_type and not file.content_type.startswith("video/"):
        raise HTTPException(400, f"Expected a video file, got {file.content_type}")

    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        duration = _clip_duration_seconds(tmp_path)
        if duration <= 0:
            raise HTTPException(422, "The uploaded clip has no readable frames.")
        if duration > MAX_CLIP_SECONDS:
            raise HTTPException(422, f"Clip is {duration:.1f}s, longer than the {MAX_CLIP_SECONDS}s limit. "
                                      "Please record a single sentence (about 3-6s).")

        translator = get_translator()
        start = time.time()
        try:
            result = translator.translate(tmp_path)
        except NoPersonDetected as e:
            raise HTTPException(422, str(e))
        result["timings_s"]["total"] = round(time.time() - start, 3)
        return result
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
