# See For Me — Starter

Local, single-laptop pipeline: iPhone-as-webcam → YOLO-World (open-vocab
detection) → hazard persistence/cooldown logic → ElevenLabs spoken alert.
The OpenCV preview window IS your judge dashboard — it draws boxes, labels,
and confidence live.

## 1. One-time setup

**Enable iPhone as a webcam (Continuity Camera, macOS 13+):**
1. On your iPhone: Settings → General → AirPlay & Handoff → make sure it's on.
2. Make sure both devices are signed into the same Apple ID, Wi-Fi + Bluetooth
   on for both.
3. Prop the iPhone up (a small stand/clip helps) — it'll auto-connect as soon
   as the laptop opens any app that lists cameras.
4. It works over the air, but a Lightning/USB-C cable makes the connection
   far more stable for a live demo — use one if you can.

**Find which camera index your iPhone becomes:**
Camera indices aren't guaranteed — run this to check:
```bash
python3 -c "
import cv2
for i in range(4):
    cap = cv2.VideoCapture(i)
    ok, _ = cap.read()
    print(i, 'available' if ok else 'no feed')
    cap.release()
"
```
Whichever index shows "available" and isn't your laptop's built-in camera —
put that number in `config.py` as `CAMERA_INDEX`. (Usually the built-in
camera is 0 and the iPhone shows up as 1, but check — it varies.)

**Install dependencies:**
```bash
cd see-for-me
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Get an ElevenLabs API key:**
Sign up at elevenlabs.io → Profile → API Keys. Then:
```bash
cp .env.example .env
# edit .env and paste your key in
```

## 2. Run it

```bash
python3 main.py
```

First run downloads the YOLO-World weights (needs internet once) and
pre-generates + caches all your alert phrases as mp3s (needs internet once —
after that it's instant and works offline). Every run after that is fully
local, no network calls.

A window pops up showing the live feed with boxes drawn around anything
YOLO-World recognizes from your hazard list. Green = detected but outside
the "forward path" zone (ignored). Red = detected AND in your path — this is
what feeds the persistence buffer and can trigger a spoken alert.

Press `q` in that window to quit.

## 3. Tuning for your demo space

Everything worth tweaking lives in `config.py`:
- `HAZARDS` — your list of hazard prompts. Add/remove freely; YOLO-World
  doesn't need retraining, just re-run.
- `FORWARD_PATH_X_RANGE` / `FORWARD_PATH_Y_MIN` — defines the "cone" in the
  frame that counts as "in your path." Widen/narrow based on how the phone
  is angled during your demo.
- `PERSISTENCE_MIN` / `FRAME_HISTORY` — how many of the last N frames must
  detect a hazard before it counts as real.
- `COOLDOWN_SECONDS` — minimum gap between repeat alerts for the same hazard.
- `CONF_THRESHOLD` — YOLO-World confidence cutoff. Lower = more detections
  (more false positives too).

## 4. Known rough edges to be aware of before your demo

- **Alert playback is blocking** — the camera loop pauses for the ~1-2
  seconds of audio while an alert plays. Fine for a hackathon demo; if it
  feels too choppy, ask me to move `tts.play_alert` onto a background thread.
- **YOLO-World's built-in vocabulary is fuzzy for very specific classes**
  like "platform edge" — it does much better with concrete, visually
  distinct nouns ("stairs", "curb", "bicycle") than with abstract/compound
  phrases. Test each hazard word individually against real objects before
  trusting it in the demo.
- **Lighting matters a lot** for a webcam-based detector — test in the
  actual room/lighting you'll demo in, not just wherever you're coding.
