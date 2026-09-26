# --- Camera ---
CAMERA_INDEX = 1  # run the camera-finder snippet in README.md if unsure
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# --- Hazard classes YOLO-World will look for ---
# Keep these concrete/visual — "stairs", "curb", "bicycle" work far better
# than abstract phrases like "platform edge". Test each one for real before
# trusting it in the demo.
HAZARDS = ["stairs", "curb", "bicycle", "car", "person", "pothole"]

# Spoken phrase per hazard label. Anything not listed falls back to a generic line.
ALERT_PHRASES = {
    "stairs": "Stairs ahead.",
    "curb": "Curb ahead.",
    "bicycle": "Bicycle ahead.",
    "car": "Vehicle ahead.",
    "person": "Obstacle in your path.",
    "pothole": "Obstacle in your path.",
}

# --- Detection confidence ---
CONF_THRESHOLD = 0.35  # lower = more detections, more false positives

# --- Forward-path "cone" ---
# A detection only counts as "in your path" if its box center-x falls in this
# fraction of the frame width, AND its bottom edge is at least this far down
# the frame (filters out things high up / far away in the background).
FORWARD_PATH_X_RANGE = (0.3, 0.7)
FORWARD_PATH_Y_MIN = 0.3

# --- Persistence / cooldown ---
FRAME_HISTORY = 3      # how many recent frames we remember per hazard
PERSISTENCE_MIN = 2    # must appear in-path in at least this many of them
COOLDOWN_SECONDS = 6   # minimum gap between repeat alerts for the same hazard
