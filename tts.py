"""
Pre-generates and caches the audio for every alert phrase ONCE at startup,
so triggering an alert during the live demo is instant playback from disk —
no ElevenLabs API call (and therefore no latency or network dependency) in
the hot path.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from playsound import playsound

import config

load_dotenv()

CACHE_DIR = Path(__file__).parent / "audio_cache"
CACHE_DIR.mkdir(exist_ok=True)

_client = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        api_key = os.environ.get("ELEVENLABS_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ELEVENLABS_API_KEY not set. Copy .env.example to .env and add your key."
            )
        _client = ElevenLabs(api_key=api_key)
    return _client


def _cache_path(phrase: str) -> Path:
    safe_name = "".join(c if c.isalnum() else "_" for c in phrase)
    return CACHE_DIR / f"{safe_name}.mp3"


def pregenerate_all():
    """Generate + cache mp3s for every unique alert phrase. Skips ones already cached."""
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    client = _get_client()

    for phrase in sorted(set(config.ALERT_PHRASES.values())):
        path = _cache_path(phrase)
        if path.exists():
            continue
        print(f"  Generating alert audio: '{phrase}'")
        audio_chunks = client.text_to_speech.convert(
            voice_id=voice_id,
            text=phrase,
            model_id="eleven_turbo_v2_5",
        )
        with open(path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)


def play_alert(hazard_label: str):
    """Plays the cached audio for a hazard label. Blocks until playback finishes."""
    phrase = config.ALERT_PHRASES.get(hazard_label, "Obstacle in your path.")
    path = _cache_path(phrase)
    if not path.exists():
        print(f"  [warning] no cached audio for '{phrase}', skipping playback")
        return
    playsound(str(path))
