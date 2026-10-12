"""
ISL-CSLTR -> English inference.

Pose/video feature extraction is ported verbatim from the training notebook
(isl_csltr_full_pipeline.py, Part 3) so that inference-time features match
training-time features exactly. Do not change the math in extract_pose,
assign_hands, normalize_pose or read16 without re-validating accuracy.
"""
import os
import re
import time
import numpy as np
import cv2
import torch
import torch.nn as nn
from transformers import (
    AutoTokenizer, BartForConditionalGeneration,
    VideoMAEImageProcessor, VideoMAEModel,
)
from transformers.modeling_outputs import BaseModelOutput
from rouge_score import rouge_scorer

MAX_POSE_LEN = 450
POSE_REF_WIDTH = 300
DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_ARTIFACTS = os.path.join(_HERE, "..", "New_model_results", "results_model")

MODEL_PATH = os.environ.get("ISL_MODEL_PATH", os.path.join(_DEFAULT_ARTIFACTS, "csltr", "model.pt"))
POSE_TASK = os.environ.get("ISL_POSE_TASK", os.path.join(_DEFAULT_ARTIFACTS, "mp_models", "pose_landmarker_full.task"))
HAND_TASK = os.environ.get("ISL_HAND_TASK", os.path.join(_DEFAULT_ARTIFACTS, "mp_models", "hand_landmarker.task"))

# 60th percentile of confidence over the 99-clip held-out test set
# (New_model_results/results _Test_Validation/tande/test_predictions.csv).
# Per the integration brief, this is measured, not invented.
LOW_CONFIDENCE_CUTOFF = 0.614


# ---------------------------------------------------------------- pose (3a) --
def assign_hands(hands, a, pose_ok):
    """hands: list of (pts[21,3], handedness_label). Returns {'L': pts, 'R': pts} for the
    signer's left/right hand, matched to the nearest body wrist (pose 15 = left, 16 = right)."""
    out = {}
    if not hands:
        return out
    if pose_ok:
        lw, rw = a[15, :2], a[16, :2]
        if len(hands) == 1:
            p = hands[0][0]
            out['L' if np.linalg.norm(p[0, :2] - lw) <= np.linalg.norm(p[0, :2] - rw) else 'R'] = p
        else:
            p0, p1 = hands[0][0], hands[1][0]
            ca = np.linalg.norm(p0[0, :2] - lw) + np.linalg.norm(p1[0, :2] - rw)
            cb = np.linalg.norm(p0[0, :2] - rw) + np.linalg.norm(p1[0, :2] - lw)
            out.update({'L': p0, 'R': p1} if ca <= cb else {'L': p1, 'R': p0})
    else:  # MediaPipe handedness assumes a mirrored (selfie) image
        for p, lab in hands[:2]:
            out.setdefault('L' if lab == 'Right' else 'R', p)
    return out


def normalize_pose(arr):
    xyz, conf = arr[..., :3].copy(), arr[..., 3:4]
    sh = (xyz[:, 11] + xyz[:, 12]) / 2
    scale = np.linalg.norm((xyz[:, 0] - sh)[:, :2], axis=1)
    scale[scale < 1e-6] = 1.0
    center = sh.copy()
    center[:, 2] = 0
    xyz = (xyz - center[:, None]) / scale[:, None, None]
    return np.nan_to_num(np.concatenate([xyz, conf], -1)).astype(np.float32)


def extract_pose(path, pose_landmarker, hand_landmarker):
    """Runs the MediaPipe Tasks pipeline on a single video file and returns a
    normalized (T, 75, 4) pose array, or None if no frames/landmarks were found."""
    import mediapipe as mp
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    fps = fps if fps and 1 < fps < 240 else 25.0
    frames, i, last_ts = [], 0, -1
    pose_hits = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        h, w = fr.shape[:2]
        if w > 640:
            fr = cv2.resize(fr, (640, int(h * 640 / w)))
            h, w = fr.shape[:2]
        rgb = np.ascontiguousarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = max(int(i * 1000 / fps), last_ts + 1)
        last_ts = ts
        i += 1
        pr = pose_landmarker.detect_for_video(img, ts)
        hr = hand_landmarker.detect_for_video(img, ts)
        sx, sy = POSE_REF_WIDTH, POSE_REF_WIDTH * h / w
        a = np.zeros((75, 4), np.float32)
        pose_ok = bool(pr.pose_landmarks)
        if pose_ok:
            pose_hits += 1
            for j, lm in enumerate(pr.pose_landmarks[0][:33]):
                vis = lm.visibility if lm.visibility is not None else 1.0
                a[j] = [lm.x * sx, lm.y * sy, lm.z * sx, vis]
        hands = []
        for k, hlm in enumerate(hr.hand_landmarks or []):
            pts = np.array([[p.x * sx, p.y * sy, p.z * sx] for p in hlm[:21]], np.float32)
            lab = hr.handedness[k][0].category_name if hr.handedness and len(hr.handedness) > k and hr.handedness[k] else ''
            hands.append((pts, lab))
        for slot, pts in assign_hands(hands, a, pose_ok).items():
            off = 33 if slot == 'L' else 54
            a[off:off + 21, :3] = pts
            a[off:off + 21, 3] = 1.0
        frames.append(a)
    cap.release()
    if not frames:
        return None, 0.0
    pose_rate = pose_hits / len(frames)
    return normalize_pose(np.stack(frames)), pose_rate


# ---------------------------------------------------------------- video (3b) --
def read16(path):
    cap = cv2.VideoCapture(path)
    frs = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        h, w = f.shape[:2]
        s = 256 / min(h, w)
        frs.append(cv2.cvtColor(cv2.resize(f, (round(w * s), round(h * s))), cv2.COLOR_BGR2RGB))
    cap.release()
    if not frs:
        return None
    return [frs[k] for k in np.linspace(0, len(frs) - 1, 16).astype(int)]


# --------------------------------------------------------------------- model --
class SkeletonEncoder(nn.Module):
    def __init__(self, input_dim=300, d_model=256, nhead=4, num_layers=3, max_len=450):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, d_model)
        self.pos_embed = nn.Parameter(torch.zeros(1, max_len, d_model))
        layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, dim_feedforward=1024,
                                            batch_first=True, dropout=0.1)
        self.encoder = nn.TransformerEncoder(layer, num_layers=num_layers, enable_nested_tensor=False)

    def forward(self, x, mask):
        h = self.input_proj(x) + self.pos_embed[:, :x.shape[1], :]
        return self.encoder(h, src_key_padding_mask=~mask)


class VideoTextModel(nn.Module):
    def __init__(self, video_dim=768, skeleton_dim=256, decoder_name="facebook/bart-base"):
        super().__init__()
        self.skeleton_encoder = SkeletonEncoder(300, skeleton_dim, max_len=MAX_POSE_LEN)
        self.video_proj = nn.Linear(video_dim, skeleton_dim)
        self.video_pos_embed = nn.Parameter(torch.zeros(1, 8, skeleton_dim))
        self.decoder_model = BartForConditionalGeneration.from_pretrained(decoder_name)
        self.fusion_to_decoder = nn.Linear(skeleton_dim, self.decoder_model.config.d_model)

    def _ctx(self, vf, ps, pm):
        v = self.video_proj(vf) + self.video_pos_embed
        vm = torch.ones(v.shape[:2], dtype=torch.bool, device=v.device)
        s = self.skeleton_encoder(ps, pm)
        return self.fusion_to_decoder(torch.cat([v, s], 1)), torch.cat([vm, pm], 1)


def norm(s):
    s = re.sub(r"[^a-z0-9' ]+", " ", str(s).lower())
    return re.sub(r"\s+", " ", s).strip()


class NoPersonDetected(Exception):
    pass


class ISLTranslator:
    def __init__(self):
        ck = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
        self.bank = ck["sentence_bank"]
        self.model = VideoTextModel()
        res = self.model.load_state_dict(ck["model_state_dict"], strict=False)
        assert not res.missing_keys, f"missing weights: {res.missing_keys[:5]}"
        self.model.to(DEV).eval()
        self.tok = AutoTokenizer.from_pretrained("facebook/bart-base")
        self.vproc = VideoMAEImageProcessor.from_pretrained("MCG-NJU/videomae-base")
        self.vmae = VideoMAEModel.from_pretrained("MCG-NJU/videomae-base").to(DEV).eval()
        self.rs = rouge_scorer.RougeScorer(["rougeL"])

    def _new_landmarkers(self):
        import mediapipe as mp
        V = mp.tasks.vision
        pose = V.PoseLandmarker.create_from_options(V.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=POSE_TASK),
            running_mode=V.RunningMode.VIDEO, num_poses=1))
        hand = V.HandLandmarker.create_from_options(V.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=HAND_TASK),
            running_mode=V.RunningMode.VIDEO, num_hands=2,
            min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3,
            min_tracking_confidence=0.3))
        return pose, hand

    @torch.no_grad()
    def _video_features(self, path):
        frames = read16(path)
        if frames is None:
            return None
        px = self.vproc([frames], return_tensors="pt")["pixel_values"].to(DEV)
        hs = self.vmae(pixel_values=px).last_hidden_state.float()
        return hs.reshape(1, 8, 196, 768).mean(2).cpu().numpy()[0]

    @torch.no_grad()
    def translate(self, video_path, topk=3):
        timings = {}

        t0 = time.time()
        pose_landmarker, hand_landmarker = self._new_landmarkers()
        try:
            pose, pose_rate = extract_pose(video_path, pose_landmarker, hand_landmarker)
        finally:
            pose_landmarker.close()
            hand_landmarker.close()
        timings["pose"] = time.time() - t0
        if pose is None or pose_rate < 0.1:
            raise NoPersonDetected("No person/pose detected in this clip. Please re-record with the signer clearly visible.")

        t0 = time.time()
        vfeat = self._video_features(video_path)
        timings["videomae"] = time.time() - t0
        if vfeat is None:
            raise NoPersonDetected("Could not decode any frames from this clip.")

        t0 = time.time()
        p = torch.from_numpy(pose).reshape(len(pose), -1).float()
        if len(p) > MAX_POSE_LEN:
            p = p[np.linspace(0, len(p) - 1, MAX_POSE_LEN).astype(int)]
        ps = p[None].to(DEV)
        pm = torch.ones(1, ps.shape[1], dtype=torch.bool, device=DEV)
        vf = torch.from_numpy(vfeat).float()[None].to(DEV)

        ctx, jm = self.model._ctx(vf, ps, pm)
        g = self.model.decoder_model.generate(
            encoder_outputs=BaseModelOutput(last_hidden_state=ctx),
            attention_mask=jm.long(), max_length=64, num_beams=4)
        text = self.tok.batch_decode(g, skip_special_tokens=True)[0]

        logits = self.model.decoder_model(
            encoder_outputs=BaseModelOutput(last_hidden_state=ctx),
            attention_mask=jm.long(), decoder_input_ids=g[:, :-1]).logits
        lp = logits.log_softmax(-1).gather(-1, g[:, 1:, None]).squeeze(-1)
        m = (g[:, 1:] != self.tok.pad_token_id).float()
        confidence = float(((lp * m).sum(1) / m.sum(1).clamp(min=1)).exp())

        n = norm(text)
        scored = sorted(((self.rs.score(b, n)["rougeL"].fmeasure, b) for b in self.bank), reverse=True)
        timings["model"] = time.time() - t0

        return {
            "translation": scored[0][1],
            "raw_output": text,
            "confidence": round(confidence, 4),
            "low_confidence": confidence < LOW_CONFIDENCE_CUTOFF,
            "candidates": [{"sentence": b, "score": round(s, 4)} for s, b in scored[:topk]],
            "pose_detection_rate": round(pose_rate, 3),
            "model": "isl-csltr",
            "timings_s": {k: round(v, 3) for k, v in timings.items()},
        }


_singleton = None


def get_translator():
    global _singleton
    if _singleton is None:
        _singleton = ISLTranslator()
    return _singleton
