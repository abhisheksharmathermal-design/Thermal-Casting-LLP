import os
import pytest
import requests

BASE_URL = (
    os.environ.get('EXPO_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or "https://casting-master-dna.preview.emergentagent.com"
)
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "abhisheksharma@thermalcasting.com"
ADMIN_PASSWORD = "TCL@casting1234"


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture
def customer_token(api_client):
    # Register a fresh customer (customer role is still backend-supported)
    import uuid as _uuid
    email = f"cust_{_uuid.uuid4().hex[:8]}@example.com"
    r = api_client.post(f"{API}/auth/register", json={
        "email": email, "password": "Cust@12345", "full_name": "Test Customer"
    })
    assert r.status_code == 200, f"Customer register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}
