# Setu AI - Requirements & Architectural Specification

**Product Name:** Setu AI  
**Slogan:** Breaking Communication Barriers Through Intelligent ISL Recognition  

---

## 1. Executive Summary
Setu AI is an advanced AI framework for Multimodal Continuous Indian Sign Language (ISL) Recognition using RGB Video and MediaPipe Holistic Skeleton Fusion. The framework combines RGB video features with face, hand, and body landmarks extracted via MediaPipe Holistic and fuses them using a Cross-Attention Transformer. Trained on the iSign benchmark dataset, Setu AI addresses co-articulation, temporal dependencies, and signer variability to deliver real-time sentence-level translations.

---

## 2. Core Features & Capabilities

1. **Multimodal Fusion Engine**:
   - RGB Frame Stream (Spatial appearance & context)
   - MediaPipe Holistic Landmarks (3D Pose keypoints, 21 Left/Right Hand joints, 468 Face mesh nodes)
   - Cross-Attention Transformer fusion module

2. **Hugging Face Model Integration**:
   - Configurable Hugging Face Inference API / Dedicated Endpoint client
   - Connects to user's Kaggle-trained PyTorch model (`.pth` checkpoint uploaded to Hugging Face)
   - Built-in fallback mock inferencer with continuous landmark prediction when HF offline

3. **Explainable AI (XAI)**:
   - Dynamic Cross-Attention matrix heatmap visualization (Modality split, Joint attention rankings, Temporal sequence attention)

4. **Real-time Web Workspace**:
   - Next.js 16 + React 19 + Tailwind CSS frontend
   - Live Webcam Feed with HTML5 Canvas landmark skeleton overlays (Pose & Hands)
   - Live prediction output stream with confidence meters and export tools (JSON, TXT)
   - Research & Case Study Dashboard (SDG 4, 9, 10 alignment, iSign details, related products comparison)

---

## 3. Backend REST & WebSocket Specifications (FastAPI)

- `GET /health`: Server status, loaded PyTorch model state, and Hugging Face endpoint status.
- `GET /api/model-info`: System architecture parameters (Cross-Attention heads, hidden dimensions, iSign dataset training metadata).
- `POST /api/hf-config`: Live configuration of Hugging Face Model Repository ID, API Token, and Endpoint URL.
- `GET /api/hf-config`: Retrieve current Hugging Face connection configuration.
- `POST /api/predict`: Runs multimodal inference on landmark sequence or base64 frame input, returning sentence text, confidence, token timestamps, and XAI cross-attention weights.

---

## 4. SDG & Research Alignment

- **SDG 4 – Quality Education**: Inclusive learning tools for deaf students.
- **SDG 9 – Industry, Innovation and Infrastructure**: State-of-the-art indigenous AI technology for Indian Sign Language.
- **SDG 10 – Reduced Inequalities**: Breaking communication barriers across workplaces and public services.
