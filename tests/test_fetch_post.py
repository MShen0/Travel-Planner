"""Offline tests for tools/fetch_post.py (no network)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import fetch_post as fp  # noqa: E402

FIXTURE = (ROOT / "tests" / "fixtures" / "xhs_note.html").read_text(encoding="utf-8")

XHS_APP_SHARE = (
    "【东京3日游｜懒人版攻略 - 旅行的小王 | 小红书 - 你的生活指南】 😆 6E8kGnSd9JiMk7l 😆 "
    "http://xhslink.com/m/1gJ5tOG6M1b，复制本条信息，打开【小红书】App查看精彩内容！"
)
XHS_AUTHOR_SHARE = (
    "57 小王发布了一篇小红书笔记，快来看吧！ 😆 abc 😆 http://xhslink.com/a/do9xGe，"
    "复制本条信息，打开【小红书】App查看精彩内容！"
)
DOUYIN_SHARE = (
    "7.43 复制打开抖音，看看【小李的作品】成都三天两夜吃到扶墙 # 成都美食 https://v.douyin.com/iRNBho6u/ "
    "abc:/ 02/28 M@w.Fh"
)


def test_extract_urls_strips_chinese_punctuation():
    assert fp.extract_urls(XHS_APP_SHARE) == ["http://xhslink.com/m/1gJ5tOG6M1b"]
    assert fp.extract_urls("看这个 https://youtu.be/abc123。好看！") == ["https://youtu.be/abc123"]


def test_pick_url_prefers_social_links():
    text = "参考 https://example.com/blog 还有 https://www.instagram.com/reel/C0abc/?igsh=xyz"
    assert fp.pick_url(text) == "https://www.instagram.com/reel/C0abc/?igsh=xyz"
    assert fp.pick_url("没有链接") is None


def test_detect_platform():
    cases = {
        "http://xhslink.com/m/1gJ5": "xiaohongshu",
        "https://www.xiaohongshu.com/explore/6a0000000000000000abcdef": "xiaohongshu",
        "https://www.instagram.com/reel/C0abc/": "instagram",
        "https://vt.tiktok.com/ZS123/": "tiktok",
        "https://v.douyin.com/iRNBho6u/": "douyin",
        "https://youtu.be/dQw4w9WgXcQ": "youtube",
        "https://b23.tv/abc": "bilibili",
        "https://www.japan-guide.com/e/e3007.html": "web",
    }
    for url, platform in cases.items():
        assert fp.detect_platform(url) == platform, url


def test_share_text_title_formats():
    assert fp.share_text_title(XHS_APP_SHARE) == "东京3日游｜懒人版攻略"
    assert fp.share_text_title(XHS_AUTHOR_SHARE) is None
    assert fp.share_text_title(DOUYIN_SHARE) == "成都三天两夜吃到扶墙 # 成都美食"
    assert fp.share_text_title("《京都红叶季路线》 https://example.com/x") == "京都红叶季路线"


def test_xhs_note_id_and_canonical_url():
    nid, token = fp.xhs_note_id(
        "https://www.xiaohongshu.com/discovery/item/6A0000000000000000ABCDEF?xsec_token=ABx%3D&xsec_source=app_share"
    )
    assert nid == "6a0000000000000000abcdef"
    assert token == "ABx="
    assert fp.xhs_canonical_url(nid, None) == "https://www.xiaohongshu.com/explore/6a0000000000000000abcdef"
    assert "xsec_token=ABx%3D" in fp.xhs_canonical_url(nid, token)
    assert fp.xhs_note_id("https://www.xiaohongshu.com/user/profile/123") == (None, None)


def test_parse_xhs_note_from_initial_state():
    state = fp.parse_initial_state(FIXTURE)
    assert state is not None, "JS undefined must be tolerated"
    note = fp.parse_xhs_note(state)
    assert note["id"] == "6a0000000000000000abcdef"
    assert note["kind"] == "images"
    assert note["title"] == "大阪两天吃什么｜黑门市场到道顿堀"
    assert "[馋R]" not in note["text"] and "[话题]" not in note["text"]
    assert "一兰拉面" in note["text"]
    assert note["tags"] == ["大阪美食", "黑门市场"]
    assert note["author"] == "示例作者"
    assert note["images"] == [
        "https://sns-webpic-qc.xhscdn.com/1/aaa/img1!nd_dft_wlteh_jpg_3",
        "https://sns-webpic-qc.xhscdn.com/1/bbb/img2!nd_dft",
    ]
    assert note["stats"]["likes"] == "1.2万"
    assert note["published_at"].startswith("2025-10-09")


def test_parse_meta_fallback():
    meta = fp.parse_meta(FIXTURE)
    assert fp.strip_xhs_suffix(meta["title"]) == "大阪两天吃什么｜黑门市场到道顿堀"
    assert meta["keywords"] == ["大阪美食", "黑门市场", "道顿堀"]
    assert meta["images"][1] == "https://sns-webpic-qc.xhscdn.com/1/aaa/img1!nd_dft_wlteh_jpg_3"


def test_readable_text_drops_scripts():
    page = "<html><script>var x=1</script><h1>京都一日</h1><p>清水寺 → 二年坂</p><nav>menu</nav></html>"
    text = fp.readable_text(page)
    assert "var x" not in text and "menu" not in text
    assert "京都一日" in text and "清水寺 → 二年坂" in text


def test_fetch_post_without_link_returns_text():
    out = fp.fetch_post("银座 鸟贵族 晚上8点后不用排队")
    assert out["ok"] is True
    assert out["method"] == "share_text"
    assert out["text"].startswith("银座")
