"""
Thermal Casting LLP — Phase 2 Enterprise CMS backend tests
Covers RBAC, Materials, Categories, Extended Products, Company CMS, News,
Customers, Staff, Enhanced RFQ, Inquiries, AI Docs, Audit Logs, CSV import/export.
"""
import io
import uuid
import time
import pytest
import requests

from conftest import API, auth


# ------------------------------------------------------------------
# Session-scoped tokens for all four roles
# ------------------------------------------------------------------
@pytest.fixture(scope="session")
def super_admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": "superadmin@thermalcasting.com", "password": "SuperAdmin@123"
    })
    assert r.status_code == 200, f"Super admin login failed: {r.text}"
    body = r.json()
    assert body["user"]["role"] == "super_admin"
    return body["access_token"]


@pytest.fixture(scope="session")
def sales_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": "sales@thermalcasting.com", "password": "Sales@123"
    })
    assert r.status_code == 200, f"Sales login failed: {r.text}"
    body = r.json()
    assert body["user"]["role"] == "sales_executive"
    return body["access_token"]


# ==================================================================
# AUTH — four roles
# ==================================================================
class TestPhase2Auth:
    def test_super_admin_login(self, super_admin_token):
        assert super_admin_token

    def test_admin_login(self, admin_token):
        assert admin_token

    def test_sales_executive_login(self, sales_token):
        assert sales_token

    def test_customer_login(self, customer_token):
        assert customer_token


# ==================================================================
# MATERIALS
# ==================================================================
class TestMaterials:
    def test_list_seeded_materials(self, api_client):
        r = api_client.get(f"{API}/materials")
        assert r.status_code == 200
        mats = r.json()
        assert isinstance(mats, list)
        assert len(mats) >= 16, f"expected >=16 materials, got {len(mats)}"
        names = {m["name"].upper() for m in mats}
        # Spot-check a few required grades
        assert any("WCB" in n for n in names)
        # duplex or CF8M should exist
        assert any("CF8M" in n or "DUPLEX" in n for n in names)

    def test_get_material_with_products(self, api_client):
        mats = api_client.get(f"{API}/materials").json()
        mid = mats[0]["id"]
        d = api_client.get(f"{API}/materials/{mid}")
        assert d.status_code == 200
        body = d.json()
        assert body["id"] == mid
        assert "products" in body and isinstance(body["products"], list)

    def test_sales_cannot_create_material(self, api_client, sales_token):
        r = api_client.post(f"{API}/admin/materials",
                            json={"name": "TEST_MatSalesBlock", "grade_code": "X-BLOCK"},
                            headers=auth(sales_token))
        assert r.status_code == 403

    def test_admin_can_create_update_delete_material(self, api_client, admin_token):
        create = api_client.post(
            f"{API}/admin/materials",
            json={"name": f"TEST_Mat_{uuid.uuid4().hex[:6]}", "grade_code": "TEST-01",
                  "category": "Carbon Steel", "standards": "ASTM A216"},
            headers=auth(admin_token))
        assert create.status_code == 200, create.text
        mid = create.json()["id"]

        upd = api_client.patch(f"{API}/admin/materials/{mid}",
                               json={"description": "TEST description"},
                               headers=auth(admin_token))
        assert upd.status_code == 200
        assert upd.json()["description"] == "TEST description"

        # Verify persistence
        got = api_client.get(f"{API}/materials/{mid}").json()
        assert got["description"] == "TEST description"

        dele = api_client.delete(f"{API}/admin/materials/{mid}", headers=auth(admin_token))
        assert dele.status_code == 200

        # Confirm gone
        assert api_client.get(f"{API}/materials/{mid}").status_code == 404

    def test_delete_material_pulls_from_products(self, api_client, admin_token):
        # Create material, create product referencing it, delete material, verify pull
        m = api_client.post(f"{API}/admin/materials",
                            json={"name": f"TEST_MatPull_{uuid.uuid4().hex[:6]}"},
                            headers=auth(admin_token)).json()
        mid = m["id"]
        p = api_client.post(f"{API}/admin/products/full",
                            json={"name": f"TEST_Prod_{uuid.uuid4().hex[:6]}",
                                  "category": "Valve Castings",
                                  "material_ids": [mid]},
                            headers=auth(admin_token)).json()
        pid = p["id"]
        # delete material
        api_client.delete(f"{API}/admin/materials/{mid}", headers=auth(admin_token))
        # product should still exist but no longer reference mid
        got = api_client.get(f"{API}/products/{pid}")
        assert got.status_code == 200
        assert mid not in (got.json().get("material_ids") or [])
        # cleanup product
        api_client.delete(f"{API}/admin/products/{pid}", headers=auth(admin_token))


# ==================================================================
# CATEGORIES
# ==================================================================
class TestCategories:
    def test_list_seeded_categories(self, api_client):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 10, f"expected >=10 categories, got {len(cats)}"

    def test_sales_cannot_create_category(self, api_client, sales_token):
        r = api_client.post(f"{API}/admin/categories",
                            json={"name": "TEST_CatSales"}, headers=auth(sales_token))
        assert r.status_code == 403

    def test_admin_category_crud(self, api_client, admin_token):
        c = api_client.post(f"{API}/admin/categories",
                            json={"name": f"TEST_Cat_{uuid.uuid4().hex[:6]}",
                                  "description": "TEST cat"},
                            headers=auth(admin_token))
        assert c.status_code == 200
        cid = c.json()["id"]
        u = api_client.patch(f"{API}/admin/categories/{cid}",
                             json={"description": "updated"},
                             headers=auth(admin_token))
        assert u.status_code == 200
        assert u.json()["description"] == "updated"
        d = api_client.delete(f"{API}/admin/categories/{cid}", headers=auth(admin_token))
        assert d.status_code == 200


# ==================================================================
# EXTENDED PRODUCTS
# ==================================================================
class TestProductsExtended:
    @pytest.fixture(scope="class")
    def created_pid(self, api_client, admin_token):
        payload = {
            "name": f"TEST_ProdFull_{uuid.uuid4().hex[:6]}",
            "sku": f"TEST-SKU-{uuid.uuid4().hex[:6]}",
            "category": "Valve Castings",
            "subcategory": "Gate Valve",
            "grade": "WCB",
            "industry": "Oil & Gas",
            "standards": "ASTM A216",
            "weight": "25 kg",
            "size": "150mm",
            "pressure_class": "Class 300",
            "temperature_rating": "400°C",
            "casting_process": "Sand Casting",
            "machining_details": "CNC 3-axis",
            "inspection_details": "MPI + DPT",
            "heat_treatment": "Normalized",
            "manufacturing_capacity": "500 units/month",
            "seo_title": "TEST SEO",
            "seo_description": "TEST SEO desc",
            "seo_keywords": "test, seo",
            "featured": False,
            "enabled": True,
            "archived": False,
        }
        r = api_client.post(f"{API}/admin/products/full", json=payload, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        pid = body["id"]
        assert body["pressure_class"] == "Class 300"
        assert body["temperature_rating"] == "400°C"
        assert body["seo_title"] == "TEST SEO"
        yield pid
        api_client.delete(f"{API}/admin/products/{pid}", headers=auth(admin_token))

    def test_patch_product(self, api_client, admin_token, created_pid):
        r = api_client.patch(f"{API}/admin/products/{created_pid}",
                             json={"description": "TEST updated description"},
                             headers=auth(admin_token))
        assert r.status_code == 200
        # verify via public GET
        g = api_client.get(f"{API}/products/{created_pid}")
        assert g.json()["description"] == "TEST updated description"

    def test_duplicate_product(self, api_client, admin_token, created_pid):
        r = api_client.post(f"{API}/admin/products/{created_pid}/duplicate",
                            headers=auth(admin_token))
        assert r.status_code == 200
        dup = r.json()
        assert dup["id"] != created_pid
        assert dup["ref_no"].startswith("TC-")
        assert dup["name"].endswith("(Copy)")
        # cleanup
        api_client.delete(f"{API}/admin/products/{dup['id']}", headers=auth(admin_token))

    def test_toggle_featured(self, api_client, admin_token, created_pid):
        r1 = api_client.post(f"{API}/admin/products/{created_pid}/toggle",
                             params={"field": "featured"}, headers=auth(admin_token))
        assert r1.status_code == 200
        v1 = r1.json()["value"]
        r2 = api_client.post(f"{API}/admin/products/{created_pid}/toggle",
                             params={"field": "featured"}, headers=auth(admin_token))
        assert r2.json()["value"] != v1

    def test_toggle_enabled_and_archived(self, api_client, admin_token, created_pid):
        for f in ("enabled", "archived"):
            r = api_client.post(f"{API}/admin/products/{created_pid}/toggle",
                                params={"field": f}, headers=auth(admin_token))
            assert r.status_code == 200
            assert r.json()["field"] == f

    def test_toggle_invalid_field(self, api_client, admin_token, created_pid):
        r = api_client.post(f"{API}/admin/products/{created_pid}/toggle",
                            params={"field": "invalid"}, headers=auth(admin_token))
        assert r.status_code == 400

    def test_sales_cannot_create_product(self, api_client, sales_token):
        r = api_client.post(f"{API}/admin/products/full",
                            json={"name": "TEST_ProdSales", "category": "X"},
                            headers=auth(sales_token))
        assert r.status_code == 403


# ==================================================================
# COMPANY PROFILE CMS
# ==================================================================
class TestCompanyCMS:
    def test_sales_cannot_update_company(self, api_client, sales_token):
        r = api_client.patch(f"{API}/admin/company",
                             json={"tagline": "should not apply"},
                             headers=auth(sales_token))
        assert r.status_code == 403

    def test_admin_update_company(self, api_client, admin_token):
        new_tag = f"TEST tagline {uuid.uuid4().hex[:6]}"
        r = api_client.patch(f"{API}/admin/company",
                             json={"tagline": new_tag}, headers=auth(admin_token))
        assert r.status_code == 200
        # verify public endpoint reflects change
        g = api_client.get(f"{API}/company")
        assert g.json().get("tagline") == new_tag


# ==================================================================
# NEWS
# ==================================================================
class TestNews:
    def test_news_crud_and_filter(self, api_client, admin_token):
        c = api_client.post(f"{API}/admin/news",
                            json={"title": f"TEST_News_{uuid.uuid4().hex[:6]}",
                                  "summary": "s", "type": "announcement",
                                  "published": True},
                            headers=auth(admin_token))
        assert c.status_code == 200
        nid = c.json()["id"]

        # list published
        lst = api_client.get(f"{API}/news").json()
        assert any(n["id"] == nid for n in lst)

        # filter by type
        ann = api_client.get(f"{API}/news", params={"type": "announcement"}).json()
        assert any(n["id"] == nid for n in ann)
        assert all(n["type"] == "announcement" for n in ann)

        # patch
        u = api_client.patch(f"{API}/admin/news/{nid}",
                             json={"summary": "updated"},
                             headers=auth(admin_token))
        assert u.status_code == 200
        assert u.json()["summary"] == "updated"

        d = api_client.delete(f"{API}/admin/news/{nid}", headers=auth(admin_token))
        assert d.status_code == 200

    def test_sales_cannot_create_news(self, api_client, sales_token):
        r = api_client.post(f"{API}/admin/news",
                            json={"title": "TEST_NewsSales"},
                            headers=auth(sales_token))
        assert r.status_code == 403


# ==================================================================
# ENHANCED RFQ (sales_executive SHOULD have access)
# ==================================================================
class TestEnhancedRFQ:
    def test_sales_can_update_rfq_full(self, api_client, customer_token, sales_token):
        # customer creates RFQ
        rfq = api_client.post(f"{API}/rfq", json={
            "company_name": "TEST_Co", "contact_person": "TEST",
            "email": "TEST_rfq_p2@example.com", "phone": "+91",
            "industry": "Valves", "project_details": "test",
            "items": [{"product_name": "Gate Valve", "quantity": 1}],
        }, headers=auth(customer_token)).json()
        rfq_id = rfq["id"]

        # sales updates all enhanced fields
        r = api_client.patch(f"{API}/admin/rfq/{rfq_id}", json={
            "status": "quoted",
            "priority": "high",
            "quotation_url": "https://example.com/q.pdf",
            "quotation_amount": 12345.67,
            "admin_notes": "TEST notes",
        }, headers=auth(sales_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["priority"] == "high"
        assert body["quotation_amount"] == 12345.67
        assert body["quotation_url"] == "https://example.com/q.pdf"
        assert body["status"] == "quoted"

    def test_customer_cannot_use_admin_rfq_patch(self, api_client, customer_token):
        rfq = api_client.post(f"{API}/rfq", json={
            "company_name": "TEST", "contact_person": "T", "email": "t@t.com",
            "phone": "1", "project_details": "p",
            "items": [{"product_name": "X", "quantity": 1}],
        }, headers=auth(customer_token)).json()
        r = api_client.patch(f"{API}/admin/rfq/{rfq['id']}",
                             json={"priority": "urgent"},
                             headers=auth(customer_token))
        assert r.status_code == 403


# ==================================================================
# CUSTOMERS
# ==================================================================
class TestCustomers:
    def test_list_customers_with_rfq_count(self, api_client, admin_token):
        r = api_client.get(f"{API}/admin/customers", headers=auth(admin_token))
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) >= 1
        assert all(d["role"] == "customer" for d in docs)
        assert all("rfq_count" in d for d in docs)

    def test_customer_search(self, api_client, admin_token):
        r = api_client.get(f"{API}/admin/customers", params={"q": "demo"},
                           headers=auth(admin_token))
        assert r.status_code == 200
        docs = r.json()
        # customer@example.com company="Demo Industries" should match
        assert len(docs) >= 1

    def test_customer_status_change_but_role_immutable(self, api_client, admin_token):
        # pick the demo customer
        docs = api_client.get(f"{API}/admin/customers", params={"q": "demo"},
                              headers=auth(admin_token)).json()
        assert docs, "demo customer missing"
        uid = docs[0]["id"]
        # attempt to change role + password_hash + set status=disabled
        r = api_client.patch(f"{API}/admin/customers/{uid}",
                             json={"status": "disabled", "role": "admin",
                                   "password_hash": "hack"},
                             headers=auth(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "disabled"
        assert body["role"] == "customer", "role must NOT be mutable via customer patch"
        # revert
        api_client.patch(f"{API}/admin/customers/{uid}",
                         json={"status": "active"}, headers=auth(admin_token))

    def test_sales_can_view_customers(self, api_client, sales_token):
        r = api_client.get(f"{API}/admin/customers", headers=auth(sales_token))
        assert r.status_code == 200


# ==================================================================
# STAFF (super_admin only)
# ==================================================================
class TestStaff:
    def test_admin_cannot_create_staff(self, api_client, admin_token):
        r = api_client.post(f"{API}/admin/staff", json={
            "email": f"TEST_staff_{uuid.uuid4().hex[:6]}@t.com",
            "password": "Passw0rd!", "full_name": "X",
            "role": "sales_executive",
        }, headers=auth(admin_token))
        assert r.status_code == 403

    def test_super_admin_staff_crud(self, api_client, super_admin_token):
        email = f"TEST_staff_{uuid.uuid4().hex[:8]}@example.com"
        c = api_client.post(f"{API}/admin/staff", json={
            "email": email, "password": "Passw0rd!",
            "full_name": "TEST Staff", "role": "sales_executive",
        }, headers=auth(super_admin_token))
        assert c.status_code == 200, c.text
        sid = c.json()["id"]
        assert c.json()["role"] == "sales_executive"
        assert "password_hash" not in c.json()

        # duplicate email fails
        dup = api_client.post(f"{API}/admin/staff", json={
            "email": email, "password": "Passw0rd!",
            "full_name": "X", "role": "admin",
        }, headers=auth(super_admin_token))
        assert dup.status_code == 400

        # list includes new staff
        lst = api_client.get(f"{API}/admin/staff", headers=auth(super_admin_token)).json()
        assert any(s["id"] == sid for s in lst)

        # patch password (should be hashed) + verify login works
        u = api_client.patch(f"{API}/admin/staff/{sid}",
                             json={"password": "NewPass@123", "full_name": "Renamed"},
                             headers=auth(super_admin_token))
        assert u.status_code == 200
        assert u.json()["full_name"] == "Renamed"
        assert "password_hash" not in u.json()

        # verify login with new password
        lg = api_client.post(f"{API}/auth/login", json={"email": email, "password": "NewPass@123"})
        assert lg.status_code == 200, lg.text

        # delete
        d = api_client.delete(f"{API}/admin/staff/{sid}", headers=auth(super_admin_token))
        assert d.status_code == 200

    def test_cannot_delete_self(self, api_client, super_admin_token):
        me = api_client.get(f"{API}/auth/me", headers=auth(super_admin_token)).json()
        r = api_client.delete(f"{API}/admin/staff/{me['id']}", headers=auth(super_admin_token))
        assert r.status_code == 400


# ==================================================================
# AI DOCS + Chat grounding
# ==================================================================
class TestAIDocsAndChat:
    def test_ai_doc_crud_and_chat_still_works(self, api_client, admin_token, sales_token):
        # sales cannot create
        deny = api_client.post(f"{API}/admin/ai/docs",
                               json={"title": "TEST_denied", "content": "x"},
                               headers=auth(sales_token))
        assert deny.status_code == 403

        # admin creates a doc with unique content
        marker = f"UNIQMK{uuid.uuid4().hex[:8]}"
        c = api_client.post(f"{API}/admin/ai/docs", json={
            "title": f"TEST_AIDoc_{uuid.uuid4().hex[:6]}",
            "doc_type": "spec_sheet",
            "content": f"Thermal Casting proprietary marker code {marker}. "
                       f"Company holds ISO 9001 certification.",
        }, headers=auth(admin_token))
        assert c.status_code == 200, c.text
        did = c.json()["id"]

        # list — should NOT include 'content'
        lst = api_client.get(f"{API}/admin/ai/docs", headers=auth(admin_token)).json()
        found = [d for d in lst if d["id"] == did]
        assert found and "content" not in found[0]

        # chat should still succeed after uploading
        sess = f"TEST_p2_{uuid.uuid4().hex[:6]}"
        rc = api_client.post(f"{API}/ai/chat",
                             json={"session_id": sess,
                                   "message": "What certifications does the company hold?"},
                             timeout=90)
        assert rc.status_code == 200, rc.text
        assert isinstance(rc.json().get("reply"), str)
        assert len(rc.json()["reply"]) > 20

        # delete
        d = api_client.delete(f"{API}/admin/ai/docs/{did}", headers=auth(admin_token))
        assert d.status_code == 200


# ==================================================================
# INQUIRIES
# ==================================================================
class TestInquiries:
    def test_public_inquiry_creation(self, api_client):
        r = api_client.post(f"{API}/inquiry", json={
            "name": "TEST User", "email": "TEST_inq@example.com",
            "phone": "+91", "message": "TEST message body",
            "subject": "TEST",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ref_no"].startswith("INQ-2026-")
        parts = body["ref_no"].split("-")
        assert len(parts) == 3 and len(parts[2]) == 5

    def test_admin_list_and_patch_inquiry(self, api_client, admin_token, sales_token):
        # create one
        i = api_client.post(f"{API}/inquiry", json={
            "name": "TEST", "email": "TEST_inq2@example.com",
            "message": "m",
        }).json()
        iid = i["id"]

        lst = api_client.get(f"{API}/admin/inquiries", headers=auth(admin_token))
        assert lst.status_code == 200
        assert any(x["id"] == iid for x in lst.json())

        # sales can also update inquiries (staff-shared)
        u = api_client.patch(f"{API}/admin/inquiries/{iid}",
                             json={"status": "in_progress",
                                   "admin_note": "picked up by sales"},
                             headers=auth(sales_token))
        assert u.status_code == 200
        body = u.json()
        assert body["status"] == "in_progress"
        assert isinstance(body.get("history"), list) and len(body["history"]) >= 1


# ==================================================================
# AUDIT LOGS
# ==================================================================
class TestAuditLogs:
    def test_sales_cannot_view_audit(self, api_client, sales_token):
        r = api_client.get(f"{API}/admin/audit-logs", headers=auth(sales_token))
        assert r.status_code == 403

    def test_audit_entry_appears(self, api_client, admin_token):
        # trigger an audit event
        m = api_client.post(f"{API}/admin/materials",
                            json={"name": f"TEST_Audit_{uuid.uuid4().hex[:6]}"},
                            headers=auth(admin_token)).json()
        mid = m["id"]
        time.sleep(0.5)
        logs = api_client.get(f"{API}/admin/audit-logs",
                              params={"entity": "material"},
                              headers=auth(admin_token))
        assert logs.status_code == 200
        entries = logs.json()
        assert isinstance(entries, list) and len(entries) >= 1
        for e in entries[:5]:
            for k in ("actor_email", "actor_role", "action", "entity"):
                assert k in e
        assert any(e.get("entity_id") == mid and e.get("action") == "material.create"
                   for e in entries)
        # cleanup
        api_client.delete(f"{API}/admin/materials/{mid}", headers=auth(admin_token))


# ==================================================================
# CSV IMPORT / EXPORT
# ==================================================================
class TestCSVBulk:
    def test_sales_cannot_import(self, api_client, sales_token):
        r = api_client.post(f"{API}/admin/products/import-csv",
                            json={"csv_text": "name,category\nX,Y"},
                            headers=auth(sales_token))
        assert r.status_code == 403

    def test_admin_import_csv_with_skip(self, api_client, admin_token):
        csv_text = (
            "name,category,subcategory,grade,description\n"
            f"TEST_CSV_A_{uuid.uuid4().hex[:6]},Valve Castings,Gate,WCB,imported row A\n"
            ",Valve Castings,Gate,WCB,missing name should skip\n"
            f"TEST_CSV_B_{uuid.uuid4().hex[:6]},,Gate,WCB,missing category should skip\n"
            f"TEST_CSV_C_{uuid.uuid4().hex[:6]},Pump Castings,,CF8M,imported row C\n"
        )
        r = api_client.post(f"{API}/admin/products/import-csv",
                            json={"csv_text": csv_text},
                            headers=auth(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["imported"] == 2
        assert body["skipped"] == 2

    def test_export_csv_staff(self, api_client, sales_token):
        r = api_client.get(f"{API}/admin/products/export-csv", headers=auth(sales_token))
        assert r.status_code == 200
        # CSV response
        ctype = r.headers.get("content-type", "")
        assert "csv" in ctype.lower() or "text" in ctype.lower()
        text = r.text
        assert "\n" in text and "," in text
