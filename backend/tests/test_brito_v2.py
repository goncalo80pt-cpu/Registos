"""Backend tests for Centro Social de Brito v2 (3 admins by name, 5 locations, bookings)."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visitor-log-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

VALID_LOCATIONS = ["erpi_sede", "erpi_parais", "lar_residencial", "secretaria_sede", "secretaria_paraiso"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/admin-login", json={"name": "Erpi Sede", "password": "sede123"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Auth ----------
class TestAdminAuth:
    def test_admin_login_erpi_sede(self, s):
        r = s.post(f"{API}/auth/admin-login", json={"name": "Erpi Sede", "password": "sede123"})
        assert r.status_code == 200
        data = r.json()
        assert "session_token" in data and isinstance(data["session_token"], str)
        assert data["user"]["is_admin"] is True
        assert data["user"]["name"] == "Erpi Sede"

    def test_admin_login_erpi_parais(self, s):
        r = s.post(f"{API}/auth/admin-login", json={"name": "Erpi Parais", "password": "paraiso123"})
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True

    def test_admin_login_lar_residencial(self, s):
        r = s.post(f"{API}/auth/admin-login", json={"name": "Lar Residencial", "password": "larresidencial123"})
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True

    def test_admin_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/admin-login", json={"name": "Erpi Sede", "password": "wrong"})
        assert r.status_code == 401

    def test_admin_login_unknown_name(self, s):
        r = s.post(f"{API}/auth/admin-login", json={"name": "Ghost", "password": "x"})
        assert r.status_code == 401

    def test_auth_me_with_token(self, s, auth_headers):
        r = s.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["is_admin"] is True


# ---------- Locations ----------
class TestLocations:
    def test_locations_returns_5(self, s):
        r = s.get(f"{API}/locations")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        keys = [d["key"] for d in data]
        for k in VALID_LOCATIONS:
            assert k in keys
        # No legacy keys
        assert "creche" not in keys
        assert "lar" not in keys


# ---------- Visits ----------
class TestVisits:
    def test_checkin_valid_location(self, s):
        r = s.post(f"{API}/visits/checkin", json={
            "instituicao": "erpi_sede",
            "visitante_nome": "TEST_Visitante",
            "pessoa_visitada": "TEST_Idoso",
            "motivo": "TEST visita",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["instituicao"] == "erpi_sede"
        assert data["saida"] is None
        assert "visit_id" in data
        TestVisits.created_id = data["visit_id"]

    def test_checkin_legacy_creche_rejected(self, s):
        r = s.post(f"{API}/visits/checkin", json={
            "instituicao": "creche",
            "visitante_nome": "x", "pessoa_visitada": "y", "motivo": "z",
        })
        assert r.status_code == 400

    def test_checkin_invalid_location(self, s):
        r = s.post(f"{API}/visits/checkin", json={
            "instituicao": "invalid_xyz",
            "visitante_nome": "x", "pessoa_visitada": "y", "motivo": "z",
        })
        assert r.status_code == 400

    def test_active_visits_contains_new_location(self, s):
        r = s.get(f"{API}/visits/active")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # at least one with our new instituicao should exist
        assert any(v["instituicao"] in VALID_LOCATIONS for v in data)

    def test_checkout_visit(self, s):
        vid = getattr(TestVisits, "created_id", None)
        assert vid
        r = s.post(f"{API}/visits/{vid}/checkout")
        assert r.status_code == 200
        assert r.json()["saida"] is not None

    def test_stats_por_local_5_keys(self, s, auth_headers):
        r = s.get(f"{API}/visits/stats", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "por_local" in data
        assert set(data["por_local"].keys()) == set(VALID_LOCATIONS)
        for k, v in data["por_local"].items():
            assert "label" in v and "dentro" in v


# ---------- Bookings ----------
class TestBookings:
    @classmethod
    def _future_iso(cls, days=2):
        return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

    def test_create_booking_success(self, s):
        r = s.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_BookingUser",
            "telefone": "912345678",
            "pessoa_visitada": "TEST_Idoso",
            "local": "erpi_sede",
            "data_hora": self._future_iso(2),
            "observacoes": "test",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "marcada"
        assert data["local"] == "erpi_sede"
        assert "booking_id" in data
        TestBookings.created_id = data["booking_id"]

    def test_create_booking_past_date(self, s):
        past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        r = s.post(f"{API}/bookings", json={
            "visitante_nome": "X", "pessoa_visitada": "Y",
            "local": "erpi_sede", "data_hora": past,
        })
        assert r.status_code == 400

    def test_create_booking_invalid_local(self, s):
        r = s.post(f"{API}/bookings", json={
            "visitante_nome": "X", "pessoa_visitada": "Y",
            "local": "creche", "data_hora": self._future_iso(2),
        })
        assert r.status_code == 400

    def test_list_bookings_admin(self, s, auth_headers):
        r = s.get(f"{API}/bookings", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert any(b["booking_id"] == TestBookings.created_id for b in r.json())

    def test_list_bookings_no_auth(self):
        # use a fresh session with no cookies/headers
        r = requests.get(f"{API}/bookings")
        assert r.status_code in (401, 403)

    def test_list_bookings_filter_marcada(self, s, auth_headers):
        r = s.get(f"{API}/bookings", headers=auth_headers, params={"status": "marcada"})
        assert r.status_code == 200
        for b in r.json():
            assert b["status"] == "marcada"

    def test_conclude_booking(self, s, auth_headers):
        # create a fresh one
        r = s.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_Conclude", "pessoa_visitada": "Y",
            "local": "lar_residencial", "data_hora": self._future_iso(1),
        })
        bid = r.json()["booking_id"]
        r2 = s.post(f"{API}/bookings/{bid}/conclude", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "concluida"

    def test_cancel_booking(self, s, auth_headers):
        # use the originally-created booking
        bid = TestBookings.created_id
        r = s.post(f"{API}/bookings/{bid}/cancel", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "cancelada"

    def test_delete_booking(self, s, auth_headers):
        r = s.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_Delete", "pessoa_visitada": "Y",
            "local": "secretaria_sede", "data_hora": self._future_iso(1),
        })
        bid = r.json()["booking_id"]
        r2 = s.delete(f"{API}/bookings/{bid}", headers=auth_headers)
        assert r2.status_code == 200
        # verify gone
        r3 = s.delete(f"{API}/bookings/{bid}", headers=auth_headers)
        assert r3.status_code == 404
