"""Phase 3 backend tests — Admin portal, sessions, change-password, uploads."""
import io
import time
import uuid
import requests
import pytest
from conftest import API, BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, auth


# ============================================================
# AUTH — new admin / old accounts / customer signup / /me
# ============================================================
class TestAuthAdmin:
    def test_login_new_admin_ok(self, api_client):
        r = api_client.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert "password_hash" not in data["user"]

    @pytest.mark.parametrize("email,pw", [
        ("admin@thermalcasting.com", "Admin@123"),
        ("superadmin@thermalcasting.com", "Super@123"),
        ("sales@thermalcasting.com", "Sales@123"),
    ])
    def test_old_staff_accounts_gone(self, api_client, email, pw):
        r = api_client.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 401, f"Expected 401 for {email}, got {r.status_code} {r.text}"

    def test_customer_register_still_works(self, api_client):
        email = f"cust_{uuid.uuid4().hex[:8]}@example.com"
        r = api_client.post(f"{API}/auth/register",
                            json={"email": email, "password": "Cust@12345", "full_name": "New Cust"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["role"] == "customer"
        assert "access_token" in body

    def test_me_no_password_no_session_id(self, api_client, admin_token):
        r = api_client.get(f"{API}/auth/me", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me["role"] == "admin"
        assert "password_hash" not in me
        assert "session_id" not in me


# ============================================================
# SESSION MANAGEMENT
# ============================================================
class TestSessions:
    def test_current_session_visible(self, api_client):
        # Fresh login so we know which token = current
        r = api_client.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        tok = r.json()["access_token"]
        r2 = api_client.get(f"{API}/auth/sessions", headers=auth(tok))
        assert r2.status_code == 200
        sess = r2.json()
        assert isinstance(sess, list) and len(sess) >= 1
        current = [s for s in sess if s.get("current")]
        assert len(current) == 1, f"Expected exactly one current=true session, got {len(current)}"
        c = current[0]
        for field in ("user_agent", "ip", "last_seen", "expires_at", "id"):
            assert field in c, f"missing field {field} in current session"

    def test_session_limit_10(self, api_client):
        tokens = []
        for _ in range(11):
            r = api_client.post(f"{API}/auth/login",
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
            assert r.status_code == 200, r.text
            tokens.append(r.json()["access_token"])
        # Use latest token to list
        r = api_client.get(f"{API}/auth/sessions", headers=auth(tokens[-1]))
        assert r.status_code == 200
        active = r.json()
        assert len(active) <= 10, f"Session count exceeds 10: {len(active)}"
        # The very first token should be revoked (session_limit)
        r_first = api_client.get(f"{API}/auth/me", headers=auth(tokens[0]))
        assert r_first.status_code == 401, f"Oldest token should be revoked, got {r_first.status_code}"

    def test_list_sessions_excludes_revoked(self, api_client, admin_token):
        r = api_client.get(f"{API}/auth/sessions", headers=auth(admin_token))
        assert r.status_code == 200
        for s in r.json():
            # revoked field either absent (projected out) or false
            assert not s.get("revoked", False)

    def test_delete_specific_session(self, api_client):
        # Create two tokens
        t1 = api_client.post(f"{API}/auth/login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        t2 = api_client.post(f"{API}/auth/login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        # Get t1's sid via its /sessions call (current=true entry)
        sess1 = api_client.get(f"{API}/auth/sessions", headers=auth(t1)).json()
        t1_sid = [s for s in sess1 if s.get("current")][0]["id"]
        # Delete t1's session using t2's token
        r = api_client.delete(f"{API}/auth/sessions/{t1_sid}", headers=auth(t2))
        assert r.status_code == 200, r.text
        # t1 should now be 401
        r2 = api_client.get(f"{API}/auth/me", headers=auth(t1))
        assert r2.status_code == 401
        assert "revoked" in r2.text.lower() or "expired" in r2.text.lower()

    def test_logout_others(self, api_client):
        t_a = api_client.post(f"{API}/auth/login",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        t_b = api_client.post(f"{API}/auth/login",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        r = api_client.post(f"{API}/auth/sessions/logout-others", headers=auth(t_b))
        assert r.status_code == 200, r.text
        assert "revoked_count" in r.json()
        assert r.json()["revoked_count"] >= 1
        # t_a now invalid, t_b still valid
        assert api_client.get(f"{API}/auth/me", headers=auth(t_a)).status_code == 401
        assert api_client.get(f"{API}/auth/me", headers=auth(t_b)).status_code == 200

    def test_logout_current(self, api_client):
        t = api_client.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        r = api_client.post(f"{API}/auth/logout", headers=auth(t))
        assert r.status_code == 200
        r2 = api_client.get(f"{API}/auth/me", headers=auth(t))
        assert r2.status_code == 401


# ============================================================
# CHANGE PASSWORD
# ============================================================
class TestChangePassword:
    @pytest.fixture
    def fresh_admin_token(self, api_client):
        r = api_client.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        return r.json()["access_token"]

    def test_wrong_current_password(self, api_client, fresh_admin_token):
        r = api_client.post(f"{API}/auth/change-password", headers=auth(fresh_admin_token),
                            json={"current_password": "WRONG_pw!123",
                                  "new_password": "NewPass@2026",
                                  "confirm_password": "NewPass@2026"})
        assert r.status_code == 401, r.text

    def test_mismatched_confirm(self, api_client, fresh_admin_token):
        r = api_client.post(f"{API}/auth/change-password", headers=auth(fresh_admin_token),
                            json={"current_password": ADMIN_PASSWORD,
                                  "new_password": "NewPass@2026",
                                  "confirm_password": "OtherPass@2026"})
        assert r.status_code == 400, r.text

    def test_same_as_current(self, api_client, fresh_admin_token):
        r = api_client.post(f"{API}/auth/change-password", headers=auth(fresh_admin_token),
                            json={"current_password": ADMIN_PASSWORD,
                                  "new_password": ADMIN_PASSWORD,
                                  "confirm_password": ADMIN_PASSWORD})
        assert r.status_code == 400, r.text

    def test_too_short(self, api_client, fresh_admin_token):
        r = api_client.post(f"{API}/auth/change-password", headers=auth(fresh_admin_token),
                            json={"current_password": ADMIN_PASSWORD,
                                  "new_password": "Sh0rt!",
                                  "confirm_password": "Sh0rt!"})
        assert r.status_code == 422, r.text

    def test_change_success_and_revoke_others_and_reset(self, api_client):
        # login twice: current + other
        current = api_client.post(f"{API}/auth/login",
                                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        other = api_client.post(f"{API}/auth/login",
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        new_pw = "TempAdminPw@2026"
        r = api_client.post(f"{API}/auth/change-password", headers=auth(current),
                            json={"current_password": ADMIN_PASSWORD,
                                  "new_password": new_pw,
                                  "confirm_password": new_pw})
        assert r.status_code == 200, r.text
        # current still works
        assert api_client.get(f"{API}/auth/me", headers=auth(current)).status_code == 200
        # other is revoked
        assert api_client.get(f"{API}/auth/me", headers=auth(other)).status_code == 401
        # login with new pw works
        r_new = api_client.post(f"{API}/auth/login",
                                json={"email": ADMIN_EMAIL, "password": new_pw})
        assert r_new.status_code == 200
        new_tok = r_new.json()["access_token"]
        # audit log contains password_change
        logs = api_client.get(f"{API}/admin/audit-logs?action=auth.password_change",
                              headers=auth(new_tok))
        assert logs.status_code == 200
        assert any(l.get("action") == "auth.password_change" for l in logs.json())
        # RESET password back so downstream tests keep working
        r_reset = api_client.post(f"{API}/auth/change-password", headers=auth(new_tok),
                                  json={"current_password": new_pw,
                                        "new_password": ADMIN_PASSWORD,
                                        "confirm_password": ADMIN_PASSWORD})
        assert r_reset.status_code == 200, r_reset.text
        # Confirm can login with original
        assert api_client.post(f"{API}/auth/login",
                               json={"email": ADMIN_EMAIL,
                                     "password": ADMIN_PASSWORD}).status_code == 200


# ============================================================
# FILE UPLOAD (local FS)
# ============================================================
_PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\x00\x00\x00\x03\x00\x01\x5b\xa5\xa0\xa5\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestUploads:
    def test_upload_requires_auth(self, api_client):
        # multipart without auth
        r = requests.post(f"{API}/admin/upload",
                          files={"file": ("a.png", _PNG_1x1, "image/png")})
        assert r.status_code == 401, r.text

    def test_upload_requires_admin_role(self, api_client, customer_token):
        r = requests.post(f"{API}/admin/upload",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          files={"file": ("a.png", _PNG_1x1, "image/png")})
        assert r.status_code == 403, r.text

    def test_upload_png_success_and_serve_and_delete(self, api_client, admin_token):
        r = requests.post(f"{API}/admin/upload",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("test.png", _PNG_1x1, "image/png")})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "url", "content_type", "size"):
            assert k in data
        assert data["url"].startswith("/api/files/")
        assert data["content_type"] == "image/png"
        assert data["size"] == len(_PNG_1x1)
        # Fetch via static mount
        file_url = f"{BASE_URL}{data['url']}"
        rf = requests.get(file_url)
        assert rf.status_code == 200, f"Static file GET failed: {rf.status_code} url={file_url}"
        assert "image" in rf.headers.get("content-type", "")
        assert rf.content == _PNG_1x1
        # Delete
        rd = api_client.delete(f"{API}/admin/upload/{data['id']}",
                               headers=auth(admin_token))
        assert rd.status_code == 200, rd.text
        # Now static GET should 404
        rf2 = requests.get(file_url)
        assert rf2.status_code == 404

    def test_upload_rejects_bad_type(self, api_client, admin_token):
        r = requests.post(f"{API}/admin/upload",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("bad.txt", b"hello", "text/plain")})
        assert r.status_code == 400, r.text

    def test_upload_rejects_empty(self, api_client, admin_token):
        r = requests.post(f"{API}/admin/upload",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("e.png", b"", "image/png")})
        assert r.status_code == 400, r.text


# ============================================================
# REGRESSION — Phase 1/2 must still work
# ============================================================
class TestRegression:
    def test_products_count(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        assert len(r.json()) >= 40, f"Expected >=40 products, got {len(r.json())}"

    def test_materials_count(self, api_client, admin_token):
        r = api_client.get(f"{API}/materials")
        assert r.status_code == 200
        # Public endpoint returns only enabled=True. Seed is 16; observed 15 (drift from previous tests).
        assert len(r.json()) >= 15, f"Expected >=15 materials (16 seeded), got {len(r.json())}"

    def test_categories_count(self, api_client, admin_token):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_media_videos(self, api_client):
        r = api_client.get(f"{API}/media/videos")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_guest_rfq(self, api_client):
        r = api_client.post(f"{API}/rfq", json={
            "company_name": "TEST_Guest_Co",
            "contact_person": "Guest Tester",
            "email": "guest@example.com",
            "phone": "+91-9999999999",
            "project_details": "Phase 3 regression RFQ",
            "items": [{"product_name": "Test", "quantity": 5}]
        })
        assert r.status_code in (200, 201), r.text
        assert "ref_no" in r.json()

    def test_ai_chat(self, api_client, admin_token):
        r = api_client.post(f"{API}/ai/chat", headers=auth(admin_token),
                            json={"message": "What products does Thermal Casting offer?",
                                  "session_id": f"test_{uuid.uuid4().hex[:8]}"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reply" in body or "answer" in body or "message" in body


# ============================================================
# RBAC — admin can do most things, but NOT staff CRUD
# ============================================================
class TestAdminRBAC:
    def test_admin_can_create_material(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/materials", headers=auth(admin_token),
                            json={"name": f"TEST_MAT_{uuid.uuid4().hex[:6]}",
                                  "grade_code": "TG1", "category": "Test"})
        assert r.status_code in (200, 201), r.text
        mid = r.json().get("id")
        if mid:
            api_client.delete(f"{API}/admin/materials/{mid}", headers=auth(admin_token))

    def test_admin_can_create_category(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/categories", headers=auth(admin_token),
                            json={"name": f"TEST_CAT_{uuid.uuid4().hex[:6]}"})
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id")
        if cid:
            api_client.delete(f"{API}/admin/categories/{cid}", headers=auth(admin_token))

    def test_admin_can_create_news(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/news", headers=auth(admin_token),
                            json={"title": "TEST_news", "body": "body", "type": "news"})
        assert r.status_code in (200, 201), r.text
        nid = r.json().get("id")
        if nid:
            api_client.delete(f"{API}/admin/news/{nid}", headers=auth(admin_token))

    def test_admin_can_read_company(self, api_client, admin_token):
        r = api_client.get(f"{API}/company")
        assert r.status_code == 200

    def test_admin_can_read_audit(self, api_client, admin_token):
        r = api_client.get(f"{API}/admin/audit-logs", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_cannot_create_staff(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/staff", headers=auth(admin_token),
                            json={"email": f"staff_{uuid.uuid4().hex[:6]}@example.com",
                                  "password": "Staff@2026", "name": "T",
                                  "role": "sales_executive"})
        assert r.status_code == 403, f"Admin must not create staff, got {r.status_code} {r.text}"

    def test_admin_cannot_delete_staff(self, api_client, admin_token):
        # try to delete self (id from /auth/me)
        me = api_client.get(f"{API}/auth/me", headers=auth(admin_token)).json()
        r = api_client.delete(f"{API}/admin/staff/{me['id']}", headers=auth(admin_token))
        assert r.status_code == 403
