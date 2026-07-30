"""
Category System bug-fix verification (see /app/backend/checkpoint_categories_pre_cleanup.json).

Tests verify:
- Public /api/categories returns only enabled admin categories
- /api/products/categories now sourced from db.categories (parity with /api/categories names)
- Duplicate/whitespace/case-insensitive rejection on create/rename
- Auto-link on category create with exact normalized match (no fuzzy)
- Case/whitespace insensitive product filter
- Rename cascade to products
- Disable hides from public
- Delete does not touch products
- Cleanup is idempotent on clean DB
- RBAC on admin endpoints
- Regressions: 87 products, materials, media/videos, guest RFQ
"""
import os
import pytest
import requests
from conftest import API, ADMIN_EMAIL, ADMIN_PASSWORD, auth


# ---------- session admin token (module-scoped) ----------
@pytest.fixture(scope="module")
def token(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ---------- 1. Login ----------
def test_admin_login(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body
    assert body.get("user", {}).get("role") in ("admin", "super_admin")


# ---------- 2. GET /api/categories only enabled ----------
def test_public_categories_only_enabled(api_client):
    r = api_client.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list) and len(cats) >= 1
    for c in cats:
        assert c.get("enabled") is True
        # no MongoDB _id leak
        assert "_id" not in c
        # name must have no trailing/leading whitespace, no double-space
        assert c["name"] == c["name"].strip()
        assert "  " not in c["name"]


# ---------- 3. Parity with /api/products/categories ----------
def test_products_categories_matches_admin(api_client):
    admin_cats = api_client.get(f"{API}/categories").json()
    admin_names_sorted = sorted([c["name"] for c in admin_cats])

    r = api_client.get(f"{API}/products/categories")
    assert r.status_code == 200
    body = r.json()
    # backend returns {"categories": [...]} likely; support both shapes
    names = body.get("categories") if isinstance(body, dict) else body
    assert isinstance(names, list)
    assert sorted(names) == admin_names_sorted, f"{sorted(names)} != {admin_names_sorted}"


# ---------- 4. Expected clean names present ----------
def test_expected_names_present(api_client):
    names = {c["name"] for c in api_client.get(f"{API}/categories").json()}
    expected = {
        "Aluminium Smelting Parts",
        "Mining and Crushing Parts",
        "Pump Castings",
        "Steel Mill Parts",
        "Valve Castings",
        "Bowl Mill Components",
    }
    missing = expected - names
    assert not missing, f"Missing expected categories: {missing} — present: {names}"


# ---------- 5. Duplicate name rejection ----------
def test_duplicate_name_case_insensitive(api_client, token):
    r = api_client.post(f"{API}/admin/categories", json={"name": "valve castings"}, headers=auth(token))
    assert r.status_code == 409, r.text
    assert "already exists" in r.json().get("detail", "").lower()


def test_duplicate_name_with_whitespace(api_client, token):
    r = api_client.post(f"{API}/admin/categories", json={"name": "VALVE CASTINGS "}, headers=auth(token))
    assert r.status_code == 409, r.text


# ---------- 6. Empty name rejected ----------
@pytest.mark.parametrize("bad", ["", "   ", "\t"])
def test_empty_name_rejected(api_client, token, bad):
    r = api_client.post(f"{API}/admin/categories", json={"name": bad}, headers=auth(token))
    assert r.status_code == 400, r.text
    assert "required" in r.json().get("detail", "").lower()


# ---------- 7. Create new category & appears in public ----------
def test_create_fresh_category_then_delete(api_client, token):
    name = "Test Category Alpha"
    # try to clean if leftover
    listing = api_client.get(f"{API}/categories").json()
    for c in listing:
        if c["name"].lower() == name.lower():
            api_client.delete(f"{API}/admin/categories/{c['id']}", headers=auth(token))

    r = api_client.post(f"{API}/admin/categories", json={"name": name}, headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == name
    assert body.get("enabled") is True
    cid = body["id"]
    try:
        listing = api_client.get(f"{API}/categories").json()
        assert any(c["id"] == cid for c in listing)
    finally:
        d = api_client.delete(f"{API}/admin/categories/{cid}", headers=auth(token))
        assert d.status_code == 200, d.text


# ---------- 8. Auto-link on create (exact normalized match) ----------
def test_autolink_on_create(api_client, token):
    # create a product with whitespace-y category
    prod_payload = {
        "name": "TEST_TempProduct_Autolink",
        "category": "TempCat XYZ  ",  # trailing whitespace intentional
        "description": "temp for autolink test",
        "enabled": True,
    }
    pr = api_client.post(f"{API}/admin/products/full", json=prod_payload, headers=auth(token))
    assert pr.status_code == 200, pr.text
    pid = pr.json()["id"]

    # ensure category does not already exist; if it does, delete
    for c in api_client.get(f"{API}/categories").json():
        if c["name"].lower().strip() == "tempcat xyz":
            api_client.delete(f"{API}/admin/categories/{c['id']}", headers=auth(token))

    cr = None
    cid = None
    try:
        cr = api_client.post(f"{API}/admin/categories", json={"name": "TempCat XYZ"}, headers=auth(token))
        assert cr.status_code == 200, cr.text
        cid = cr.json()["id"]

        # product must be reachable via category filter and its category normalized
        r = api_client.get(f"{API}/products", params={"category": "TempCat XYZ"})
        assert r.status_code == 200
        prods = r.json()
        matched = [p for p in prods if p["id"] == pid]
        assert matched, "Auto-linked product not returned by category filter"
        assert matched[0]["category"] == "TempCat XYZ", f"expected normalized 'TempCat XYZ' got {matched[0]['category']!r}"
    finally:
        # cleanup
        api_client.delete(f"{API}/admin/products/{pid}", headers=auth(token))
        if cid:
            api_client.delete(f"{API}/admin/categories/{cid}", headers=auth(token))


# ---------- 9. Product filter case/whitespace insensitive ----------
def test_product_filter_exact_and_lower(api_client):
    r1 = api_client.get(f"{API}/products", params={"category": "Valve Castings"})
    r2 = api_client.get(f"{API}/products", params={"category": "valve castings"})
    assert r1.status_code == 200 and r2.status_code == 200
    a = r1.json()
    b = r2.json()
    assert len(a) == len(b), f"case-insensitive filter mismatch {len(a)} vs {len(b)}"
    for p in a:
        assert p["category"] == "Valve Castings"


# ---------- 10. Bowl Mill Components exactly 5 products ----------
def test_bowl_mill_components_count(api_client):
    r = api_client.get(f"{API}/products", params={"category": "Bowl Mill Components"})
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) == 5, f"Expected 5 Bowl Mill Components, got {len(prods)}: {[p['name'] for p in prods]}"


# ---------- 11. Rename cascade ----------
def test_rename_cascade(api_client, token):
    cats = api_client.get(f"{API}/categories").json()
    bm = next((c for c in cats if c["name"] == "Bowl Mill Components"), None)
    assert bm, "Bowl Mill Components category not present"
    cid = bm["id"]

    try:
        pr = api_client.patch(f"{API}/admin/categories/{cid}", json={"name": "Bowl Mill Assemblies"}, headers=auth(token))
        assert pr.status_code == 200, pr.text

        r1 = api_client.get(f"{API}/products", params={"category": "Bowl Mill Assemblies"})
        r2 = api_client.get(f"{API}/products", params={"category": "Bowl Mill Components"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert len(r1.json()) == 5, f"After rename expected 5 Assemblies, got {len(r1.json())}"
        assert len(r2.json()) == 0, f"After rename expected 0 Components, got {len(r2.json())}"
    finally:
        # rename back
        rb = api_client.patch(f"{API}/admin/categories/{cid}", json={"name": "Bowl Mill Components"}, headers=auth(token))
        assert rb.status_code == 200, rb.text
        # verify restore
        r3 = api_client.get(f"{API}/products", params={"category": "Bowl Mill Components"})
        assert len(r3.json()) == 5


# ---------- 12. Rename clash 409 ----------
def test_rename_clash_409(api_client, token):
    cats = api_client.get(f"{API}/categories").json()
    src = next((c for c in cats if c["name"] == "Pump Castings"), None)
    assert src
    r = api_client.patch(f"{API}/admin/categories/{src['id']}", json={"name": "valve castings"}, headers=auth(token))
    assert r.status_code == 409, r.text


# ---------- 13. Disable hides from public ----------
def test_disable_hides_from_public(api_client, token):
    cats = api_client.get(f"{API}/categories").json()
    target = next((c for c in cats if c["name"] == "Steel Mill Parts"), None)
    assert target
    cid = target["id"]
    try:
        r = api_client.patch(f"{API}/admin/categories/{cid}", json={"enabled": False}, headers=auth(token))
        assert r.status_code == 200, r.text
        listing = api_client.get(f"{API}/categories").json()
        assert not any(c["id"] == cid for c in listing), "Disabled category still in public listing"
    finally:
        rb = api_client.patch(f"{API}/admin/categories/{cid}", json={"enabled": True}, headers=auth(token))
        assert rb.status_code == 200
        listing = api_client.get(f"{API}/categories").json()
        assert any(c["id"] == cid for c in listing)


# ---------- 14. Delete category does not touch products ----------
def test_delete_category_preserves_products(api_client, token):
    # use an existing category that has products, then recreate it after.
    cats = api_client.get(f"{API}/categories").json()
    target = next((c for c in cats if c["name"] == "Pump Castings"), None)
    assert target
    cid = target["id"]

    before = api_client.get(f"{API}/products", params={"category": "Pump Castings"}).json()
    assert len(before) >= 1

    d = api_client.delete(f"{API}/admin/categories/{cid}", headers=auth(token))
    assert d.status_code == 200, d.text
    try:
        after = api_client.get(f"{API}/products", params={"category": "Pump Castings"}).json()
        assert len(after) == len(before), "Products lost after category delete"
        # category must be gone from public listing
        listing = api_client.get(f"{API}/categories").json()
        assert not any(c["id"] == cid for c in listing)
    finally:
        # recreate
        rc = api_client.post(f"{API}/admin/categories", json={"name": "Pump Castings"}, headers=auth(token))
        assert rc.status_code == 200, rc.text


# ---------- 15. Cleanup idempotent ----------
def test_cleanup_idempotent(api_client, token):
    r = api_client.post(f"{API}/admin/categories/cleanup", headers=auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("products_normalized", 0) == 0, body
    assert body.get("duplicates_merged", 0) == 0, body
    assert body.get("empties_removed", 0) == 0, body


# ---------- 16. RBAC ----------
def test_rbac_no_token(api_client):
    r1 = api_client.post(f"{API}/admin/categories", json={"name": "Nope"})
    assert r1.status_code in (401, 403), r1.status_code
    r2 = api_client.post(f"{API}/admin/categories/cleanup")
    assert r2.status_code in (401, 403), r2.status_code
    r3 = api_client.patch(f"{API}/admin/categories/nonexistent", json={"name": "x"})
    assert r3.status_code in (401, 403), r3.status_code
    r4 = api_client.delete(f"{API}/admin/categories/nonexistent")
    assert r4.status_code in (401, 403), r4.status_code


def test_rbac_bad_token(api_client):
    r = api_client.post(f"{API}/admin/categories", json={"name": "Nope"}, headers={"Authorization": "Bearer garbagetoken"})
    assert r.status_code in (401, 403), r.status_code


# ---------- 17. Regression: 87 products ----------
def test_regression_total_products(api_client):
    r = api_client.get(f"{API}/products")
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) == 87, f"Expected 87 total products, got {len(prods)}"


# ---------- 18. Regression: materials, videos, guest RFQ ----------
def test_regression_materials(api_client):
    r = api_client.get(f"{API}/materials")
    assert r.status_code == 200
    m = r.json()
    assert isinstance(m, list) and len(m) >= 15, f"Materials count {len(m) if isinstance(m,list) else '?'}"


def test_regression_videos(api_client):
    r = api_client.get(f"{API}/media/videos")
    assert r.status_code == 200
    v = r.json()
    assert isinstance(v, list)


def test_regression_guest_rfq(api_client):
    payload = {
        "company_name": "TEST Corp",
        "contact_person": "TEST_Guest",
        "email": "guest_test@example.com",
        "phone": "+911234567890",
        "project_details": "Guest RFQ smoke test for Valve Body qty 5",
        "items": [{"product_name": "Valve Body", "quantity": 5}],
    }
    r = api_client.post(f"{API}/rfq", json=payload)
    assert r.status_code in (200, 201), r.text
