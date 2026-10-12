# =============================================================================
#  ISL-CSLTR -> English  |  v7 transfer + Adversarial Modality Alignment (GAN/DANN)
#  ONE Kaggle cell. Settings: Accelerator = GPU (T4/P100), Internet = ON
#  Inputs : ISL-CSLTR dataset
#  Secrets: HF_TOKEN (required)  |  KAGGLE_USERNAME + KAGGLE_KEY (optional, for dataset push)
#  Run    : Save Version -> Save & Run All  (~2 h, safe to close the laptop)
#  Runs   : zero-shot v7  +  base x3 seeds  +  adv(lambda=0.1) x3  +  adv(lambda=1.0) x3
# =============================================================================


# ============================ PART 1 : INSTALL + CONFIG ============================
import subprocess, sys
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q',
                'mediapipe>=0.10.30,<0.11', 'sacrebleu', 'rouge_score', 'jiwer'], check=False)

import os, re, gc, glob, json, math, time, random, shutil, urllib.request
import numpy as np, pandas as pd, cv2, torch
import torch.nn as nn, torch.nn.functional as F
from kaggle_secrets import UserSecretsClient

SEEDS          = [42, 43, 44]
ADV_LIST       = [0.1, 1.0]        # GAN strengths to compare (0 = base, always run)
EPOCHS         = 25
BATCH          = 16
LR             = 5e-5              # model (fine-tuning from v7)
DISC_LR        = 1e-4              # discriminator
SS_MAX         = 0.25              # scheduled-sampling max corruption prob
LABEL_SMOOTH   = 0.1
MAX_POSE_LEN   = 450
POSE_REF_WIDTH = 300               # pose coords in pixels at 300-px width (matches iSign training)
N_WORKERS      = os.cpu_count() or 4

OUT        = '/kaggle/working/csltr'
POSE_DIR   = f'{OUT}/pose'
FEAT_DIR   = f'{OUT}/feat'
MODEL_DIR  = f'{OUT}/models'
MP_DIR     = '/kaggle/working/mp_models'
for d in [POSE_DIR, FEAT_DIR, MODEL_DIR, MP_DIR]:
    os.makedirs(d, exist_ok=True)

V7_REPO       = 'Siddhartha121220/isign-v7-production'
KAGGLE_OUT_ID = 'siddharthagopala/isl-csltr-gan-outputs'
HF_OUT_REPO   = 'Siddhartha121220/isl-csltr-gan-production'

def secret(k):
    try:
        return UserSecretsClient().get_secret(k)
    except Exception:
        return None
HF_TOKEN = secret('HF_TOKEN')
assert HF_TOKEN, 'Add HF_TOKEN under Add-ons -> Secrets and tick it for this notebook'

DEV = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print('device:', DEV)

POSE_TASK = f'{MP_DIR}/pose_landmarker_full.task'
HAND_TASK = f'{MP_DIR}/hand_landmarker.task'
for url, dst in [
    ('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task', POSE_TASK),
    ('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task', HAND_TASK)]:
    if not os.path.exists(dst):
        urllib.request.urlretrieve(url, dst)
print('mediapipe task files ready')


# ============================ PART 2 : FIND VIDEOS + SPLIT ============================
VID_EXT = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v')
vids = []
for root, _, files in os.walk('/kaggle/input'):
    if '/notebooks/' in root:
        continue
    vids += [os.path.join(root, f) for f in files if f.lower().endswith(VID_EXT)]
sent_level = [v for v in vids if 'sentence' in v.lower()]
if sent_level:
    vids = sent_level
assert vids, 'No videos found - attach the ISL-CSLTR dataset'

def clean_label(s):
    s = s.replace('_', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()

df = pd.DataFrame([{'path': v, 'text': clean_label(os.path.basename(os.path.dirname(v)))}
                   for v in sorted(vids)])
df['id'] = [f'v{i:05d}' for i in range(len(df))]
df['split'] = 'train'
rng = random.Random(0)
for _, g in df.groupby('text'):
    idx = list(g.index); rng.shuffle(idx)
    if len(idx) >= 3:
        df.loc[idx[0], 'split'] = 'test'; df.loc[idx[1], 'split'] = 'val'
    elif len(idx) == 2:
        df.loc[idx[0], 'split'] = 'test'
print(f'{len(df)} videos | {df.text.nunique()} sentences |', df.split.value_counts().to_dict())
print(df.groupby('text').size().describe()[['min', 'mean', 'max']].to_dict())


# ============================ PART 3 : FEATURE EXTRACTION ============================
# 3a. Pose (MediaPipe Tasks API, CPU, multiprocessing) -> (T, 75, 4) normalized
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
    center = sh.copy(); center[:, 2] = 0
    xyz = (xyz - center[:, None]) / scale[:, None, None]
    return np.nan_to_num(np.concatenate([xyz, conf], -1)).astype(np.float32)

def extract_pose(job):
    vid, path = job
    dst = f'{POSE_DIR}/{vid}.npy'
    if os.path.exists(dst):
        return vid, 'cached'
    try:
        import mediapipe as mp
        cv2.setNumThreads(1)
        V = mp.tasks.vision
        po = V.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=POSE_TASK),
                                     running_mode=V.RunningMode.VIDEO, num_poses=1)
        ho = V.HandLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=HAND_TASK),
                                     running_mode=V.RunningMode.VIDEO, num_hands=2,
                                     min_hand_detection_confidence=0.3,
                                     min_hand_presence_confidence=0.3, min_tracking_confidence=0.3)
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        fps = fps if fps and 1 < fps < 240 else 25.0
        frames, i, last_ts = [], 0, -1
        with V.PoseLandmarker.create_from_options(po) as pl, V.HandLandmarker.create_from_options(ho) as hl:
            while True:
                ok, fr = cap.read()
                if not ok:
                    break
                h, w = fr.shape[:2]
                if w > 640:
                    fr = cv2.resize(fr, (640, int(h * 640 / w))); h, w = fr.shape[:2]
                rgb = np.ascontiguousarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
                img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                ts = max(int(i * 1000 / fps), last_ts + 1); last_ts = ts; i += 1
                pr, hr = pl.detect_for_video(img, ts), hl.detect_for_video(img, ts)
                sx, sy = POSE_REF_WIDTH, POSE_REF_WIDTH * h / w
                a = np.zeros((75, 4), np.float32)
                pose_ok = bool(pr.pose_landmarks)
                if pose_ok:
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
                    a[off:off + 21, :3] = pts; a[off:off + 21, 3] = 1.0
                frames.append(a)
        cap.release()
        if not frames:
            return vid, 'no frames'
        np.save(dst, normalize_pose(np.stack(frames)))
        return vid, 'ok'
    except Exception as e:
        return vid, f'error: {e}'

import multiprocessing as mproc
t0 = time.time(); status = {}
with mproc.get_context('fork').Pool(N_WORKERS) as pool:
    for n, (vid, st) in enumerate(pool.imap_unordered(extract_pose, list(zip(df.id, df.path)), chunksize=1), 1):
        status[vid] = st
        if n % 50 == 0 or n == len(df):
            print(f'pose {n}/{len(df)}  {time.time() - t0:.0f}s')
bad = {k: v for k, v in status.items() if v not in ('ok', 'cached')}
print('pose failures:', len(bad), list(bad.items())[:5])

# 3b. VideoMAE (GPU) -> (8, 768)
from transformers import VideoMAEImageProcessor, VideoMAEModel
vproc = VideoMAEImageProcessor.from_pretrained('MCG-NJU/videomae-base')
vmae = VideoMAEModel.from_pretrained('MCG-NJU/videomae-base').to(DEV).eval()

def read16(path):
    cap = cv2.VideoCapture(path); frs = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        h, w = f.shape[:2]; s = 256 / min(h, w)
        frs.append(cv2.cvtColor(cv2.resize(f, (round(w * s), round(h * s))), cv2.COLOR_BGR2RGB))
    cap.release()
    if not frs:
        return None
    return [frs[k] for k in np.linspace(0, len(frs) - 1, 16).astype(int)]

todo = [(r.id, r.path) for r in df.itertuples() if not os.path.exists(f'{FEAT_DIR}/{r.id}.npy')]
t0 = time.time()
for b in range(0, len(todo), 8):
    chunk = [(vid, read16(p)) for vid, p in todo[b:b + 8]]
    chunk = [(vid, fr) for vid, fr in chunk if fr is not None]
    if not chunk:
        continue
    px = vproc([fr for _, fr in chunk], return_tensors='pt')['pixel_values'].to(DEV)
    with torch.no_grad(), torch.autocast('cuda', enabled=DEV.type == 'cuda'):
        hs = vmae(pixel_values=px).last_hidden_state.float()
    feats = hs.reshape(len(chunk), 8, 196, 768).mean(2).cpu().numpy()
    for (vid, _), f in zip(chunk, feats):
        np.save(f'{FEAT_DIR}/{vid}.npy', f.astype(np.float32))
    if (b // 8) % 10 == 0:
        print(f'videomae {b + len(chunk)}/{len(todo)}  {time.time() - t0:.0f}s')
del vmae; gc.collect(); torch.cuda.empty_cache()

df['ok'] = [os.path.exists(f'{POSE_DIR}/{i}.npy') and os.path.exists(f'{FEAT_DIR}/{i}.npy') for i in df.id]
print('usable videos:', int(df.ok.sum()), '/', len(df))
df = df[df.ok].drop(columns='ok').reset_index(drop=True)
df.to_csv(f'{OUT}/manifest.csv', index=False)


# ============================ PART 4 : DATA + MODEL (v7-compatible) ============================
from transformers import AutoTokenizer, BartForConditionalGeneration, get_cosine_schedule_with_warmup
from transformers.modeling_outputs import BaseModelOutput
from huggingface_hub import hf_hub_download

tok = AutoTokenizer.from_pretrained('facebook/bart-base')

class CSLTRDataset(torch.utils.data.Dataset):
    def __init__(self, d):
        self.d = d.reset_index(drop=True)
    def __len__(self):
        return len(self.d)
    def __getitem__(self, i):
        r = self.d.iloc[i]
        p = np.load(f'{POSE_DIR}/{r.id}.npy').reshape(-1, 300)
        if len(p) > MAX_POSE_LEN:  # uniform subsample keeps the whole sentence
            p = p[np.linspace(0, len(p) - 1, MAX_POSE_LEN).astype(int)]
        v = np.load(f'{FEAT_DIR}/{r.id}.npy')
        return torch.from_numpy(v).float(), torch.from_numpy(p).float(), r.text

def collate(b):
    vf = torch.stack([x[0] for x in b])
    T = max(x[1].shape[0] for x in b)
    ps = torch.zeros(len(b), T, 300); pm = torch.zeros(len(b), T, dtype=torch.bool)
    for k, x in enumerate(b):
        n = x[1].shape[0]; ps[k, :n] = x[1]; pm[k, :n] = True
    texts = [x[2] for x in b]
    enc = tok(texts, padding=True, truncation=True, max_length=64, return_tensors='pt')
    lab = enc.input_ids.masked_fill(enc.attention_mask == 0, -100)
    return vf, ps, pm, lab, texts

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
    def __init__(self, video_dim=768, skeleton_dim=256, decoder_name='facebook/bart-base'):
        super().__init__()
        self.skeleton_encoder = SkeletonEncoder(300, skeleton_dim, max_len=MAX_POSE_LEN)
        self.video_proj = nn.Linear(video_dim, skeleton_dim)
        self.video_pos_embed = nn.Parameter(torch.zeros(1, 8, skeleton_dim))
        self.decoder_model = BartForConditionalGeneration.from_pretrained(decoder_name)
        self.fusion_to_decoder = nn.Linear(skeleton_dim, self.decoder_model.config.d_model)
        for n, p in self.decoder_model.named_parameters():
            p.requires_grad = 'encoder_attn' in n   # cross-attention + its layer norm only
    def _ctx(self, vf, ps, pm):
        v = self.video_proj(vf) + self.video_pos_embed
        vm = torch.ones(v.shape[:2], dtype=torch.bool, device=v.device)
        s = self.skeleton_encoder(ps, pm)
        return self.fusion_to_decoder(torch.cat([v, s], 1)), torch.cat([vm, pm], 1)
    def logits(self, ctx, jm, dec_in):
        return self.decoder_model(encoder_outputs=BaseModelOutput(last_hidden_state=ctx),
                                  attention_mask=jm.long(), decoder_input_ids=dec_in).logits
    @torch.no_grad()
    def generate(self, vf, ps, pm, max_length=64, num_beams=4):
        ctx, jm = self._ctx(vf, ps, pm)
        return self.decoder_model.generate(encoder_outputs=BaseModelOutput(last_hidden_state=ctx),
                                           attention_mask=jm.long(), max_length=max_length,
                                           num_beams=num_beams)

# ---- GAN component: gradient-reversal modality discriminator (DANN) ----
class GradReverse(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, lam):
        ctx.lam = lam
        return x.view_as(x)
    @staticmethod
    def backward(ctx, g):
        return -ctx.lam * g, None

class ModalityDiscriminator(nn.Module):
    """Tries to tell video tokens from pose tokens; encoders are trained to fool it."""
    def __init__(self, d=768):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d, 256), nn.ReLU(), nn.Dropout(0.1), nn.Linear(256, 1))
    def forward(self, x):
        return self.net(x).squeeze(-1)

def pooled(ctx, jm):
    v = ctx[:, :8].mean(1)
    m = jm[:, 8:].float().unsqueeze(-1)
    s = (ctx[:, 8:] * m).sum(1) / m.sum(1).clamp(min=1)
    return v, s

V7_STATE = torch.load(hf_hub_download(V7_REPO, 'model.pt', token=HF_TOKEN),
                      map_location='cpu', weights_only=False)['model_state_dict']

def build_v7():
    m = VideoTextModel()
    res = m.load_state_dict(V7_STATE, strict=False)
    core_missing = [k for k in res.missing_keys if not k.startswith('decoder_model.')
                    or 'encoder_attn' in k]
    assert not core_missing, f'v7 weights did not load: {core_missing[:5]}'
    return m.to(DEV)

_m = build_v7()
print('v7 loaded | trainable params:', sum(p.numel() for p in _m.parameters() if p.requires_grad))
del _m; gc.collect(); torch.cuda.empty_cache()


# ============================ PART 5 : METRICS + TRAINING ============================
import sacrebleu, jiwer
from rouge_score import rouge_scorer
RS = rouge_scorer.RougeScorer(['rougeL'])

def norm(s):
    s = re.sub(r"[^a-z0-9' ]+", ' ', s.lower())
    return re.sub(r'\s+', ' ', s).strip()
def rouge_l(pred, ref):
    return RS.score(ref, pred)['rougeL'].fmeasure
BANK = sorted(set(norm(t) for t in df.text))
def snap(pred):
    p = norm(pred)
    return max(BANK, key=lambda b: rouge_l(p, b))

def compute_metrics(preds, refs):
    P, R = [norm(p) for p in preds], [norm(r) for r in refs]
    return {'bleu': sacrebleu.corpus_bleu(P, [R]).score,
            'rougeL': float(np.mean([rouge_l(p, r) for p, r in zip(P, R)])),
            'wer': jiwer.wer(R, [p if p else '<empty>' for p in P]),
            'exact': float(np.mean([p == r for p, r in zip(P, R)])),
            'snapped_acc': float(np.mean([snap(p) == r for p, r in zip(P, R)]))}

def make_loader(split, shuffle=False, seed=0):
    g = torch.Generator(); g.manual_seed(seed)
    return torch.utils.data.DataLoader(CSLTRDataset(df[df.split == split]), batch_size=BATCH,
                                       shuffle=shuffle, collate_fn=collate, num_workers=2, generator=g)

@torch.no_grad()
def evaluate(model, loader, num_beams=4):
    model.eval(); preds, refs = [], []
    for vf, ps, pm, _, texts in loader:
        g = model.generate(vf.to(DEV), ps.to(DEV), pm.to(DEV), num_beams=num_beams)
        preds += tok.batch_decode(g, skip_special_tokens=True); refs += texts
    return compute_metrics(preds, refs), preds, refs

def set_seed(s):
    random.seed(s); np.random.seed(s); torch.manual_seed(s); torch.cuda.manual_seed_all(s)

PAD, START = tok.pad_token_id, None
def shift_right(lab):
    ids = lab.masked_fill(lab == -100, PAD)
    out = torch.full_like(ids, PAD)
    out[:, 1:] = ids[:, :-1]
    out[:, 0] = START
    return out

def train_run(name, adv_max, seed):
    global START
    set_seed(seed)
    model = build_v7()
    START = model.decoder_model.config.decoder_start_token_id
    disc = ModalityDiscriminator().to(DEV) if adv_max > 0 else None
    groups = [{'params': [p for p in model.parameters() if p.requires_grad], 'lr': LR}]
    if disc is not None:
        groups.append({'params': disc.parameters(), 'lr': DISC_LR})
    opt = torch.optim.AdamW(groups, weight_decay=0.01)
    tr, va = make_loader('train', True, seed), make_loader('val')
    total = EPOCHS * len(tr)
    sched = get_cosine_schedule_with_warmup(opt, int(0.05 * total), total)
    best, best_ep, delta, step = -1, -1, None, 0
    for ep in range(EPOCHS):
        model.train()
        if disc is not None:
            disc.train()
        ss_p = SS_MAX * ep / max(1, EPOCHS - 1)
        tl, dacc, nb = 0.0, 0.0, 0
        for vf, ps, pm, lab, _ in tr:
            vf, ps, pm, lab = vf.to(DEV), ps.to(DEV), pm.to(DEV), lab.to(DEV)
            ctx, jm = model._ctx(vf, ps, pm)
            dec_in = shift_right(lab)
            if ss_p > 0:  # scheduled sampling: feed the model's own predictions sometimes
                with torch.no_grad():
                    pred = model.logits(ctx, jm, dec_in).argmax(-1)
                repl = torch.rand(dec_in.shape, device=DEV) < ss_p
                repl[:, 0] = False
                repl[:, 1:] &= lab[:, :-1] != -100
                dec_in = dec_in.clone()
                dec_in[:, 1:] = torch.where(repl[:, 1:], pred[:, :-1], dec_in[:, 1:])
            lg = model.logits(ctx, jm, dec_in)
            loss = F.cross_entropy(lg.reshape(-1, lg.size(-1)), lab.reshape(-1),
                                   ignore_index=-100, label_smoothing=LABEL_SMOOTH)
            if disc is not None:
                prog = step / total
                lam = adv_max * (2 / (1 + math.exp(-10 * prog)) - 1)   # DANN ramp 0 -> adv_max
                v, s = pooled(ctx, jm)
                feats = torch.cat([v, s])
                y = torch.cat([torch.zeros(len(v)), torch.ones(len(s))]).to(DEV)
                dl = disc(GradReverse.apply(feats, lam))
                loss = loss + F.binary_cross_entropy_with_logits(dl, y)
                dacc += ((dl > 0).float() == y).float().mean().item()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_([p for g in groups for p in g['params']], 1.0)
            opt.step(); sched.step()
            tl += loss.item(); nb += 1; step += 1
        vm, _, _ = evaluate(model, va, num_beams=1)
        score = vm['snapped_acc'] + vm['bleu'] / 100
        if score > best:
            best, best_ep = score, ep
            delta = {k: v.detach().cpu().clone() for k, v in model.named_parameters() if v.requires_grad}
        print(f'[{name}] ep{ep + 1:02d} loss {tl / nb:.3f} ss {ss_p:.2f} '
              f'disc_acc {dacc / nb if disc is not None else float("nan"):.2f} | '
              f'val snap {vm["snapped_acc"]:.3f} bleu {vm["bleu"]:.2f}', flush=True)
    model.load_state_dict(delta, strict=False)
    torch.save(delta, f'{MODEL_DIR}/{name}.pt')
    tm, preds, refs = evaluate(model, make_loader('test'), num_beams=4)
    for p, r in list(zip(preds, refs))[:5]:
        print(f'   REF: {r}\n   HYP: {p}')
    row = {'run': name, 'group': name.rsplit('_s', 1)[0], 'seed': seed, 'adv_max': adv_max,
           'best_epoch': best_ep + 1, 'val_score': best,
           'final_disc_acc': dacc / nb if disc is not None else None, **tm}
    del model, disc, opt; gc.collect(); torch.cuda.empty_cache()
    return row


# ============================ PART 6 : EXPERIMENTS ============================
RES_CSV = f'{OUT}/results.csv'
rows = pd.read_csv(RES_CSV).to_dict('records') if os.path.exists(RES_CSV) else []
done = {r['run'] for r in rows}
def save_rows():
    pd.DataFrame(rows).to_csv(RES_CSV, index=False)

if 'zero_shot_v7' not in done:
    m = build_v7()
    zm, _, _ = evaluate(m, make_loader('test'))
    rows.append({'run': 'zero_shot_v7', 'group': 'zero_shot_v7', 'seed': None, 'adv_max': 0, **zm})
    save_rows(); print('ZERO-SHOT v7:', zm)
    del m; gc.collect(); torch.cuda.empty_cache()

plan = [('base', 0.0)] + [(f'adv{a:g}', a) for a in ADV_LIST]
for tag, adv in plan:
    for seed in SEEDS:
        name = f'{tag}_s{seed}'
        if name in done:
            continue
        t0 = time.time()
        rows.append(train_run(name, adv, seed)); save_rows()
        print(f'== {name} done in {(time.time() - t0) / 60:.1f} min:',
              {k: round(v, 4) for k, v in rows[-1].items() if isinstance(v, float)})

res = pd.DataFrame(rows)
METRICS = ['snapped_acc', 'exact', 'bleu', 'rougeL', 'wer', 'final_disc_acc']
summary = res[res.group != 'zero_shot_v7'].groupby('group')[METRICS].agg(['mean', 'std'])
print('\n================ TEST RESULTS (mean / std over seeds) ================')
print(summary.round(4).to_string())
print(res[res.group == 'zero_shot_v7'][['snapped_acc', 'exact', 'bleu', 'rougeL', 'wer']].round(4).to_string())


# ============================ PART 7 : FINAL MODEL + SUMMARY ============================
trained = res[res.group != 'zero_shot_v7']
best_run = trained.loc[trained.val_score.idxmax(), 'run']
print('best run (by validation):', best_run)

final = build_v7()
final.load_state_dict(torch.load(f'{MODEL_DIR}/{best_run}.pt'), strict=False)
torch.save({'model_state_dict': final.state_dict(),
            'config': {'max_pose_len': MAX_POSE_LEN, 'pose_ref_width': POSE_REF_WIDTH,
                       'pose_subsample': 'uniform', 'pose_extractor': 'mediapipe-tasks (pose_full + hand)',
                       'videomae': 'MCG-NJU/videomae-base', 'decoder': 'facebook/bart-base'},
            'sentence_bank': BANK, 'best_run': best_run}, f'{OUT}/model.pt')
del final; gc.collect(); torch.cuda.empty_cache()

def fnum(v):
    return None if pd.isna(v) else float(v)
summary_flat = {grp: {f'{m}_{s}': fnum(v) for (m, s), v in r.items()} for grp, r in summary.iterrows()}
json.dump({'summary': summary_flat,
           'zero_shot_v7': {k: fnum(v) for k, v in res[res.group == 'zero_shot_v7'].iloc[0].items()
                            if k in ['snapped_acc', 'exact', 'bleu', 'rougeL', 'wer']},
           'best_run': best_run, 'n_videos': len(df), 'n_sentences': len(BANK),
           'splits': df.split.value_counts().to_dict(),
           'config': {'seeds': SEEDS, 'epochs': EPOCHS, 'lr': LR, 'ss_max': SS_MAX, 'adv_list': ADV_LIST}},
          open(f'{OUT}/summary.json', 'w'), indent=2)
print('saved model.pt, results.csv, summary.json, manifest.csv')


# ============================ PART 8 : PUSH (Kaggle dataset + Hugging Face) ============================
for k in ['KAGGLE_USERNAME', 'KAGGLE_KEY']:
    v = secret(k)
    if v:
        os.environ[k] = v
stage = '/kaggle/working/push'
shutil.rmtree(stage, ignore_errors=True); os.makedirs(stage)
for f in ['model.pt', 'results.csv', 'summary.json', 'manifest.csv']:
    shutil.copy(f'{OUT}/{f}', f'{stage}/{f}')

try:
    json.dump({'title': 'ISL-CSLTR GAN outputs', 'id': KAGGLE_OUT_ID,
               'licenses': [{'name': 'CC0-1.0'}]}, open(f'{stage}/dataset-metadata.json', 'w'))
    r = subprocess.run(['kaggle', 'datasets', 'create', '-p', stage], capture_output=True, text=True)
    out = r.stdout + r.stderr
    if r.returncode != 0 or 'already' in out.lower():
        r = subprocess.run(['kaggle', 'datasets', 'version', '-p', stage, '-m', f'best={best_run}'],
                           capture_output=True, text=True)
        out = r.stdout + r.stderr
    print('KAGGLE:', out[-400:])
except Exception as e:
    print('KAGGLE push failed:', e)

try:
    from huggingface_hub import HfApi
    api = HfApi(token=HF_TOKEN)
    api.create_repo(HF_OUT_REPO, private=True, exist_ok=True)
    os.remove(f'{stage}/dataset-metadata.json') if os.path.exists(f'{stage}/dataset-metadata.json') else None
    api.upload_folder(folder_path=stage, repo_id=HF_OUT_REPO, commit_message=f'ISL-CSLTR best={best_run}')
    print('HF: uploaded to', HF_OUT_REPO)
except Exception as e:
    print('HF push failed:', e)

shutil.rmtree(stage, ignore_errors=True)
print('ALL DONE')
