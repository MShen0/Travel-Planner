#!/usr/bin/env python3
"""Read a social-media post from a share text or link and print it as JSON.

Supported: Xiaohongshu (小红书), TikTok, YouTube, Instagram, Douyin (抖音),
Bilibili and ordinary web pages. Paste the whole share text, not just the
link: Xiaohongshu and Douyin share texts carry the post title, which is the
fallback when the platform refuses to serve the page.

    python tools/fetch_post.py "<share text or url>"
    python tools/fetch_post.py "<...>" --download-images .cache/post-images --max-images 9

Output (stdout, UTF-8 JSON):
    ok, platform, input_url, url, id, kind (images|video|article|unknown),
    title, text, tags, author, published_at, location_hint, images,
    video_url, duration_s, stats, local_images, share_text_title,
    method, warnings

Only the standard library is required. yt-dlp is used when installed, as a
fallback for video platforms (pass --cookies / --cookies-from-browser for
Instagram on your own machine).
"""
from __future__ import annotations

import argparse
import html as htmllib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from provenance import embed_origin  # noqa: E402

DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
PREVIEW_BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"

URL_RE = re.compile(r"https?://[^\s<>\"'，。！？、；：（）【】《》「」]+", re.I)
# Characters that often stick to the end of a pasted link.
TRAILING_JUNK = ".,;:!?)]}>'\"，。！？、）】》」…"

XHS_NOTE_RE = re.compile(r"/(?:explore|discovery/item|item)/([0-9a-f]{24})", re.I)
XHS_EMOJI_RE = re.compile(r"\[[^\[\]\s]{1,8}R\]")  # [笑哭R], [向右R] …
XHS_TOPIC_RE = re.compile(r"\[话题\]#?")


# --------------------------------------------------------------------------
# Pure helpers (unit-tested, no network)
# --------------------------------------------------------------------------

def extract_urls(text: str) -> list[str]:
    """All http(s) links in a share text, trailing punctuation removed."""
    urls = []
    for m in URL_RE.finditer(text or ""):
        u = m.group(0).rstrip(TRAILING_JUNK)
        if u and u not in urls:
            urls.append(u)
    return urls


def detect_platform(url_or_text: str) -> str:
    s = (url_or_text or "").lower()
    host = urllib.parse.urlparse(s).netloc if s.startswith("http") else s
    rules = [
        ("xiaohongshu", ("xiaohongshu.com", "xhslink.com", "xhs.cn", "小红书")),
        ("instagram", ("instagram.com", "instagr.am")),
        ("tiktok", ("tiktok.com",)),
        ("douyin", ("douyin.com", "iesdouyin.com", "抖音")),
        ("youtube", ("youtube.com", "youtu.be")),
        ("bilibili", ("bilibili.com", "b23.tv", "哔哩哔哩")),
    ]
    for name, needles in rules:
        if any(n in host for n in needles):
            return name
    return "web"


def pick_url(text: str) -> str | None:
    """The link that matters in a share text (social links beat others)."""
    urls = extract_urls(text)
    if not urls:
        return None
    for u in urls:
        if detect_platform(u) != "web":
            return u
    return urls[0]


def share_text_title(text: str) -> str | None:
    """Title carried inside an app share text, if any.

    Xiaohongshu: "… 【东京3日游｜懒人版攻略 - 作者 | 小红书 - 你的生活指南】 😆 code 😆 http://xhslink.com/…"
    Douyin:      "7.43 复制打开抖音，看看【作者的作品】东京一日游 #旅行 … https://v.douyin.com/…/"
    """
    if not text:
        return None
    t = text.strip()
    for m in re.finditer(r"【([^【】]{2,200})】", t):
        inner = m.group(1).strip()
        if inner in ("小红书",) or inner.endswith("的作品"):
            continue
        # "标题 - 作者 | 小红书 - 你的生活指南"
        inner = re.split(r"\s*\|\s*小红书", inner)[0]
        inner = re.sub(r"\s+-\s+[^-]{1,40}$", "", inner).strip()
        if inner:
            return inner
    m = re.search(r"【[^【】]*的作品】\s*(.+?)\s*https?://", t, re.S)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip() or None
    m = re.search(r"《([^《》]{2,200})》", t)
    if m:
        return m.group(1).strip()
    if "发布了一篇小红书笔记" in t:
        return None  # "<author>发布了一篇小红书笔记，快来看吧！" names the author, not the post
    # Bare text around the link, minus app boilerplate.
    stripped = URL_RE.sub(" ", t)
    for junk in ("复制本条信息，打开【小红书】App查看精彩内容！", "复制打开抖音，看看", "发布了一篇小红书笔记，快来看吧！"):
        stripped = stripped.replace(junk, " ")
    stripped = re.sub(r"[😆\s]+", " ", stripped).strip(" -|")
    return stripped[:200] or None


def xhs_note_id(url: str) -> tuple[str | None, str | None]:
    """(note_id, xsec_token) from any Xiaohongshu note URL."""
    m = XHS_NOTE_RE.search(url or "")
    if not m:
        return None, None
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    token = (q.get("xsec_token") or [None])[0]
    return m.group(1).lower(), token


def xhs_canonical_url(note_id: str, token: str | None) -> str:
    base = f"https://www.xiaohongshu.com/explore/{note_id}"
    if token:
        return base + "?" + urllib.parse.urlencode({"xsec_token": token, "xsec_source": "pc_share"})
    return base


def parse_initial_state(page_html: str) -> dict | None:
    """window.__INITIAL_STATE__ as a dict (Xiaohongshu embeds JS `undefined`)."""
    m = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*</script>", page_html or "", re.S)
    if not m:
        return None
    raw = re.sub(r"(?<=[:\[,])\s*undefined\b", "null", m.group(1))
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def clean_xhs_text(s: str | None) -> str:
    s = XHS_EMOJI_RE.sub("", s or "")
    s = XHS_TOPIC_RE.sub("", s)
    return re.sub(r"[ \t]+\n", "\n", s).strip()


def _https(u: str | None) -> str | None:
    if not u:
        return None
    if u.startswith("//"):
        return "https:" + u
    return re.sub(r"^http://", "https://", u)


def parse_xhs_note(state: dict) -> dict | None:
    """The note inside a Xiaohongshu __INITIAL_STATE__."""
    detail = ((state or {}).get("note") or {}).get("noteDetailMap") or {}
    note = None
    for v in detail.values():
        if isinstance(v, dict) and (v.get("note") or {}).get("noteId"):
            note = v["note"]
            break
    if not note:
        return None
    images = []
    for img in note.get("imageList") or []:
        url = img.get("urlDefault") or img.get("url") or ""
        if not url:
            for info in img.get("infoList") or []:
                if info.get("url"):
                    url = info["url"]
                    if info.get("imageScene") in ("WB_DFT", "CRD_WM_WEBP"):
                        break
        if url:
            images.append(_https(url))
    video_url, duration = None, None
    video = note.get("video") or {}
    streams = ((video.get("media") or {}).get("stream")) or {}
    for codec in ("h264", "h265", "av1", "h266"):
        for s in streams.get(codec) or []:
            u = s.get("masterUrl") or (s.get("backupUrls") or [None])[0]
            if u:
                video_url = _https(u)
                break
        if video_url:
            break
    capa = video.get("capa") or {}
    if capa.get("duration"):
        duration = capa["duration"]
    published = None
    if note.get("time"):
        published = datetime.fromtimestamp(note["time"] / 1000, tz=timezone.utc).isoformat()
    interact = note.get("interactInfo") or {}
    kind = "video" if (note.get("type") == "video" or video_url) else "images"
    return {
        "id": note.get("noteId"),
        "kind": kind,
        "title": (note.get("title") or "").strip(),
        "text": clean_xhs_text(note.get("desc")),
        "tags": [t.get("name") for t in note.get("tagList") or [] if t.get("name")],
        "author": (note.get("user") or {}).get("nickname"),
        "published_at": published,
        "location_hint": note.get("ipLocation"),
        "images": images,
        "video_url": video_url,
        "duration_s": duration,
        "stats": {
            "likes": interact.get("likedCount"),
            "collects": interact.get("collectedCount"),
            "comments": interact.get("commentCount"),
        },
    }


def parse_meta(page_html: str) -> dict:
    """OpenGraph / description / <title> from any HTML page."""
    out: dict = {"images": []}
    for tag in re.findall(r"<meta\b[^>]*>", page_html or "", re.I):
        key = re.search(r"\b(?:property|name)\s*=\s*[\"']([^\"']+)[\"']", tag, re.I)
        val = re.search(r"\bcontent\s*=\s*[\"']([^\"']*)[\"']", tag, re.I)
        if not key or not val:
            continue
        k, v = key.group(1).lower(), htmllib.unescape(val.group(1)).strip()
        if k == "og:image" and v:
            u = _https(v)
            if u not in out["images"]:
                out["images"].append(u)
        elif k in ("og:title", "twitter:title") and v:
            out.setdefault("title", v)
        elif k in ("og:description", "description", "twitter:description") and v:
            out.setdefault("description", v)
        elif k == "keywords" and v:
            out["keywords"] = [s.strip() for s in re.split(r"[,，]", v) if s.strip()]
        elif k in ("og:video", "og:video:url", "og:video:secure_url") and v:
            out.setdefault("video", _https(v))
    if "title" not in out:
        m = re.search(r"<title[^>]*>(.*?)</title>", page_html or "", re.I | re.S)
        if m:
            out["title"] = htmllib.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
    return out


def readable_text(page_html: str, limit: int = 8000) -> str:
    """Rough article text for blogs and guide pages."""
    s = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header|form)\b.*?</\1>", " ", page_html or "")
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr)>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    lines = [re.sub(r"[ \t ]+", " ", ln).strip() for ln in s.splitlines()]
    text = "\n".join(ln for ln in lines if len(ln) > 1)
    return text[:limit]


def strip_xhs_suffix(title: str | None) -> str | None:
    if not title:
        return title
    return re.sub(r"\s*-\s*小红书.*$", "", title).strip()


# --------------------------------------------------------------------------
# Network
# --------------------------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None


def http_get(url: str, ua: str = DESKTOP_UA, timeout: int = 20, referer: str | None = None,
             accept: str = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8") -> tuple[int, str, bytes]:
    """(status, final_url, body). Follows redirects."""
    headers = {"User-Agent": ua, "Accept": accept, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.6"}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.geturl(), r.read()
    except urllib.error.HTTPError as e:
        return e.code, url, e.read() if hasattr(e, "read") else b""


def redirect_chain(url: str, ua: str = DESKTOP_UA, timeout: int = 15, hops: int = 6) -> list[str]:
    """Every URL a short link passes through, without loading the last page."""
    opener = urllib.request.build_opener(_NoRedirect)
    chain = [url]
    for _ in range(hops):
        req = urllib.request.Request(chain[-1], headers={"User-Agent": ua})
        try:
            with opener.open(req, timeout=timeout):
                break  # 2xx: end of chain
        except urllib.error.HTTPError as e:
            loc = e.headers.get("Location") if e.code in (301, 302, 303, 307, 308) else None
            if not loc:
                break
            chain.append(urllib.parse.urljoin(chain[-1], loc))
        except urllib.error.URLError:
            break
    return chain


def _decode(body: bytes) -> str:
    for enc in ("utf-8", "gb18030"):
        try:
            return body.decode(enc)
        except UnicodeDecodeError:
            continue
    return body.decode("utf-8", "replace")


def ytdlp_info(url: str, cookies: str | None = None, cookies_from_browser: str | None = None,
               timeout: int = 90) -> dict | None:
    exe = shutil.which("yt-dlp")
    if not exe:
        return None
    cmd = [exe, "-J", "--skip-download", "--no-warnings", "--no-playlist"]
    if cookies:
        cmd += ["--cookies", cookies]
    if cookies_from_browser:
        cmd += ["--cookies-from-browser", cookies_from_browser]
    try:
        p = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError):
        return None
    if p.returncode != 0 or not p.stdout.strip():
        return {"_error": (p.stderr or "").strip().splitlines()[-1:] or ["yt-dlp failed"]}
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        return None


def _apply_ytdlp(result: dict, info: dict | None) -> bool:
    if not info or info.get("_error"):
        if info and info.get("_error"):
            result["warnings"].append("yt-dlp: " + info["_error"][0])
        return False
    result["title"] = result.get("title") or info.get("title")
    result["text"] = result.get("text") or info.get("description") or ""
    result["author"] = result.get("author") or info.get("uploader") or info.get("channel")
    result["duration_s"] = result.get("duration_s") or info.get("duration")
    result["kind"] = "video"
    tags = info.get("tags") or []
    result["tags"] = result.get("tags") or [t for t in tags if t][:20]
    thumbs = [t.get("url") for t in (info.get("thumbnails") or []) if t.get("url")]
    if thumbs and not result["images"]:
        result["images"] = [thumbs[-1]]
    if info.get("timestamp") and not result.get("published_at"):
        result["published_at"] = datetime.fromtimestamp(info["timestamp"], tz=timezone.utc).isoformat()
    chapters = info.get("chapters") or []
    if chapters:
        result["chapters"] = [{"start": c.get("start_time"), "title": c.get("title")} for c in chapters]
    subs = sorted(k for k in (info.get("subtitles") or {}) if k != "live_chat")
    auto = [k for k in (info.get("automatic_captions") or {}) if k.endswith("-orig")]
    if subs or auto:
        result["subtitle_langs"] = (subs + auto)[:15]
    result["method"] = result["method"] or "yt_dlp"
    return True


# --------------------------------------------------------------------------
# Platform readers
# --------------------------------------------------------------------------

def read_xiaohongshu(url: str, result: dict, timeout: int) -> None:
    note_id, token = xhs_note_id(url)
    if not note_id:
        chain = redirect_chain(url, timeout=timeout)
        for u in chain:
            note_id, token = xhs_note_id(u)
            if note_id:
                break
        if not note_id:
            result["warnings"].append("小红书短链没有解析出笔记 ID（链接可能已失效）。")
            return
    result["id"] = note_id
    candidates = [xhs_canonical_url(note_id, token)]
    if token:
        candidates.append(xhs_canonical_url(note_id, None))
    for cand in candidates:
        status, final, body = http_get(cand, timeout=timeout)
        page = _decode(body)
        if status != 200 or "/404" in urllib.parse.urlparse(final).path:
            continue
        note = parse_xhs_note(parse_initial_state(page) or {})
        if note:
            result.update({k: v for k, v in note.items() if v not in (None, "", [])})
            result["url"] = cand
            result["method"] = "xhs_initial_state"
            return
        meta = parse_meta(page)
        if meta.get("title") and strip_xhs_suffix(meta["title"]) not in ("", "小红书"):
            result["title"] = strip_xhs_suffix(meta["title"])
            result["text"] = meta.get("description", "")
            result["tags"] = meta.get("keywords", [])
            result["images"] = [i for i in meta["images"] if "picasso-static" not in i]
            result["url"] = cand
            result["method"] = "og_meta"
            return
    result["warnings"].append(
        "小红书没有返回笔记内容（可能需要登录或链接缺少 xsec_token）。请把笔记截图或正文发给 Claude。"
    )


def read_tiktok(url: str, result: dict, timeout: int, **yt) -> None:
    status, _, body = http_get("https://www.tiktok.com/oembed?url=" + urllib.parse.quote(url, safe=""), timeout=timeout)
    if status == 200:
        try:
            d = json.loads(body)
            result.update({"title": d.get("title"), "text": d.get("title") or "", "author": d.get("author_name"),
                           "images": [d["thumbnail_url"]] if d.get("thumbnail_url") else [], "kind": "video",
                           "method": "oembed"})
        except (json.JSONDecodeError, KeyError):
            pass
    _apply_ytdlp(result, ytdlp_info(url, **yt))


def read_youtube(url: str, result: dict, timeout: int, **yt) -> None:
    status, _, body = http_get("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe=""),
                               timeout=timeout)
    if status == 200:
        try:
            d = json.loads(body)
            result.update({"title": d.get("title"), "author": d.get("author_name"),
                           "images": [d["thumbnail_url"]] if d.get("thumbnail_url") else [], "kind": "video",
                           "method": "oembed"})
        except json.JSONDecodeError:
            pass
    _apply_ytdlp(result, ytdlp_info(url, **yt))


def read_instagram(url: str, result: dict, timeout: int, **yt) -> None:
    status, _, body = http_get(url, ua=PREVIEW_BOT_UA, timeout=timeout)
    if status == 200:
        meta = parse_meta(_decode(body))
        desc = meta.get("description") or ""
        # 'N likes, M comments - user on May 1, 2026: "caption…"'
        m = re.search(r':\s*"(.*)"\s*\.?\s*$', desc, re.S)
        caption = m.group(1) if m else ""
        generic = (meta.get("title") or "").strip() in ("", "Instagram", "Login • Instagram")
        if caption or not generic:
            result.update({"title": meta.get("title"), "text": caption, "images": meta["images"][:1],
                           "kind": "video" if "/reel" in url else "images", "method": "og_meta"})
            return
    if _apply_ytdlp(result, ytdlp_info(url, **yt)):
        return
    result["warnings"].append(
        "Instagram 不让服务器读取（需要登录）。请复制 Reels 的文案，或截图发给 Claude；"
        "在自己电脑上可加 --cookies-from-browser chrome 再试。"
    )


def read_bilibili(url: str, result: dict, timeout: int, **yt) -> None:
    target = url
    if "b23.tv" in url:
        target = redirect_chain(url, timeout=timeout)[-1]
    m = re.search(r"(BV[0-9A-Za-z]{10})", target)
    if m:
        status, _, body = http_get("https://api.bilibili.com/x/web-interface/view?bvid=" + m.group(1),
                                   timeout=timeout, referer="https://www.bilibili.com/")
        try:
            d = json.loads(body).get("data") if status == 200 else None
        except json.JSONDecodeError:
            d = None
        if d:
            result.update({"id": m.group(1), "title": d.get("title"), "text": d.get("desc") or "",
                           "author": (d.get("owner") or {}).get("name"), "duration_s": d.get("duration"),
                           "images": [_https(d.get("pic"))] if d.get("pic") else [], "kind": "video",
                           "method": "bilibili_api"})
            return
    _apply_ytdlp(result, ytdlp_info(url, **yt))


def read_douyin(url: str, result: dict, timeout: int, **yt) -> None:
    if _apply_ytdlp(result, ytdlp_info(url, **yt)):
        return
    status, final, body = http_get(url, timeout=timeout)
    if status == 200:
        meta = parse_meta(_decode(body))
        if meta.get("title") and meta["title"] not in ("抖音",):
            result.update({"title": meta.get("title"), "text": meta.get("description", ""),
                           "images": meta["images"][:1], "kind": "video", "method": "og_meta", "url": final})
            return
    result["warnings"].append("抖音没有返回内容。分享文字里的标题已保留；也可以截图发给 Claude。")


def read_web(url: str, result: dict, timeout: int) -> None:
    status, final, body = http_get(url, timeout=timeout)
    if status != 200:
        result["warnings"].append(f"网页返回 HTTP {status}。")
        return
    page = _decode(body)
    meta = parse_meta(page)
    result.update({"url": final, "title": meta.get("title"), "images": meta["images"][:6], "kind": "article",
                   "tags": meta.get("keywords", [])[:20], "method": "og_meta"})
    body_text = readable_text(page)
    result["text"] = (meta.get("description", "") + "\n\n" + body_text).strip()


def download_images(urls: list[str], out_dir: str, limit: int, referer: str | None, timeout: int, source: str | None = None) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for i, u in enumerate(urls[:limit], 1):
        status, _, body = http_get(u, timeout=timeout, referer=referer, accept="image/avif,image/webp,image/*,*/*;q=0.8")
        if status != 200 or len(body) < 1000:
            continue
        ext = ".png" if body[:4] == b"\x89PNG" else ".webp" if body[8:12] == b"WEBP" else ".jpg"
        path = os.path.join(out_dir, f"{i:02d}{ext}")
        with open(path, "wb") as f:
            f.write(body)
        embed_origin(path, f"Post image {i} from {source or u}, downloaded by tools/fetch_post.py; belongs to the post's author")
        paths.append(path)
    return paths


def fetch_post(share: str, download_dir: str | None = None, max_images: int = 9, timeout: int = 20,
               cookies: str | None = None, cookies_from_browser: str | None = None) -> dict:
    url = pick_url(share)
    platform = detect_platform(url or share)
    result: dict = {
        "ok": False, "platform": platform, "input_url": url, "url": url, "id": None, "kind": "unknown",
        "title": None, "text": "", "tags": [], "author": None, "published_at": None, "location_hint": None,
        "images": [], "video_url": None, "duration_s": None, "stats": None, "local_images": [],
        "share_text_title": share_text_title(share) if share and share.strip() != (url or "") else None,
        "method": None, "warnings": [],
    }
    if not url:
        result["warnings"].append("没有找到链接。直接把文字/截图交给 Claude 识别即可。")
        result["text"] = share or ""
        result["method"] = "share_text"
        result["ok"] = bool(result["text"].strip())
        return result
    yt = {"cookies": cookies, "cookies_from_browser": cookies_from_browser}
    try:
        if platform == "xiaohongshu":
            read_xiaohongshu(url, result, timeout)
        elif platform == "tiktok":
            read_tiktok(url, result, timeout, **yt)
        elif platform == "youtube":
            read_youtube(url, result, timeout, **yt)
        elif platform == "instagram":
            read_instagram(url, result, timeout, **yt)
        elif platform == "bilibili":
            read_bilibili(url, result, timeout, **yt)
        elif platform == "douyin":
            read_douyin(url, result, timeout, **yt)
        else:
            read_web(url, result, timeout)
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        result["warnings"].append(f"网络错误：{e}")
    if not result.get("title") and result.get("share_text_title"):
        result["title"] = result["share_text_title"]
        result["method"] = result["method"] or "share_text"
    if download_dir and result["images"]:
        referer = "https://www.xiaohongshu.com/" if platform == "xiaohongshu" else None
        result["local_images"] = download_images(result["images"], download_dir, max_images, referer, timeout, result.get("url"))
    result["ok"] = bool(result.get("text") or result.get("title") or result["images"])
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("share", nargs="?", help="share text or URL (reads stdin when omitted)")
    ap.add_argument("--download-images", metavar="DIR", help="save the post images here for Claude to read")
    ap.add_argument("--max-images", type=int, default=9)
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--cookies", help="cookies.txt for yt-dlp (Instagram/Douyin on your own machine)")
    ap.add_argument("--cookies-from-browser", help="e.g. chrome, safari, firefox (passed to yt-dlp)")
    args = ap.parse_args(argv)
    share = args.share if args.share is not None else sys.stdin.read()
    out = fetch_post(share, args.download_images, args.max_images, args.timeout, args.cookies,
                     args.cookies_from_browser)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
