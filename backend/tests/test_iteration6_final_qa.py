"""
Iteration 6 — FINAL QA before production deploy.

Focus:
 A. Login → token.
 B. Regression on public endpoints (company/products/categories/materials/media/media-videos).
 C. Media Library video sync:
    - PATCH updates title/description/category/tags/featured/thumbnail_url
    - GET /api/media/videos reflects immediately (no cache)
    - PATCH thumbnail_url=null clears it
 D. DELETE /api/admin/media/{id} still removes doc + physical file.
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://casting-master-dna.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "abhisheksharma@thermalcasting.com"
ADMIN_PASSWORD = "TCL@casting1234"


def _tiny_png():
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(2):
        raw += b"\x00" + b"\xff\x00\x00" * 2
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _tiny_mp4():
    """
    A truly minimal MP4 header (ftyp) — enough for the server to accept as
    a file upload. Not a playable video, but the backend just stores the bytes.
    """
    # ftyp box: size(4) 'ftyp' major_brand(4) minor(4) compatible_brand(4)
    box = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41" + b"\x00" * 8
    return box


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("user", {}).get("role") in ("admin", "super_admin")
    return body["access_token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def state():
    return {}


# ============ A. Login ============
def test_A_login(token):
    assert token and isinstance(token, str)


# ============ B. Regression on public endpoints ============
@pytest.mark.parametrize("path", [
    "/company",
    "/products",
    "/categories",
    "/materials",
    "/media",
    "/media/videos",
])
def test_B_public_endpoints_200(path):
    r = requests.get(f"{API}{path}", timeout=20)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
    # Also confirm JSON structure is a list (all these endpoints return arrays or dict)
    body = r.json()
    assert body is not None


# ============ C1. Upload a video and save to library ============
def test_C1_upload_video_saves_to_library(auth, state):
    mp4 = _tiny_mp4()
    files = {"file": ("qa_test.mp4", mp4, "video/mp4")}
    data = {"kind": "video", "save_to_library": "true", "title": "QA Video Original"}
    r = requests.post(f"{API}/admin/upload", headers=auth, files=files, data=data, timeout=45)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("media_id"), "expected media_id when save_to_library=true"
    assert body.get("url", "").startswith("/api/files/")
    state["media_id"] = body["media_id"]
    state["video_url"] = body["url"]
    state["video_filename"] = body["url"].split("/")[-1]


# ============ C2. PATCH media with all fields incl. thumbnail_url ============
def test_C2_patch_media_all_fields(auth, state):
    payload = {
        "title": "QA Video Title",
        "description": "QA desc",
        "category": "QA",
        "tags": ["a", "b"],
        "featured": True,
        "thumbnail_url": "/api/files/qa-thumb.jpg",
    }
    r = requests.patch(f"{API}/admin/media/{state['media_id']}",
                       headers=auth, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc.get("title") == "QA Video Title"
    assert doc.get("description") == "QA desc"
    assert doc.get("category") == "QA"
    assert doc.get("tags") == ["a", "b"]
    assert doc.get("featured") is True
    assert doc.get("thumbnail_url") == "/api/files/qa-thumb.jpg"


# ============ C3. GET /api/media/videos reflects patched values ============
def test_C3_media_videos_reflects_patch(state):
    r = requests.get(f"{API}/media/videos", timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    match = next((it for it in items if it.get("id") == state["media_id"]), None)
    assert match is not None, "patched video must appear in /api/media/videos"
    assert match.get("title") == "QA Video Title"
    assert match.get("description") == "QA desc"
    assert match.get("category") == "QA"
    assert match.get("tags") == ["a", "b"]
    assert match.get("featured") is True
    assert match.get("thumbnail_url") == "/api/files/qa-thumb.jpg"


# ============ C4. PATCH thumbnail_url = null clears it ============
def test_C4_patch_clear_thumbnail(auth, state):
    r = requests.patch(f"{API}/admin/media/{state['media_id']}",
                       headers=auth, json={"thumbnail_url": None}, timeout=20)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc.get("thumbnail_url") in (None, ""), f"expected null, got {doc.get('thumbnail_url')!r}"

    # confirm on /api/media/videos
    r2 = requests.get(f"{API}/media/videos", timeout=20)
    assert r2.status_code == 200
    match = next((it for it in r2.json() if it.get("id") == state["media_id"]), None)
    assert match is not None
    assert match.get("thumbnail_url") in (None, ""), \
        f"videos endpoint should show null thumbnail, got {match.get('thumbnail_url')!r}"


# ============ D. DELETE removes media + physical file ============
def test_D_delete_media_and_file(auth, state):
    r = requests.delete(f"{API}/admin/media/{state['media_id']}", headers=auth, timeout=20)
    assert r.status_code == 200, r.text

    # Not in /api/media
    lm = requests.get(f"{API}/media", timeout=20)
    assert lm.status_code == 200
    assert state["media_id"] not in [it.get("id") for it in lm.json()]

    # Not in /api/media/videos
    lv = requests.get(f"{API}/media/videos", timeout=20)
    assert lv.status_code == 200
    assert state["media_id"] not in [it.get("id") for it in lv.json()]

    # Physical file gone
    fr = requests.get(f"{BASE_URL}{state['video_url']}", timeout=20)
    assert fr.status_code == 404, f"physical file should be 404 after delete, got {fr.status_code}"
