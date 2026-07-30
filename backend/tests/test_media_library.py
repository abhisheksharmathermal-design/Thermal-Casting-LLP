"""
Media Library upgrade verification tests.
Covers: login, media list, upload (with save_to_library), patch media,
media replace (physical file cleanup), delete media (physical file cleanup),
and regression on products/categories/materials/company.
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://casting-master-dna.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "abhisheksharma@thermalcasting.com"
ADMIN_PASSWORD = "TCL@casting1234"


def _make_png_bytes(width=2, height=2):
    """Build a valid minimal PNG in-memory."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # RGB, 8-bit
    raw = b""
    for _ in range(height):
        raw += b"\x00" + b"\xff\x00\x00" * width  # filter + RGB
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data.get("user", {}).get("role") in ("admin", "super_admin")
    return data["access_token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def state():
    # shared state across the test flow
    return {}


# ---- 1. Login ----
def test_01_login_returns_admin(token):
    assert token


# ---- 2. GET /api/media baseline ----
def test_02_media_list_baseline(state):
    r = requests.get(f"{API}/media", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    state["baseline_count"] = len(items)


# ---- 3. Upload with save_to_library=true ----
def test_03_upload_saves_to_library(auth, state):
    png = _make_png_bytes()
    files = {"file": ("test.png", png, "image/png")}
    data = {"kind": "image", "save_to_library": "true", "title": "Test upload from tester"}
    r = requests.post(f"{API}/admin/upload", headers=auth, files=files, data=data, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "id" in body and body["id"]
    assert body["url"].startswith("/api/files/")
    assert body["content_type"] == "image/png"
    assert body["media_id"], "media_id should be non-null when save_to_library=true"
    state["upload_id_1"] = body["id"]
    state["url_1"] = body["url"]
    state["media_id"] = body["media_id"]
    state["filename_1"] = body["url"].split("/")[-1]

    # confirm physical file is fetchable
    fr = requests.get(f"{BASE_URL}{body['url']}", timeout=15)
    assert fr.status_code == 200, "uploaded file should be served"
    assert fr.headers.get("content-type", "").startswith("image/")


# ---- 4. Media list contains new item ----
def test_04_media_list_contains_new_item(state):
    r = requests.get(f"{API}/media", timeout=15)
    assert r.status_code == 200
    items = r.json()
    ids = [it.get("id") for it in items]
    assert state["media_id"] in ids, "new media_id must be in media list"
    assert len(items) >= state["baseline_count"] + 1


# ---- 5. PATCH media ----
def test_05_patch_media(auth, state):
    body = {"title": "Test renamed", "category": "QA", "featured": True, "tags": ["auto", "test"]}
    r = requests.patch(f"{API}/admin/media/{state['media_id']}", headers=auth, json=body, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc.get("title") == "Test renamed"
    assert doc.get("category") == "QA"
    assert doc.get("featured") is True
    assert doc.get("tags") == ["auto", "test"]


# ---- 6. Replace media -> old file 404 ----
def test_06_media_replace_removes_old_file(auth, state):
    # upload a second PNG (save_to_library=false so no dup media doc)
    png2 = _make_png_bytes(3, 3)
    files = {"file": ("second.png", png2, "image/png")}
    data = {"kind": "image", "save_to_library": "false", "title": ""}
    ur = requests.post(f"{API}/admin/upload", headers=auth, files=files, data=data, timeout=30)
    assert ur.status_code == 200, ur.text
    up2 = ur.json()
    assert up2["media_id"] is None
    state["upload_id_2"] = up2["id"]
    state["url_2"] = up2["url"]
    state["filename_2"] = up2["url"].split("/")[-1]

    # perform replace
    rep_body = {"url": up2["url"], "thumbnail_url": up2["url"], "upload_id": up2["id"]}
    rr = requests.post(f"{API}/admin/media/{state['media_id']}/replace",
                       headers=auth, json=rep_body, timeout=15)
    assert rr.status_code == 200, rr.text
    doc = rr.json()
    assert doc["url"] == up2["url"]
    assert doc.get("upload_id") == up2["id"]

    # old file should now return 404
    fr_old = requests.get(f"{BASE_URL}{state['url_1']}", timeout=15)
    assert fr_old.status_code == 404, f"old file expected 404, got {fr_old.status_code}"

    # new file still available
    fr_new = requests.get(f"{BASE_URL}{up2['url']}", timeout=15)
    assert fr_new.status_code == 200


# ---- 7. DELETE media removes it + physical file ----
def test_07_delete_media_cleans_up(auth, state):
    r = requests.delete(f"{API}/admin/media/{state['media_id']}", headers=auth, timeout=15)
    assert r.status_code == 200, r.text

    # media list no longer has it
    lr = requests.get(f"{API}/media", timeout=15)
    assert lr.status_code == 200
    ids = [it.get("id") for it in lr.json()]
    assert state["media_id"] not in ids

    # currently linked physical file gone (that was upload_id_2)
    fr = requests.get(f"{BASE_URL}{state['url_2']}", timeout=15)
    assert fr.status_code == 404, f"file expected 404 after media delete, got {fr.status_code}"


# ---- 8. Regression ----
@pytest.mark.parametrize("path", ["/products", "/categories", "/materials", "/company"])
def test_08_regression_public_endpoints(path):
    r = requests.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code}"
