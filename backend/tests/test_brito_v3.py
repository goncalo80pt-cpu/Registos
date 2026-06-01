"""Comprehensive backend tests for Centro Social de Brito v3.

Covers:
- Admin login for all 4 credentials (incl. super-admin "Admin")
- /api/locations (5 entries, accent on Erpi Paraíso)
- Booking validation (telefone required)
- /api/bookings/availability lunch break exclusion (12:00-13:30)
- /api/visits/stats new fields: saidas_em_atraso + top_utentes_mes
- RBAC scope filtering for utentes/bookings/saidas
"""
import os
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visitor-log-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("Admin", "admin2026"),
    "sede": ("Erpi Sede", "sede123"),
    "paraiso": ("Erpi Paraíso", "paraiso123"),
    "lar": ("Lar Residencial", "residencial123"),
}


def _login(name, password):
    r = requests.post(f"{API}/auth/admin-login", json={"name": name, "password": password}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json()["session_token"]


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    out = {}
    for k, (n, p) in CREDS.items():
        t = _login(n, p)
        if not t:
            pytest.skip(f"Login failed for {n}")
        out[k] = t
    return out


# -------- Auth --------
class TestAuth:
    def test_login_admin_super(self):
        assert _login("Admin", "admin2026") is not None

    def test_login_sede(self):
        assert _login("Erpi Sede", "sede123") is not None

    def test_login_paraiso_with_accent(self):
        assert _login("Erpi Paraíso", "paraiso123") is not None

    def test_login_paraiso_no_accent(self):
        # Case-insensitive but accent-sensitive?
        t = _login("erpi paraíso", "paraiso123")
        assert t is not None, "Lowercase with accent should still work"

    def test_login_lar(self):
        assert _login("Lar Residencial", "residencial123") is not None

    def test_login_with_whitespace(self):
        assert _login("  Erpi Sede  ", "sede123") is not None

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/admin-login", json={"name": "Admin", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_headers(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["is_admin"] is True
        assert r.json()["scopes"] == "all"

    def test_me_scope_sede(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_headers(tokens["sede"]))
        assert r.status_code == 200
        scopes = r.json()["scopes"]
        assert "erpi_sede" in scopes and "secretaria_sede" in scopes


# -------- Locations --------
class TestLocations:
    def test_locations_count(self):
        r = requests.get(f"{API}/locations")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5
        keys = {x["key"] for x in data}
        assert keys == {"erpi_sede", "erpi_parais", "lar_residencial", "secretaria_sede", "secretaria_paraiso"}

    def test_paraiso_label_has_accent(self):
        r = requests.get(f"{API}/locations").json()
        p = next(x for x in r if x["key"] == "erpi_parais")
        assert p["label"] == "Erpi Paraíso"


# -------- Bookings: telefone required + lunch break --------
def _next_valid_slot():
    """Find next future valid slot (Tue/Wed/Thu 10:00 to safely skip Mon/Fri afternoon-only and lunch break)."""
    now = datetime.now(timezone.utc)
    d = now + timedelta(days=2)
    # Move to a Wednesday for safety
    while d.weekday() != 2:
        d += timedelta(days=1)
    return d.replace(hour=10, minute=30, second=0, microsecond=0)


class TestBookings:
    def test_telefone_required(self):
        slot = _next_valid_slot()
        r = requests.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_NoPhone",
            "telefone": "",
            "pessoa_visitada": "TestUtente",
            "local": "erpi_sede",
            "data_hora": slot.isoformat(),
        })
        assert r.status_code == 400
        assert "telefone" in r.json()["detail"].lower()

    def test_telefone_whitespace_only_rejected(self):
        slot = _next_valid_slot()
        r = requests.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_WSPhone",
            "telefone": "   ",
            "pessoa_visitada": "TestUtente",
            "local": "erpi_sede",
            "data_hora": slot.isoformat(),
        })
        assert r.status_code == 400

    def test_telefone_missing_field_rejected(self):
        slot = _next_valid_slot()
        r = requests.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_MissingPhone",
            "pessoa_visitada": "TestUtente",
            "local": "erpi_sede",
            "data_hora": slot.isoformat(),
        })
        assert r.status_code == 400


# -------- Availability lunch break --------
class TestAvailability:
    def test_lunch_break_excluded_tuesday(self):
        # find a future Tuesday
        d = datetime.now(timezone.utc).date() + timedelta(days=1)
        while d.weekday() != 1:
            d += timedelta(days=1)
        r = requests.get(f"{API}/bookings/availability", params={"date": d.isoformat(), "local": "erpi_sede"})
        assert r.status_code == 200
        hours = {s["hora"] for s in r.json()["slots"]}
        for forbidden in ["12:00", "12:30", "13:00", "13:30"]:
            assert forbidden not in hours, f"{forbidden} should be excluded (lunch break)"
        # And expected normal slots are present
        assert "10:00" in hours
        assert "11:30" in hours
        assert "14:00" in hours
        assert "16:00" in hours

    def test_monday_afternoon_only_and_no_lunch(self):
        d = datetime.now(timezone.utc).date() + timedelta(days=1)
        while d.weekday() != 0:
            d += timedelta(days=1)
        r = requests.get(f"{API}/bookings/availability", params={"date": d.isoformat(), "local": "erpi_sede"})
        assert r.status_code == 200
        hours = {s["hora"] for s in r.json()["slots"]}
        # afternoon only - no morning
        assert "10:00" not in hours
        assert "14:00" in hours
        # 14:00 is after lunch, so still no 12/13 hours either
        for forbidden in ["12:00", "12:30", "13:00", "13:30"]:
            assert forbidden not in hours

    def test_booking_in_lunch_slot_rejected(self):
        d = datetime.now(timezone.utc).date() + timedelta(days=2)
        while d.weekday() != 2:
            d += timedelta(days=1)
        slot = datetime(d.year, d.month, d.day, 12, 30, tzinfo=timezone.utc)
        r = requests.post(f"{API}/bookings", json={
            "visitante_nome": "TEST_Lunch",
            "telefone": "999999999",
            "pessoa_visitada": "X",
            "local": "erpi_sede",
            "data_hora": slot.isoformat(),
        })
        assert r.status_code == 400


# -------- Stats new fields --------
class TestStats:
    def test_stats_has_new_fields(self, tokens):
        r = requests.get(f"{API}/visits/stats", headers=_headers(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert "saidas_em_atraso" in data
        assert "top_utentes_mes" in data
        assert isinstance(data["saidas_em_atraso"], list)
        assert isinstance(data["top_utentes_mes"], list)
        assert len(data["top_utentes_mes"]) <= 10

    def test_stats_por_local_scope_sede(self, tokens):
        r = requests.get(f"{API}/visits/stats", headers=_headers(tokens["sede"]))
        assert r.status_code == 200
        por_local = r.json()["por_local"]
        # sede admin should only see his 2 locations
        assert set(por_local.keys()).issubset({"erpi_sede", "secretaria_sede"})

    def test_stats_por_local_scope_paraiso(self, tokens):
        r = requests.get(f"{API}/visits/stats", headers=_headers(tokens["paraiso"]))
        assert r.status_code == 200
        por_local = r.json()["por_local"]
        assert set(por_local.keys()).issubset({"erpi_parais", "secretaria_paraiso"})

    def test_stats_por_local_admin_sees_all(self, tokens):
        r = requests.get(f"{API}/visits/stats", headers=_headers(tokens["admin"]))
        assert r.status_code == 200
        por_local = r.json()["por_local"]
        assert set(por_local.keys()) == {"erpi_sede", "erpi_parais", "lar_residencial", "secretaria_sede", "secretaria_paraiso"}


# -------- RBAC scope --------
class TestRBAC:
    def test_utentes_sede_scope(self, tokens):
        r = requests.get(f"{API}/utentes", headers=_headers(tokens["sede"]))
        assert r.status_code == 200
        for u in r.json():
            assert u["local"] in {"erpi_sede", "secretaria_sede"}

    def test_utentes_paraiso_scope(self, tokens):
        r = requests.get(f"{API}/utentes", headers=_headers(tokens["paraiso"]))
        assert r.status_code == 200
        for u in r.json():
            assert u["local"] in {"erpi_parais", "secretaria_paraiso"}

    def test_utentes_lar_scope(self, tokens):
        r = requests.get(f"{API}/utentes", headers=_headers(tokens["lar"]))
        assert r.status_code == 200
        for u in r.json():
            assert u["local"] == "lar_residencial"

    def test_bookings_scope_sede(self, tokens):
        r = requests.get(f"{API}/bookings", headers=_headers(tokens["sede"]))
        assert r.status_code == 200
        for b in r.json():
            assert b["local"] in {"erpi_sede", "secretaria_sede"}

    def test_saidas_scope_paraiso(self, tokens):
        r = requests.get(f"{API}/saidas", headers=_headers(tokens["paraiso"]))
        assert r.status_code == 200
        for s in r.json():
            assert s["local"] in {"erpi_parais", "secretaria_paraiso"}

    def test_create_utente_outside_scope_forbidden(self, tokens):
        r = requests.post(f"{API}/utentes",
                          headers=_headers(tokens["sede"]),
                          json={"nome": "TEST_OutOfScope", "local": "lar_residencial"})
        assert r.status_code == 403


# -------- History --------
class TestHistory:
    def test_visits_history_requires_admin(self):
        r = requests.get(f"{API}/visits/history")
        assert r.status_code == 401

    def test_visits_history_admin(self, tokens):
        r = requests.get(f"{API}/visits/history", headers=_headers(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_saidas_status_todas_accepted(self, tokens):
        # HistoryPage uses ?status=todas — invalid value should NOT error; just ignored
        r = requests.get(f"{API}/saidas", headers=_headers(tokens["admin"]), params={"status": "todas"})
        assert r.status_code == 200
