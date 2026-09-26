"""
See For Me — local pipeline.

    iPhone (Continuity Camera) --> OpenCV frame
                                --> YOLO-World detection (open-vocab hazards)
                                --> forward-path filter
                                --> persistence/cooldown logic (hazard_logic.py)
                                --> ElevenLabs spoken alert (tts.py)

The preview window doubles as the judge dashboard: boxes + labels + colors
show exactly what's being detected and why an alert did/didn't fire.
"""

import cv2
from ultralytics import YOLO

import config
import tts
from hazard_logic import HazardTracker


def in_forward_path(box, frame_w, frame_h) -> bool:
    x1, y1, x2, y2 = box
    center_x_frac = ((x1 + x2) / 2) / frame_w
    bottom_y_frac = y2 / frame_h
    x_lo, x_hi = config.FORWARD_PATH_X_RANGE
    return x_lo <= center_x_frac <= x_hi and bottom_y_frac >= config.FORWARD_PATH_Y_MIN


def draw_forward_path_zone(frame, w, h):
    x_lo, x_hi = config.FORWARD_PATH_X_RANGE
    pt1 = (int(x_lo * w), int(config.FORWARD_PATH_Y_MIN * h))
    pt2 = (int(x_hi * w), h)
    cv2.rectangle(frame, pt1, pt2, (255, 255, 0), 1)


def main():
    print("Loading YOLO-World...")
    model = YOLO("yolov8s-worldv2.pt")  # auto-downloads on first run
    model.set_classes(config.HAZARDS)

    print("Preparing alert audio (cached after first run)...")
    tts.pregenerate_all()

    print(f"Opening camera index {config.CAMERA_INDEX}...")
    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open camera index {config.CAMERA_INDEX}. "
            "Run the camera-finder snippet in README.md to find the right index."
        )

    tracker = HazardTracker()
    print("Running. Press 'q' in the preview window to quit.\n")

    while True:
        ok, frame = cap.read()
        if not ok:
            print("Frame grab failed, retrying...")
            continue

        h, w = frame.shape[:2]
        results = model.predict(frame, conf=config.CONF_THRESHOLD, verbose=False)[0]

        detected_in_path = set()
        draw_forward_path_zone(frame, w, h)

        for box_xyxy, cls_id, conf in zip(
            results.boxes.xyxy.tolist(),
            results.boxes.cls.tolist(),
            results.boxes.conf.tolist(),
        ):
            label = config.HAZARDS[int(cls_id)]
            inside = in_forward_path(box_xyxy, w, h)
            if inside:
                detected_in_path.add(label)

            x1, y1, x2, y2 = map(int, box_xyxy)
            color = (0, 0, 255) if inside else (0, 200, 0)  # red = in-path, green = elsewhere
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                frame, f"{label} {conf:.2f}", (x1, max(y1 - 8, 12)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
            )

        triggered = tracker.update(detected_in_path)
        for label in triggered:
            print(f"ALERT: {label}")
            cv2.putText(
                frame, f"ALERT: {label.upper()}", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3,
            )
            tts.play_alert(label)  # blocking — see README for the threading note

        cv2.imshow("See For Me - Judge View", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
