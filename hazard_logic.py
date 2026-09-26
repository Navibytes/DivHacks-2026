"""
Turns raw per-frame detections into stable, non-spammy alerts.

A hazard only triggers an alert once it's shown up in at least
PERSISTENCE_MIN of the last FRAME_HISTORY frames (so one flaky detection
doesn't cause a false alarm), and won't re-trigger again until
COOLDOWN_SECONDS has passed for that same hazard label.
"""

import time
from collections import deque, defaultdict

import config


class HazardTracker:
    def __init__(self):
        self.history = defaultdict(lambda: deque(maxlen=config.FRAME_HISTORY))
        self.last_alert_time = defaultdict(float)

    def update(self, detected_in_path: set[str]) -> list[str]:
        """
        Call once per frame with the set of hazard labels detected inside
        the forward-path zone this frame. Returns the list of hazard labels
        that should fire a NEW alert right now (empty most frames).
        """
        triggered = []
        now = time.time()

        # Track every hazard we've ever seen, so history keeps sliding even
        # on frames where a previously-seen hazard drops out of view.
        all_labels = set(self.history.keys()) | detected_in_path

        for label in all_labels:
            self.history[label].append(label in detected_in_path)
            recent_hits = sum(self.history[label])

            if recent_hits >= config.PERSISTENCE_MIN:
                if now - self.last_alert_time[label] >= config.COOLDOWN_SECONDS:
                    triggered.append(label)
                    self.last_alert_time[label] = now

        return triggered
