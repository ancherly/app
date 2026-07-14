"""
Backend tests for Gym Fichaje API
Tests: auth, settings, admin users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"email": "admin@gimnasio.es", "password": "Admin1234!"}
EMP_CREDS = {"email": "empleado@gimnasio.es", "password": "Empleado123!"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def emp_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=EMP_CREDS)
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    return s


class TestAuth:
    """Auth endpoint tests"""

    def test_auth_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_admin_login_returns_user(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert r.status_code == 200
        data = r.json()
        # Login returns user data directly (no nested "user" key)
        assert data.get("role") == "admin" or data.get("user", {}).get("role") == "admin"
        assert data.get("email") == ADMIN_CREDS["email"] or data.get("user", {}).get("email") == ADMIN_CREDS["email"]

    def test_employee_login_returns_user(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=EMP_CREDS)
        assert r.status_code == 200
        data = r.json()
        assert data.get("role") == "employee" or data.get("user", {}).get("role") == "employee"

    def test_wrong_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@x.com", "password": "wrong"})
        assert r.status_code in [401, 400]

    def test_admin_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"


class TestSettings:
    """Settings endpoint tests"""

    def test_get_settings_public(self):
        # Settings may require auth - check with admin session
        r = requests.get(f"{BASE_URL}/api/settings")
        # May return 401 if auth required - that's valid backend behavior
        assert r.status_code in [200, 401]
        if r.status_code == 200:
            data = r.json()
            assert len(data) > 0

    def test_get_settings_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200


class TestAdminUsers:
    """Admin user management tests"""

    def test_get_users_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code in [401, 403]

    def test_get_users_as_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_users_list_contains_employee(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert EMP_CREDS["email"] in emails

    def test_get_users_as_employee_forbidden(self, emp_session):
        r = emp_session.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code in [401, 403]


class TestPunches:
    """Punch endpoints tests"""

    def test_get_punches_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/punches")
        assert r.status_code in [401, 403]

    def test_get_punches_as_employee(self, emp_session):
        from datetime import datetime
        now = datetime.now()
        r = emp_session.get(f"{BASE_URL}/api/punches?year={now.year}&month={now.month}")
        assert r.status_code == 200
