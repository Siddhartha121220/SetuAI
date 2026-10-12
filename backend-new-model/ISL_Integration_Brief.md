# ISL → English: Integration Brief for the Coding Agent

**Goal:** replace the old iSign v7 model behind the existing webcam web app with the new ISL-CSLTR model, without breaking the app's UI or API contract.

Read this whole file before changing anything. Section 9 lists the open items and Section 10 lists what must be inspected in the app first, because this brief does not describe the app's own code.

---

## 1. What changed and what to expect

| | Old (live now) | New |
|---|---|---|
| Model repo | `Siddhartha121220/isign-v7-production` | `Siddhartha121220/isl-csltr-gan-production` (private, needs `HF_TOKEN`) |
| Task | open-vocabulary ISL → English | the same network, fine-tuned on ISL-CSLTR (101 fixed sentences) |
| Pose extractor | legacy MediaPipe | **MediaPipe Tasks API** (`pose_landmarker_full` + `hand_landmarker`) |
| Output | free text | free text **plus** a snapped sentence from the 101-sentence bank, a confidence, and top-k candidates |

**Honest performance (99-clip held-out test set):**
- Snapped sentence accuracy is **9.1%**, with a 95% CI of 4–15%. BLEU is 12.1 and WER is 0.93.
- Chance is 1/101, about 1%. The model is clearly above chance but is **not reliable enough to present as real communication**.
- The UI must frame this as a research demo. It should show the top-3 candidates and a confidence value, and it should be able to say "not sure".
- The model only knows 101 sentences. Anything else signed will be snapped to the nearest known sentence, which is often wrong. The UI should show the supported-sentence list.
- The GAN modality-alignment component gave no benefit. The deployed checkpoint is simply whichever run had the best validation score (`best_run` in the checkpoint). Do not describe it as GAN-improved.

---

## 2. Artifacts (what exists, where)

HF model repo `Siddhartha121220/isl-csltr-gan-production` (private) contains:
- `model.pt`, a dict with:
  - `model_state_dict`, the full weights
  - `config`, with `max_pose_len=450`, `pose_ref_width=300`, `pose_subsample='uniform'`, and others
  - `sentence_bank`, the sorted list of 101 normalised sentences
  - `best_run`
- `results.csv`, `summary.json`, `manifest.csv`
- After the T&E notebook: `tande/` (`tande_report.json`, `scorecard.csv`, `robustness.csv`, `test_predictions.csv`, `drift_reference.json`, `data_card.md`) and `README.md` (the model card).

Other files needed at runtime, downloaded at startup and cached:
- `MCG-NJU/videomae-base` (HF, public), used frozen as the video feature extractor
- `facebook/bart-base` tokenizer and architecture (HF, public)
- MediaPipe task files:
  - `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task`
  - `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`

**Secrets:** read the token from the `HF_TOKEN` environment variable or Space secret. Never hardcode it. The user once pasted a token in chat, so confirm that token was rotated.

---

## 3. Model architecture (must match exactly to load the weights)

```
input: video features (8, 768)  +  pose sequence (T<=450, 300)
SkeletonEncoder: Linear(300->256) + learned pos_embed(1,450,256) + 3-layer TransformerEncoder(d=256, heads=4, ff=1024, dropout 0.1, batch_first)
video_proj: Linear(768->256) + video_pos_embed(1,8,256)
tokens = concat([video(8), skeleton(T)])  -> fusion_to_decoder Linear(256->768)
decoder: BartForConditionalGeneration (facebook/bart-base), used as decoder only, cross-attending to the fused tokens
generate: max_length=64, num_beams=4
```

Parameter prefixes in the state dict: `skeleton_encoder.{input_proj,pos_embed,encoder}`, `video_proj`, `video_pos_embed`, `decoder_model`, `fusion_to_decoder`.

The GAN discriminator is a training-time module only. It is **not** in the checkpoint's inference path. Ignore it.

---

## 4. Preprocessing contract (the part most likely to go wrong)

Any deviation from this silently destroys accuracy. The model was trained on features produced exactly like this.

### 4a. Pose, shape (T, 75, 4) → reshaped to (T, 300)
Per frame:
1. If the frame is wider than 640 px, resize to width 640 (keep aspect).
2. Convert BGR → RGB. Run `PoseLandmarker` and `HandLandmarker` in `VIDEO` running mode with a monotonically increasing timestamp in ms (`int(i*1000/fps)`, forced strictly increasing). Fallback fps is 25 if the container reports nothing sensible.
   - Pose: `num_poses=1`.
   - Hands: `num_hands=2`, with detection, presence and tracking confidence all 0.3.
3. Coordinates are **pixels at a 300-px reference width**, not 0–1:
   `sx = 300; sy = 300*h/w;` `x = lm.x*sx; y = lm.y*sy; z = lm.z*sx`.
4. Slots: pose landmarks 0–32 go in rows 0–32. The signer's left hand (21 points) goes in rows 33–53 and the right hand in rows 54–74. The 4th channel is the pose `visibility`, or 1.0 for hand points. Rows with no detection stay zero.
5. Hand-to-side assignment: match each detected hand's wrist to the nearest **body wrist** (pose 15 = left, 16 = right). With two hands, pick the pairing with the lower total distance. If there is no pose, fall back to MediaPipe handedness, which assumes a mirrored image, so `'Right'` maps to the signer's left slot.
6. Normalise the whole clip: centre on the shoulder midpoint `(p11+p12)/2` (x,y only; z centre is 0), divide by the 2-D nose-to-shoulder-midpoint distance (use 1 if < 1e-6), and keep the confidence channel untouched. Then `nan_to_num`.
7. If T > 450, uniformly subsample to 450 frames with `np.linspace(0, T-1, 450).astype(int)`. Do not truncate.

The reference implementation is in `isl_csltr_full_pipeline.py`, Part 3 (`assign_hands`, `normalize_pose`, `extract_pose`). **Port those functions verbatim.** Do not rewrite them.

### 4b. Video features, shape (8, 768)
1. Decode all frames. Resize so the short side is 256, and convert BGR → RGB.
2. Take 16 frames at `np.linspace(0, n-1, 16).astype(int)`.
3. `VideoMAEImageProcessor.from_pretrained('MCG-NJU/videomae-base')` → `pixel_values`.
4. `VideoMAEModel(...).last_hidden_state` has shape (1, 1568, 768). Reshape to `(1, 8, 196, 768)` and mean over the 196 spatial tokens to get (8, 768). The model is frozen and used in eval mode.

Reference: `isl_csltr_full_pipeline.py`, Part 3b (`read16` and the loop).

### 4c. Webcam-specific rules
- **Do not mirror the recorded clip.** A CSS-flipped preview is fine for the user, but the frames sent to the server must be unflipped, otherwise left and right hands swap.
- `MediaRecorder` webm clips often report wrong fps and frame counts in OpenCV. Count frames by decoding rather than trusting `CAP_PROP_FRAME_COUNT`. Re-encoding to mp4 with ffmpeg at a constant 25–30 fps first is the safest route.
- The signer should be framed head to waist, hands visible, plain lighting, one person, about 3–6 s per sentence. The training clips were ISL-CSLTR sentence recordings.
- Speed matters. The model's predictions are only about 88–90% consistent when the clip is sped up or slowed down by 10% (it failed that check). Do not drop frames or change the playback rate without re-validating.

---

## 5. Reference inference module (drop-in; adapt names to the app)

This is built from the tested training code. It has **not** been run end-to-end with the real weights here, because the shell cannot reach Hugging Face. Verify it with the acceptance test in Section 8.

See `isl_infer.py` in this backend for the adapted version actually wired into the app (loads `model.pt` from local disk instead of `hf_hub_download`, since the trained checkpoint is available locally under `New_model_results/results_model/csltr/model.pt`).

Notes:
- Do not use `strict=True` without checking. Use `strict=False` and assert `missing_keys` is empty, as above. Unexpected keys such as discriminator weights, if any, are harmless.
- Create the MediaPipe landmarkers per worker or request. Do not share them across threads.
- Cache the loaded `ISLTranslator` as a process-wide singleton. Loading takes tens of seconds.
- Use `weights_only=False` because the checkpoint holds a dict with lists and strings. Only load checkpoints from the user's own repo.

---

## 6. API contract to expose

Keep the **existing request shape** the app already uses (Section 10). Extend the **response**:

```json
{
  "translation": "how can i help you",
  "raw_output": "how can I help you",
  "confidence": 0.61,
  "low_confidence": true,
  "candidates": [{"sentence": "...", "score": 0.83}, {"sentence": "...", "score": 0.77}, {"sentence": "...", "score": 0.5}],
  "model": "isl-csltr",
  "timings_s": {"pose": 0.0, "videomae": 0.0, "model": 0.0}
}
```

Keep `translation` as the old key so the front end does not break. Add the other fields as optional.

**Abstention.** On the test set, sequence confidence separates right from wrong answers moderately well (AUROC 0.75), but it is badly over-confident (ECE 0.50, mean confidence 0.61 vs accuracy about 12%). Do not show it as a probability. Show it as a coarse indicator (Low / Medium / High). Selective accuracy on the held-out clips by coverage:

| Coverage kept | 100% | 80% | 60% | 40% | 20% |
|---|---|---|---|---|---|
| Accuracy | 11.6% | 13.9% | 16.8% | 20.3% | 27.5% |

The cut-off for `low_confidence` is not set yet. Choose it from `tande/test_predictions.csv` once it is available (for example, the confidence at the 60th percentile), put it in a config constant, and do not invent one.

---

## 7. Known weaknesses the app should handle

From the test and evaluation scorecard (7 of 13 pass):

- **Latency (fail).** Pose extraction is about 100 ms per frame on CPU, so a 5 s clip at 30 fps takes about 15 s. The end-to-end estimate was 18.8 s against a 10 s target. The model itself is fast (p95 0.45 s). The numbers were measured on CPU only, so re-measure on the actual host. Options:
  - Show a progress state in the UI and a "processing…" message.
  - Cap the clip at about 5 s.
  - Run pose extraction on more CPU workers.
  - Only after re-validating accuracy, subsample frames.
  - Treat browser-side MediaPipe as a larger change that needs its own equivalence check against the Python landmarks.
- **Speed sensitivity (fail).** Accuracy drops with the playback speed of the clip (0.9× and 1.1× agree with the original only about 88–90% of the time).
- **Duplicate clips in the dataset (fail).** 3 exact duplicates and a high near-duplicate rate, so the reported accuracy is probably a little optimistic.
- **Confusions** are between similar sentences, e.g. "can i help you" vs "how can i help you". Showing top-3 helps.
- **Pose carries the signal.** Video-only input scored about 0.5%, so a clip without good pose or hand detection will fail. Hand detection rates were about 50–60% per hand even on good data. If no pose is detected in most frames, return an error asking the user to re-record instead of guessing.

---

## 8. Acceptance tests (agent must run these)

1. **Load test.** The model loads with no missing keys and `sentence_bank` has 101 entries.
2. **Determinism.** The same clip gives the same output twice.
3. **Parity test.** Take 5–10 clips from the ISL-CSLTR data (ask the user for a few clips and their labels). Run them through the app's pipeline and compare with the training-time cached features, or with `tande/test_predictions.csv` if it is provided. Predictions must match for at least 90% of clips. A bigger mismatch means preprocessing differs (see Section 4).
4. **Webcam test.** Record the same sentence three times in the browser. Check:
   - the clip is unmirrored
   - the pose is detected in more than 90% of frames
   - the output is one of the 101 sentences
5. **Failure paths.** A black or empty clip, a clip with no person, and a clip over 15 s should each return a clear error or a low-confidence result, never a crash.
6. **Latency.** Record p50 and p95 end-to-end time on the real host.
7. **Backward compatibility.** The old response keys still work in the front end.

---

## 9. Open items (decide with the user, do not guess)

- Which host runs this: the existing HF Space (Gradio + ZeroGPU), or a separate backend?
- Whether to keep v7 available as a fallback or toggle.
- The confidence cut-off (Section 6).
- Whether the UI should show the 101-sentence list.
- UI screenshots for the report (Section 10 of the Word doc has blank space for them).
- Space dependencies. The new extractor needs `mediapipe>=0.10.30,<0.11`. Add `opencv-python-headless`, `rouge_score`, `transformers`, `torch`, `huggingface_hub`. Check for conflicts with the Space's current pins.

---

## 10. Inspect first (the app's own code is not described here)

Before editing, read and summarise:
1. The Space's `app.py` and `requirements.txt` (the Space currently runs the v7 model; Gradio with ZeroGPU), and how the model and processors are loaded.
2. How the front end sends the clip (blob format, field name, endpoint, or Gradio `client.predict` signature) and how it renders the result.
3. Whether the front end flips frames before upload.
4. Where `HF_TOKEN` is configured.

Then make the smallest change that swaps the inference path, keeping the UI contract. Show the user a diff and the acceptance results before pushing to the Space.

---

## 11. Source files (ask the user to attach them to the agent's workspace)

- `isl_csltr_full_pipeline.py`: training code and the exact feature extraction (Parts 3–4 are the reference).
- `isl_csltr_tande.py`: test and evaluation notebook (Part 13 has the latency measurement).
- `results.csv`, `summary.json`, `tande_report.json`, `scorecard.csv`: evaluation results.
- `ISL_Translation_Case_Study_Team.docx`: the project report.

---

## 12. What was actually done (this integration)

Given the app never had the Space's `app.py` or the old v7 backend wired locally — the current frontend calls the deployed `isign-translator-demo` HF Space directly over REST/SSE (`setu-ai/lib/gradio.ts`) — and the trained `model.pt` plus both MediaPipe `.task` files were already available locally under `New_model_results/results_model/`, the integration took the simplest path that satisfies this brief without deploying anything new:

- **`setu-ai/` and `backend/` are untouched** — the old v7 Space integration keeps working exactly as before.
- **`setu-ai-new-model/`** is a full copy of the frontend, wired to a **local** FastAPI backend instead of the HF Space (no `HF_TOKEN` needed at inference time, since `model.pt` is loaded from disk, not `hf_hub_download`). Runs on port 3001.
- **`backend-new-model/`** is a new local FastAPI service (`isl_infer.py` + `main.py`) implementing Section 3–6 of this brief: the pose/video feature extraction is ported verbatim from `isl_csltr_full_pipeline.py` Part 3, served through `POST /api/translate` (multipart video upload) returning the Section 6 JSON contract. Runs on port 8001.
- The `low_confidence` cutoff (0.614) is the measured 60th-percentile confidence from `New_model_results/results _Test_Validation/tande/test_predictions.csv`, per Section 6.
- Not yet done: the Section 8 acceptance tests beyond the load test (parity test against `tande/test_predictions.csv`, webcam test, latency p50/p95 on this host). Run these before relying on the new app for a demo.
