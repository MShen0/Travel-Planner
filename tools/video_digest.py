#!/usr/bin/env python3
"""Turn a travel video (reel, vlog, guide) into frames + transcript Claude can read.

    python tools/video_digest.py "<url or share text or file.mp4>" --out .cache/video/osaka
    python tools/video_digest.py "<...>" --out DIR --frames 16 --whisper small --lang zh

Writes into DIR:
    video.mp4            the downloaded video (≤720p)
    frames/f_0012.5s.jpg evenly spaced key frames (burnt-in captions, signs, menus)
    sheet.jpg            one contact sheet of all frames (quick overview)
    digest.json          {source, title, duration_s, frames[], contact_sheet,
                          transcript: {source, language, segments[{start,end,text}]}, warnings[]}

Transcript sources, in order: the platform's subtitles (yt-dlp), then local
Whisper (`pip install faster-whisper`; models download once from Hugging Face),
else none — many Xiaohongshu/Douyin videos carry burnt-in captions, which the
frames show anyway. Needs ffmpeg; yt-dlp for links.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_post  # noqa: E402

SUB_LANG_PREF = ("zh-Hans", "zh-CN", "zh", "zh-Hant", "zh-TW", "zh-HK", "en", "ja", "ko")


# --------------------------------------------------------------------------
# Subtitles
# --------------------------------------------------------------------------

def _ts(s: str) -> float:
    parts = s.replace(",", ".").split(":")
    parts = [float(p) for p in parts]
    while len(parts) < 3:
        parts.insert(0, 0.0)
    h, m, sec = parts
    return round(h * 3600 + m * 60 + sec, 2)


def parse_vtt(text: str) -> list[dict]:
    """WebVTT/SRT -> [{start, end, text}], tags stripped, rolling repeats merged."""
    segments: list[dict] = []
    prev_full = ""  # last cue's full text; auto-captions repeat and extend it
    blocks = re.split(r"\n\s*\n", text.replace("\r", ""))
    for block in blocks:
        lines = [ln for ln in block.strip().split("\n") if ln.strip()]
        timing = next((ln for ln in lines if "-->" in ln), None)
        if not timing:
            continue
        m = re.match(r"\s*([\d:.,]+)\s*-->\s*([\d:.,]+)", timing)
        if not m:
            continue
        body = lines[lines.index(timing) + 1:]
        words = " ".join(re.sub(r"<[^>]+>", "", ln).strip() for ln in body).strip()
        words = re.sub(r"\s+", " ", words)
        if not words:
            continue
        seg = {"start": _ts(m.group(1)), "end": _ts(m.group(2)), "text": words}
        if segments and prev_full:
            if words == prev_full:
                segments[-1]["end"] = seg["end"]
                continue
            if words.startswith(prev_full):  # auto-captions grow line by line
                seg["text"] = words[len(prev_full):].strip()
        prev_full = words
        if seg["text"]:
            segments.append(seg)
    return segments


def pick_subtitle(paths: list[str]) -> str | None:
    """Prefer human subtitles in Chinese, then English, then anything."""
    def lang(p: str) -> str:
        parts = os.path.basename(p).split(".")
        return parts[-2] if len(parts) >= 3 else ""

    ranked = sorted(paths, key=lambda p: (
        SUB_LANG_PREF.index(lang(p).replace("-orig", "")) if lang(p).replace("-orig", "") in SUB_LANG_PREF else 99,
        0 if lang(p).endswith("-orig") else 1,
    ))
    return ranked[0] if ranked else None


# --------------------------------------------------------------------------
# Video
# --------------------------------------------------------------------------

def run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def probe_duration(path: str) -> float | None:
    p = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path], 60)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return None


def frame_times(duration: float, n: int) -> list[float]:
    """n evenly spaced timestamps, centred in each slice (skips black intro/outro frames)."""
    n = max(1, n)
    return [round((i + 0.5) * duration / n, 1) for i in range(n)]


def extract_frames(video: str, out_dir: str, duration: float, n: int, max_h: int) -> list[dict]:
    os.makedirs(out_dir, exist_ok=True)
    frames = []
    for t in frame_times(duration, n):
        path = os.path.join(out_dir, f"f_{t:06.1f}s.jpg")
        p = run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", video, "-frames:v", "1",
                 "-vf", f"scale=-2:'min({max_h},ih)'", "-q:v", "3", path], 120)
        if p.returncode == 0 and os.path.exists(path):
            frames.append({"t": t, "path": path})
    return frames


def contact_sheet(frames: list[dict], out_path: str) -> str | None:
    if not frames:
        return None
    cols = 4 if len(frames) > 6 else len(frames)
    rows = (len(frames) + cols - 1) // cols
    listing = out_path + ".txt"
    with open(listing, "w", encoding="utf-8") as f:
        for fr in frames:
            f.write(f"file '{os.path.abspath(fr['path'])}'\n")
    p = run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listing,
             "-vf", f"scale=360:-2,tile={cols}x{rows}:padding=6:color=white", "-frames:v", "1", "-q:v", "3",
             out_path], 120)
    os.remove(listing)
    return out_path if p.returncode == 0 and os.path.exists(out_path) else None


def download(source: str, out_dir: str, cookies: str | None, cookies_from_browser: str | None,
             warnings: list[str]) -> tuple[str | None, dict]:
    """(video_path, post_info). Accepts a file path, a URL or a whole share text."""
    if os.path.isfile(source):
        return source, {"title": os.path.basename(source)}
    url = fetch_post.pick_url(source)
    if not url:
        warnings.append("没有找到链接或文件。")
        return None, {}
    os.makedirs(out_dir, exist_ok=True)
    info: dict = {"url": url, "platform": fetch_post.detect_platform(url)}
    exe = shutil.which("yt-dlp")
    if exe:
        cmd = [exe, "--no-playlist", "--no-warnings", "-f", "bv*[height<=720]+ba/b[height<=720]/bv*+ba/b",
               "--merge-output-format", "mp4", "-o", os.path.join(out_dir, "video.%(ext)s"),
               "--write-subs", "--write-auto-subs", "--sub-format", "vtt/srt/best",
               "--sub-langs", "zh-Hans,zh-CN,zh,zh-Hant,zh-TW,en,en-orig,ja,ko,.*-orig",
               "--print-json"]
        if cookies:
            cmd += ["--cookies", cookies]
        if cookies_from_browser:
            cmd += ["--cookies-from-browser", cookies_from_browser]
        p = run(cmd + [url], 900)
        if p.returncode == 0:
            try:
                meta = json.loads(p.stdout.strip().splitlines()[-1])
                info.update({"title": meta.get("title"), "description": meta.get("description"),
                             "uploader": meta.get("uploader")})
            except (json.JSONDecodeError, IndexError):
                pass
            vids = [v for v in glob.glob(os.path.join(out_dir, "video.*")) if v.endswith((".mp4", ".webm", ".mkv"))]
            if vids:
                return vids[0], info
        else:
            warnings.append("yt-dlp: " + ((p.stderr or "").strip().splitlines() or ["failed"])[-1][:300])
    else:
        warnings.append("没有安装 yt-dlp（pip install yt-dlp）。")
    if info["platform"] != "xiaohongshu":
        return None, info
    # Xiaohongshu video notes expose a direct stream URL in the page state.
    post = fetch_post.fetch_post(source)
    info.update({"title": info.get("title") or post.get("title"), "description": post.get("text")})
    if post.get("video_url"):
        referer = "https://www.xiaohongshu.com/" if post["platform"] == "xiaohongshu" else None
        status, _, body = fetch_post.http_get(post["video_url"], referer=referer, accept="video/*,*/*", timeout=120)
        if status == 200 and len(body) > 10_000:
            path = os.path.join(out_dir, "video.mp4")
            with open(path, "wb") as f:
                f.write(body)
            return path, info
        warnings.append(f"视频直链下载失败（HTTP {status}）。")
    warnings.extend(post.get("warnings") or [])
    return None, info


def whisper_transcribe(video: str, model: str, lang: str | None, warnings: list[str]) -> tuple[list[dict], str | None]:
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        warnings.append("没有安装 faster-whisper（pip install faster-whisper），跳过语音转文字。")
        return [], None
    try:
        import numpy as np  # installed with faster-whisper

        # Decode with ffmpeg rather than faster-whisper's PyAV path, which breaks across PyAV releases.
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                             capture_output=True, timeout=600).stdout
        audio = np.frombuffer(pcm, np.float32)
        if audio.size < 16000:
            warnings.append("视频没有可识别的音轨。")
            return [], None
        wm = WhisperModel(model, device="cpu", compute_type="int8")
        segs, meta = wm.transcribe(audio, language=lang, vad_filter=True, beam_size=1)
        out = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segs
               if s.text.strip()]
        spoken = sum(len(s["text"]) for s in out)
        if spoken < 15 and audio.size / 16000 > 30:
            # Whisper invents a word or two over background music; that is noise, not narration.
            warnings.append("音轨基本是音乐，没有可用的旁白；请看画面字幕。")
            return [], None
        return out, getattr(meta, "language", lang)
    except Exception as e:  # model download / decode problems should not kill the digest
        warnings.append(f"Whisper 失败：{e}")
        return [], None


def digest(source: str, out_dir: str, n_frames: int = 12, max_h: int = 720, whisper: str | None = None,
           lang: str | None = None, cookies: str | None = None, cookies_from_browser: str | None = None) -> dict:
    warnings: list[str] = []
    os.makedirs(out_dir, exist_ok=True)
    video, info = download(source, out_dir, cookies, cookies_from_browser, warnings)
    result: dict = {"source": source.strip()[:500], "title": info.get("title"), "description": info.get("description"),
                    "video_path": video, "duration_s": None, "frames": [], "contact_sheet": None,
                    "transcript": {"source": None, "language": None, "segments": []}, "warnings": warnings}
    if not video:
        return result
    duration = probe_duration(video)
    result["duration_s"] = duration
    if duration:
        result["frames"] = extract_frames(video, os.path.join(out_dir, "frames"), duration, n_frames, max_h)
        result["contact_sheet"] = contact_sheet(result["frames"], os.path.join(out_dir, "sheet.jpg"))
    subs = [p for p in glob.glob(os.path.join(out_dir, "video*.vtt")) + glob.glob(os.path.join(out_dir, "video*.srt"))]
    chosen = pick_subtitle(subs)
    if chosen:
        with open(chosen, encoding="utf-8", errors="replace") as f:
            segs = parse_vtt(f.read())
        if segs:
            result["transcript"] = {"source": "subtitles:" + os.path.basename(chosen), "language": None,
                                    "segments": segs}
    if not result["transcript"]["segments"] and whisper:
        segs, detected = whisper_transcribe(video, whisper, lang, warnings)
        if segs:
            result["transcript"] = {"source": f"whisper:{whisper}", "language": detected, "segments": segs}
    if not result["transcript"]["segments"]:
        warnings.append("没有字幕/转写：请看 frames 里的画面字幕。需要语音转文字时加 --whisper small。")
    with open(os.path.join(out_dir, "digest.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Video -> frames + transcript for Claude.")
    ap.add_argument("source", help="URL, share text or local video file")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--frames", type=int, default=12)
    ap.add_argument("--max-height", type=int, default=720)
    ap.add_argument("--whisper", metavar="MODEL", help="tiny|base|small|medium (needs faster-whisper)")
    ap.add_argument("--lang", help="speech language hint for Whisper, e.g. zh, en, ja")
    ap.add_argument("--cookies")
    ap.add_argument("--cookies-from-browser")
    args = ap.parse_args(argv)
    if not shutil.which("ffmpeg"):
        print(json.dumps({"error": "ffmpeg is required"}))
        return 2
    res = digest(args.source, args.out, args.frames, args.max_height, args.whisper, args.lang, args.cookies,
                 args.cookies_from_browser)
    segs = res["transcript"]["segments"]
    summary = {k: res[k] for k in ("title", "video_path", "duration_s", "contact_sheet", "warnings")}
    summary["frames"] = [f["path"] for f in res["frames"]]
    summary["transcript_source"] = res["transcript"]["source"]
    summary["transcript_text"] = "\n".join(f"[{s['start']:.0f}s] {s['text']}" for s in segs)[:12000]
    summary["digest_json"] = os.path.join(args.out, "digest.json")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if res["video_path"] else 1


if __name__ == "__main__":
    sys.exit(main())
