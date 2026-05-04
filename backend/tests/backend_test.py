"""Backend API tests for Registo de Visitas."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visitor-log-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/admin-login", json={"email": "admin@instituicao.pt", "password": "admin123"})
    assert r.status_code == 200, f"admin-login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["is_admin"] is True
    assert data["user"]["email"] == "admin@instituicao.pt"
    assert isinstance(data.get("session_token"), str) and len(data["session_token"]) > 10
    return data["session_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login_bad_creds(self, session):
        r = session.post(f"{API}/auth/admin-login", json={"email": "admin@instituicao.pt", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_auth_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@instituicao.pt"
        assert data["is_admin"] is True

    def test_auth_me_invalid_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid_xxx"})
        assert r.status_code == 401


# ---------------- Visits checkin/checkout/active ----------------
class TestVisits:
    def test_checkin_creche(self, session):
        payload = {
            "instituicao": "creche",
            "visitante_nome": "TEST_Joao Silva",
            "documento": "12345",
            "telefone": "911111111",
            "pessoa_visitada": "TEST_Criança A",
            "motivo": "Visita familiar",
            "observacoes": "obs",
        }
        r = session.post(f"{API}/visits/checkin", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["visit_id"].startswith("v_")
        assert d["instituicao"] == "creche"
        assert d["visitante_nome"] == "TEST_Joao Silva"
        assert d["saida"] is None
        assert d["entrada"] is not None
        pytest.visit_creche_id = d["visit_id"]

    def test_checkin_lar(self, session):
        payload = {
            "instituicao": "lar",
            "visitante_nome": "TEST_Maria Costa",
            "pessoa_visitada": "TEST_Idoso B",
            "motivo": "Visita semanal",
        }
        r = session.post(f"{API}/visits/checkin", json=payload)
        assert r.status_code == 200, r.text
        pytest.visit_lar_id = r.json()["visit_id"]

    def test_checkin_invalid_inst(self, session):
        payload = {"instituicao": "other", "visitante_nome": "x", "pessoa_visitada": "y", "motivo": "z"}
        r = session.post(f"{API}/visits/checkin", json=payload)
        assert r.status_code == 400

    def test_active_visits_contains_created(self, session):
        r = session.get(f"{API}/visits/active")
        assert r.status_code == 200
        ids = [v["visit_id"] for v in r.json()]
        assert pytest.visit_creche_id in ids
        assert pytest.visit_lar_id in ids

    def test_active_filter_creche(self, session):
        r = session.get(f"{API}/visits/active?instituicao=creche")
        assert r.status_code == 200
        for v in r.json():
            assert v["instituicao"] == "creche"

    def test_active_filter_lar(self, session):
        r = session.get(f"{API}/visits/active?instituicao=lar")
        assert r.status_code == 200
        for v in r.json():
            assert v["instituicao"] == "lar"

    def test_checkout_success(self, session):
        r = session.post(f"{API}/visits/{pytest.visit_creche_id}/checkout")
        assert r.status_code == 200, r.text
        assert r.json()["saida"] is not None

    def test_checkout_already_done(self, session):
        r = session.post(f"{API}/visits/{pytest.visit_creche_id}/checkout")
        assert r.status_code == 400

    def test_checkout_not_found(self, session):
        r = session.post(f"{API}/visits/v_nonexistent/checkout")
        assert r.status_code == 404


# ---------------- Admin-protected endpoints ----------------
class TestAdminEndpoints:
    def test_history_no_auth(self):
        r = requests.get(f"{API}/visits/history")
        assert r.status_code == 401

    def test_stats_no_auth(self):
        r = requests.get(f"{API}/visits/stats")
        assert r.status_code == 401

    def test_export_no_auth(self):
        r = requests.get(f"{API}/visits/export")
        assert r.status_code == 401

    def test_history_with_auth(self, admin_headers):
        r = requests.get(f"{API}/visits/history", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # contains our created visit
        ids = [v["visit_id"] for v in data]
        assert pytest.visit_lar_id in ids or pytest.visit_creche_id in ids

    def test_history_filter_nome(self, admin_headers):
        r = requests.get(f"{API}/visits/history?nome=TEST_Joao", headers=admin_headers)
        assert r.status_code == 200
        for v in r.json():
            assert "test_joao" in v["visitante_nome"].lower()

    def test_history_filter_instituicao(self, admin_headers):
        r = requests.get(f"{API}/visits/history?instituicao=lar", headers=admin_headers)
        assert r.status_code == 200
        for v in r.json():
            assert v["instituicao"] == "lar"

    def test_stats_with_auth(self, admin_headers):
        r = requests.get(f"{API}/visits/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total", "dentro", "hoje", "creche_dentro", "lar_dentro", "tempo_medio_min", "ultimos_7_dias"]:
            assert k in d
        assert isinstance(d["ultimos_7_dias"], list)
        assert len(d["ultimos_7_dias"]) == 7
        assert d["total"] >= 1

    def test_export_csv(self, admin_headers):
        r = requests.get(f"{API}/visits/export", headers=admin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        body = r.text
        assert ";" in body
        assert "Instituição" in body or "Instituicao" in body or "Visitante" in body

    def test_logout(self, session):
        # new login to test logout
        r = session.post(f"{API}/auth/admin-login", json={"email": "admin@instituicao.pt", "password": "admin123"})
        tok = r.json()["session_token"]
        r2 = requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 200


# Cleanup
@pytest.fixture(scope="session", autouse=True)
def cleanup(admin_headers):
    yield
    # best-effort: checkout lar visit
    try:
        requests.post(f"{API}/visits/{pytest.visit_lar_id}/checkout")
    except Exception:
        pass
