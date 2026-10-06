"""Offline tests for tools/video_digest.py helpers."""
import pathlib
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import video_digest as vd  # noqa: E402

AUTO_VTT = """WEBVTT
Kind: captions
Language: zh-Hans

00:00:01.000 --> 00:00:02.500 align:start position:0%
从浅草站<00:00:01.800><c>出来</c>

00:00:02.500 --> 00:00:04.000
从浅草站出来 走一号出口

00:00:04.000 --> 00:00:05.000
从浅草站出来 走一号出口

00:01:05.200 --> 00:01:07.000
雷门就在右手边
"""

SRT = """1
00:00:00,500 --> 00:00:02,000
Take the Ginza line

2
00:00:02,000 --> 00:00:03,000
to Ueno
"""


def test_parse_vtt_merges_rolling_auto_captions():
    segs = vd.parse_vtt(AUTO_VTT)
    assert [s["text"] for s in segs] == ["从浅草站出来", "走一号出口", "雷门就在右手边"]
    assert segs[1]["start"] == 2.5 and segs[1]["end"] == 5.0
    assert segs[2]["start"] == 65.2


def test_parse_srt():
    segs = vd.parse_vtt(SRT)
    assert segs == [
        {"start": 0.5, "end": 2.0, "text": "Take the Ginza line"},
        {"start": 2.0, "end": 3.0, "text": "to Ueno"},
    ]


def test_pick_subtitle_prefers_chinese_then_original():
    paths = ["/x/video.en.vtt", "/x/video.ja-orig.vtt", "/x/video.zh-Hans.vtt", "/x/video.fr.vtt"]
    assert vd.pick_subtitle(paths) == "/x/video.zh-Hans.vtt"
    assert vd.pick_subtitle(["/x/video.en.vtt", "/x/video.en-orig.vtt"]) == "/x/video.en-orig.vtt"
    assert vd.pick_subtitle([]) is None


def test_frame_times_are_centred():
    assert vd.frame_times(60, 4) == [7.5, 22.5, 37.5, 52.5]
    assert vd.frame_times(10, 1) == [5.0]


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_digest_local_file(tmp_path):
    video = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x568:rate=10:duration=4",
                    "-pix_fmt", "yuv420p", str(video)], check=True)
    out = vd.digest(str(video), str(tmp_path / "out"), n_frames=3)
    assert out["duration_s"] == pytest.approx(4, abs=0.2)
    assert len(out["frames"]) == 3
    assert pathlib.Path(out["contact_sheet"]).exists()
    assert (tmp_path / "out" / "digest.json").exists()
