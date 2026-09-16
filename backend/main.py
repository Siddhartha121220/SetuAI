from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import time
import os

from hf_client import HuggingFaceISLClient

app = FastAPI(
    title="Setu AI - Multimodal ISL Recognition API",
    description="Backend API powering Setu AI: Multimodal Continuous ISL Recognition using RGB Video and MediaPipe Holistic Skeleton Fusion with Cross-Attention Transformer.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

hf_client = HuggingFaceISLClient()

# Schemas
class LandmarkNode(BaseModel):
    x: float
    y: float
    z: Optional[float] = 0.0
    visibility: Optional[float] = 1.0

class FrameLandmarks(BaseModel):
    frame_index: Optional[int] = 0
    pose: Optional[List[LandmarkNode]] = []
    left_hand: Optional[List[LandmarkNode]] = []
    right_hand: Optional[List[LandmarkNode]] = []
    face: Optional[List[LandmarkNode]] = []

class PredictRequest(BaseModel):
    keypoints_sequence: Optional[List[FrameLandmarks]] = []
    model_source: Optional[str] = "huggingface"
    sample_phrase: Optional[str] = None

class HFConfigPayload(BaseModel):
    hf_model_id: Optional[str] = None
    hf_api_token: Optional[str] = None
    custom_endpoint_url: Optional[str] = None

@app.get("/")
def read_root():
    return {
        "name": "Setu AI API Server",
        "status": "online",
        "slogan": "Breaking Communication Barriers Through Intelligent ISL Recognition",
        "version": "1.0.0",
        "huggingface_model_id": hf_client.model_id
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "backend": "FastAPI",
        "model_loaded": True,
        "hf_connected": bool(hf_client.api_token and hf_client.model_id),
        "hf_model_id": hf_client.model_id
    }

@app.get("/api/model-info")
def get_model_info():
    return {
        "model_name": "Setu-CrossAttention-Transformer-v1",
        "architecture": "Multimodal Cross-Attention Transformer (RGB + MediaPipe Holistic)",
        "backbone": "MediaPipe Holistic Keypoints (Pose, Hands, Face) + ResNet/ViT RGB Features",
        "dataset": "iSign – Large-Scale Continuous Indian Sign Language Dataset",
        "input_features": {
            "pose_landmarks": 33,
            "hand_landmarks": 42,  # 21 per hand
            "face_mesh_landmarks": 468,
            "rgb_embedding_dim": 512,
            "fused_embedding_dim": 768
        },
        "transformer_config": {
            "encoder_layers": 6,
            "decoder_layers": 6,
            "attention_heads": 8,
            "dropout": 0.1,
            "temporal_window": "30-60 frames"
        },
        "sdg_mapping": [
            {"sdg": 4, "title": "Quality Education", "impact": "Inclusive classroom translation for deaf students"},
            {"sdg": 9, "title": "Industry, Innovation and Infrastructure", "impact": "Indigenous ISL AI framework for India"},
            {"sdg": 10, "title": "Reduced Inequalities", "impact": "Equal access in workplaces, healthcare & governance"}
        ],
        "novelty": [
            "Multimodal RGB + MediaPipe Holistic Fusion",
            "Cross-Attention Transformer Architecture",
            "Continuous Sentence-level ISL Recognition",
            "Explainable AI (XAI) Attention Heatmap Visualizer",
            "iSign Benchmark Dataset Optimization"
        ]
    }

@app.get("/api/hf-config")
def get_hf_config():
    return {
        "model_id": hf_client.model_id,
        "has_api_token": bool(hf_client.api_token),
        "custom_endpoint": hf_client.custom_endpoint,
        "instructions": "Upload your Kaggle trained .pth model to Hugging Face Model Hub or Inference Endpoints and paste your Model ID & API Token here."
    }

@app.post("/api/hf-config")
def update_hf_config(payload: HFConfigPayload):
    hf_client.update_config(
        model_id=payload.hf_model_id,
        api_token=payload.hf_api_token,
        custom_endpoint=payload.custom_endpoint_url
    )
    return {
        "status": "updated",
        "model_id": hf_client.model_id,
        "has_api_token": bool(hf_client.api_token),
        "custom_endpoint": hf_client.custom_endpoint
    }

@app.post("/api/predict")
def predict_isl(request: PredictRequest):
    start_time = time.time()
    
    # Process request using HF Client (with fallback to PyTorch trained model inferencer)
    landmarks_data = [f.model_dump() for f in request.keypoints_sequence] if request.keypoints_sequence else []
    
    result = hf_client.predict(landmarks_data)
    
    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    result["latency_ms"] = elapsed_ms
    
    return result

@app.post("/api/xai-explain")
def get_xai_explanation(request: PredictRequest):
    """
    Returns XAI attention matrix weights and modality importance maps for visualization.
    """
    landmarks_data = [f.model_dump() for f in request.keypoints_sequence] if request.keypoints_sequence else []
    result = hf_client.predict(landmarks_data)
    return {
        "translated_text": result.get("translated_text"),
        "xai_weights": result.get("xai_weights")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
