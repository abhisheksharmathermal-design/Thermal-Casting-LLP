"""
Thermal Casting LLP - Backend integration tests
Covers: health, company, auth, products, media, RFQ, AI chat, admin, WordPress adapter.
"""
import os
import uuid
import time
import pytest
import requests

from conftest import API, auth


# -------------------- Health & Company --------------------
class TestHealthAndCompany:
    def test_health(self, api_client):
        r = api_client.get(f"{API}/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "healthy"
        assert "time" in body

    def test_company_profile(self, api_client):
        r = api_client.get(f"{API}/company")
        assert r.status_code == 200
        data = r.json()
        assert data.get("name") == "Thermal Casting LLP"
        assert "certifications" in data and len(data["certifications"]) >= 3
        assert "industries" in data and "Valves" in data["industries"]
        assert "ISO 9001:2015" in " ".join(data["certifications"])


# -------------------- Auth --------------------
class TestAuth:
    def test_admin_login(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "admin@thermalcasting.com", "password": "Admin@123"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["role"] == "admin"

    def test_customer_login(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "customer@example.com", "password": "Customer@123"
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "customer"

    def test_login_invalid(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={
            "email": "admin@thermalcasting.com", "password": "wrong"
        })
        assert r.status_code == 401

    def test_register_and_me(self, api_client):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        r = api_client.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "full_name": "TEST User",
            "company": "TEST Co", "phone": "+911234567890"
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"].lower() == email.lower()
        assert body["user"]["role"] == "customer"
        token = body["access_token"]

        me = api_client.get(f"{API}/auth/me", headers=auth(token))
        assert me.status_code == 200
        assert me.json()["email"].lower() == email.lower()

        # duplicate
        dup = api_client.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "full_name": "dup"
        })
        assert dup.status_code == 400

    def test_me_no_token(self, api_client):
        r = api_client.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------------------- Products --------------------
class TestProducts:
    def test_list_products(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert isinstance(prods, list)
        assert len(prods) >= 40, f"expected >=40, got {len(prods)}"
        p = prods[0]
        for k in ("id", "ref_no", "name", "category"):
            assert k in p

    def test_categories(self, api_client):
        r = api_client.get(f"{API}/products/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) >= 10, f"expected >=10, got {len(cats)}: {cats}"
        assert "Valve Castings" in cats

    def test_filter_by_category(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "Valve Castings"})
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) > 0
        assert all(p["category"] == "Valve Castings" for p in prods)

    def test_search_products(self, api_client):
        r = api_client.get(f"{API}/products", params={"search": "valve"})
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) > 0

    def test_get_product_by_id_with_media(self, api_client):
        r = api_client.get(f"{API}/products")
        pid = r.json()[0]["id"]
        d = api_client.get(f"{API}/products/{pid}")
        assert d.status_code == 200
        body = d.json()
        assert body["id"] == pid
        assert "media" in body and isinstance(body["media"], list)

    def test_get_product_404(self, api_client):
        r = api_client.get(f"{API}/products/nonexistent-xyz")
        assert r.status_code == 404


# -------------------- Media --------------------
class TestMedia:
    def test_list_media(self, api_client):
        r = api_client.get(f"{API}/media")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 12, f"expected >=12, got {len(items)}"
        types = {i["media_type"] for i in items}
        for t in ("image", "video", "brochure", "certificate"):
            assert t in types, f"missing media_type {t}"

    def test_videos(self, api_client):
        r = api_client.get(f"{API}/media/videos")
        assert r.status_code == 200
        vids = r.json()
        assert len(vids) >= 3
        assert all(v["media_type"] == "video" for v in vids)

    def test_filter_brochures(self, api_client):
        r = api_client.get(f"{API}/media", params={"media_type": "brochure"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(i["media_type"] == "brochure" for i in items)


# -------------------- RFQ --------------------
class TestRFQ:
    def _payload(self):
        return {
            "company_name": "TEST Company",
            "contact_person": "TEST Person",
            "email": "TEST_rfq@example.com",
            "phone": "+919999999999",
            "industry": "Valves",
            "project_details": "Need quotation for gate valve bodies",
            "items": [{"product_name": "Gate Valve Body Casting", "quantity": 5}],
            "target_delivery": "2026-06-01",
        }

    def test_guest_rfq_creation(self, api_client):
        r = api_client.post(f"{API}/rfq", json=self._payload())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ref_no"].startswith("RFQ-")
        assert body["user_id"] is None
        assert body["status"] == "submitted"
        parts = body["ref_no"].split("-")
        assert len(parts) == 3 and parts[1].isdigit() and len(parts[2]) == 5

    def test_authenticated_rfq_links_user(self, api_client, customer_token):
        r = api_client.post(f"{API}/rfq", json=self._payload(), headers=auth(customer_token))
        assert r.status_code == 200
        assert r.json()["user_id"] is not None

    def test_my_rfqs(self, api_client, customer_token):
        r = api_client.get(f"{API}/rfq/my", headers=auth(customer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_all_rfqs_admin_only(self, api_client, customer_token, admin_token):
        r_cust = api_client.get(f"{API}/rfq/all", headers=auth(customer_token))
        assert r_cust.status_code == 403
        r_adm = api_client.get(f"{API}/rfq/all", headers=auth(admin_token))
        assert r_adm.status_code == 200
        assert isinstance(r_adm.json(), list)

    def test_get_rfq_permission(self, api_client, customer_token, admin_token):
        # create as customer
        r = api_client.post(f"{API}/rfq", json=self._payload(), headers=auth(customer_token))
        rfq_id = r.json()["id"]
        # customer can view own
        assert api_client.get(f"{API}/rfq/{rfq_id}", headers=auth(customer_token)).status_code == 200
        # admin can view
        assert api_client.get(f"{API}/rfq/{rfq_id}", headers=auth(admin_token)).status_code == 200
        # unauth => 401
        assert api_client.get(f"{API}/rfq/{rfq_id}").status_code == 401

        # create another user and confirm 403 on foreign RFQ
        email = f"TEST_other_{uuid.uuid4().hex[:6]}@example.com"
        reg = api_client.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "full_name": "Other"
        })
        other_token = reg.json()["access_token"]
        forb = api_client.get(f"{API}/rfq/{rfq_id}", headers=auth(other_token))
        assert forb.status_code == 403

    def test_update_rfq_admin_only(self, api_client, customer_token, admin_token):
        r = api_client.post(f"{API}/rfq", json=self._payload(), headers=auth(customer_token))
        rfq_id = r.json()["id"]
        # customer forbidden
        fc = api_client.patch(f"{API}/rfq/{rfq_id}", json={"status": "under_review"},
                              headers=auth(customer_token))
        assert fc.status_code == 403
        # admin ok
        ok = api_client.patch(f"{API}/rfq/{rfq_id}",
                              json={"status": "quoted", "admin_notes": "TEST note"},
                              headers=auth(admin_token))
        assert ok.status_code == 200
        assert ok.json()["status"] == "quoted"
        assert ok.json()["admin_notes"] == "TEST note"
        # verify persistence via GET
        g = api_client.get(f"{API}/rfq/{rfq_id}", headers=auth(admin_token))
        assert g.json()["status"] == "quoted"


# -------------------- AI Chat --------------------
class TestAIChat:
    def test_ai_chat_grounded(self, api_client):
        session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        payload = {"session_id": session_id,
                   "message": "What certifications does Thermal Casting hold?"}
        r = api_client.post(f"{API}/ai/chat", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reply" in body and isinstance(body["reply"], str) and len(body["reply"]) > 20
        assert body["session_id"] == session_id
        low = body["reply"].lower()
        # grounded on at least one company fact
        assert any(k in low for k in ["iso 9001", "ibr", "boiler regulation", "bhel"]), body["reply"]

        # history
        h = api_client.get(f"{API}/ai/history/{session_id}")
        assert h.status_code == 200
        msgs = h.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles


# -------------------- Admin & WordPress --------------------
class TestAdmin:
    def test_stats_admin_only(self, api_client, customer_token, admin_token):
        assert api_client.get(f"{API}/admin/stats", headers=auth(customer_token)).status_code == 403
        r = api_client.get(f"{API}/admin/stats", headers=auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        for k in ("products", "media", "rfqs", "customers", "rfqs_by_status"):
            assert k in data
        assert data["products"] >= 40
        assert data["media"] >= 12

    def test_wp_status(self, api_client, customer_token, admin_token):
        assert api_client.get(f"{API}/admin/wp/status", headers=auth(customer_token)).status_code == 403
        r = api_client.get(f"{API}/admin/wp/status", headers=auth(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["configured"] is False

    def test_wp_sync_graceful(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/wp/sync", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "counts" in body
        # should not crash. When WP not configured, adapter should return an 'error' or 'configured' hint.
        assert body["status"] in ("ok", "error")
