"""
Media processor HTTP server for Cloudflare Containers.
Receives WebM chunks, concatenates, transcodes to MP4, enhances audio, generates thumbnails.
"""

import logging
import os
import shutil
import subprocess
import threading
from pathlib import Path

from flask import Flask, request, jsonify, send_file, abort

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("media-processor")

app = Flask(__name__)

# Paths
CHUNKS_DIR = Path("/tmp/chunks")
WORK_DIR = Path("/tmp/work")
OUTPUT_DIR = Path("/tmp/output")
ALLOWED_OUTPUT_FILES = frozenset({"video.mp4", "thumbnail.jpg", "audio.wav", "audio_enhanced.mp4"})

# Thread-safe processing state
_state_lock = threading.Lock()
_state = {
    "status": "idle",  # idle | processing | complete | failed
    "progress": 0,
    "error": None,
}


def _set_state(status: str, progress: int = 0, error: str | None = None) -> None:
    with _state_lock:
        _state["status"] = status
        _state["progress"] = progress
        _state["error"] = error


def _get_state() -> dict:
    with _state_lock:
        return _state.copy()


def _ensure_dirs() -> None:
    """Create temp directories if they don't exist."""
    for d in (CHUNKS_DIR, WORK_DIR, OUTPUT_DIR):
        os.makedirs(d, exist_ok=True)


def _clean_work_and_output() -> None:
    """Remove work and output dirs (previous run). Keeps chunks for current process."""
    for d in (WORK_DIR, OUTPUT_DIR):
        if d.exists():
            try:
                shutil.rmtree(d)
            except OSError as e:
                logger.warning("Failed to remove %s: %s", d, e)
    _ensure_dirs()


def _clean_all() -> None:
    """Remove all temp files including chunks. Use after failed run or when done."""
    for d in (CHUNKS_DIR, WORK_DIR, OUTPUT_DIR):
        if d.exists():
            try:
                shutil.rmtree(d)
            except OSError as e:
                logger.warning("Failed to remove %s: %s", d, e)
    _ensure_dirs()


def _run_ffmpeg(args: list[str], cwd: str | None = None) -> tuple[int, str, str]:
    """Run ffmpeg/ffprobe, return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=cwd,
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "Process timed out after 600s"
    except Exception as e:
        return -1, "", str(e)


def _get_duration_seconds(path: Path) -> float | None:
    """Get video duration in seconds via ffprobe."""
    code, out, err = _run_ffmpeg(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ]
    )
    if code != 0:
        logger.error("ffprobe failed: %s", err)
        return None
    try:
        return float(out.strip())
    except ValueError:
        return None


def _process_pipeline(total_chunks: int, session_id: str) -> None:
    """Background pipeline: concat -> transcode -> thumbnail -> audio extraction."""
    _set_state("processing", 0, None)

    try:
        # Verify all chunks exist
        missing = []
        for i in range(total_chunks):
            chunk_path = CHUNKS_DIR / f"chunk-{i:06d}.webm"
            if not chunk_path.exists():
                missing.append(i)
        if missing:
            _set_state("failed", 0, f"Missing chunks: {missing[:10]}{'...' if len(missing) > 10 else ''}")
            _clean_all()
            return

        # Create concat list
        concat_path = WORK_DIR / "list.txt"
        chunk_paths = sorted(CHUNKS_DIR.glob("chunk-*.webm"))
        with open(concat_path, "w") as f:
            for p in chunk_paths:
                f.write(f"file '{p.absolute()}'\n")

        concat_out = WORK_DIR / "concat.webm"

        # Step 1: Concatenate (0–20%)
        logger.info("Concatenating %d chunks", len(chunk_paths))
        code, _, err = _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_path),
                "-c", "copy",
                str(concat_out),
            ]
        )
        if code != 0:
            _set_state("failed", 0, f"Concat failed: {err[:500]}")
            _clean_all()
            return
        _set_state("processing", 20)

        # Step 2: Transcode with enhanced audio (20–80%)
        video_mp4 = OUTPUT_DIR / "video.mp4"
        logger.info("Transcoding to MP4 with audio enhancement")
        code, _, err = _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-i", str(concat_out),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "23",
                "-af", "highpass=f=80,afftdn=nf=-25,loudnorm=I=-14:TP=-1:LRA=11",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                str(video_mp4),
            ]
        )
        if code != 0:
            _set_state("failed", 20, f"Transcode failed: {err[:500]}")
            _clean_all()
            return
        _set_state("processing", 80)

        # Step 3: Thumbnail at 25% (80–90%)
        duration = _get_duration_seconds(video_mp4)
        if duration is None:
            _set_state("failed", 80, "Could not get video duration for thumbnail")
            _clean_all()
            return
        quarter = duration * 0.25
        thumbnail_path = OUTPUT_DIR / "thumbnail.jpg"
        code, _, err = _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-ss", str(quarter),
                "-i", str(video_mp4),
                "-vframes", "1",
                "-q:v", "2",
                str(thumbnail_path),
            ]
        )
        if code != 0:
            _set_state("failed", 80, f"Thumbnail failed: {err[:500]}")
            _clean_all()
            return
        _set_state("processing", 90)

        # Step 4: Extract audio for Whisper (90–100%)
        audio_wav = OUTPUT_DIR / "audio.wav"
        code, _, err = _run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-i", str(video_mp4),
                "-vn",
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                str(audio_wav),
            ]
        )
        if code != 0:
            _set_state("failed", 90, f"Audio extraction failed: {err[:500]}")
            _clean_all()
            return

        _set_state("complete", 100, None)
        logger.info("Processing complete for session %s", session_id)

        # Clean temp chunks and work dir; keep output for serving
        for d in (CHUNKS_DIR, WORK_DIR):
            if d.exists():
                try:
                    shutil.rmtree(d)
                except OSError as e:
                    logger.warning("Cleanup failed for %s: %s", d, e)
        _ensure_dirs()

    except Exception as e:
        logger.exception("Pipeline error")
        _set_state("failed", _get_state().get("progress", 0), str(e))
        _clean_all()


@app.route("/chunk/<int:index>", methods=["PUT"])
def put_chunk(index: int):
    """Receive a WebM chunk and save to disk."""
    if index < 0:
        return jsonify({"error": "Invalid chunk index"}), 400
    _ensure_dirs()
    path = CHUNKS_DIR / f"chunk-{index:06d}.webm"
    try:
        data = request.get_data()
        if not data:
            return jsonify({"error": "Empty chunk body"}), 400
        with open(path, "wb") as f:
            f.write(data)
        logger.info("Saved chunk %d (%d bytes)", index, len(data))
        return jsonify({"status": "ok", "index": index}), 200
    except OSError as e:
        logger.error("Failed to save chunk %d: %s", index, e)
        return jsonify({"error": f"Failed to save chunk: {e}"}), 500


@app.route("/process", methods=["POST"])
def process():
    """Trigger the ffmpeg pipeline. Returns immediately."""
    try:
        body = request.get_json(force=True, silent=True)
        if not body or not isinstance(body, dict):
            return jsonify({"error": "Invalid JSON body"}), 400
        total_chunks = body.get("totalChunks")
        session_id = body.get("sessionId", "")
        if total_chunks is None or not isinstance(total_chunks, int) or total_chunks < 1:
            return jsonify({"error": "totalChunks must be a positive integer"}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request: {e}"}), 400

    with _state_lock:
        if _state["status"] == "processing":
            return jsonify({"error": "Processing already in progress"}), 409

    # Clean previous session output/work; keep chunks from current PUTs
    _clean_work_and_output()

    thread = threading.Thread(
        target=_process_pipeline,
        args=(total_chunks, session_id),
        daemon=True,
    )
    thread.start()

    return jsonify({"status": "processing"}), 200


@app.route("/status")
def status():
    """Return current processing status."""
    s = _get_state()
    return jsonify({
        "status": s["status"],
        "progress": s["progress"],
        "error": s["error"],
    })


@app.route("/output/<path:filename>")
def output(filename: str):
    """Serve processed output files."""
    if filename not in ALLOWED_OUTPUT_FILES:
        abort(404)
    # audio_enhanced.mp4 is the same as video.mp4 (video with enhanced audio)
    serve_path = OUTPUT_DIR / ("video.mp4" if filename == "audio_enhanced.mp4" else filename)
    if not serve_path.exists() or not serve_path.is_file():
        abort(404)
    try:
        return send_file(
            serve_path,
            as_attachment=False,
            download_name=filename,
            mimetype={
                "video.mp4": "video/mp4",
                "audio_enhanced.mp4": "video/mp4",
                "thumbnail.jpg": "image/jpeg",
                "audio.wav": "audio/wav",
            }.get(filename, "application/octet-stream"),
        )
    except OSError as e:
        logger.error("Failed to serve %s: %s", filename, e)
        abort(500)


@app.route("/health")
def health():
    """Health check for container orchestration."""
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    _ensure_dirs()
    app.run(host="0.0.0.0", port=8000, threaded=True)
