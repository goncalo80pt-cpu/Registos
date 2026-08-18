# Centro Social de Brito — Registo Digital de Visitas

Aplicação web instalável (PWA) para o **Centro Social de Brito**, uma Instituição Particular de Solidariedade Social. Permite às famílias marcar visitas aos residentes e à equipa gerir todo o processo — desde o registo à porta até ao acompanhamento das saídas dos utentes (consultas, passeios, visitas familiares).

Desenvolvida como projeto de estágio / trabalho académico.

![Estado](https://img.shields.io/badge/Estado-Em%20produção-brightgreen) ![Licença](https://img.shields.io/badge/Licença-Uso%20interno-blue) ![PWA](https://img.shields.io/badge/PWA-Instalável-purple)

---

## 🎯 Funcionalidades principais

### Para as famílias (público)
- 📅 **Marcar visita online** com escolha do dia, hora e local (Erpi Sede, Erpi Paraíso, Lar Residencial, Secretarias)
- 🔍 **Autocomplete** do nome do idoso à medida que escreve
- ⏰ **Slots de 30 minutos** respeitando as regras do regulamento (horários específicos por dia da semana, pausa de almoço 12h–13h30)
- 📋 **Regulamento** de visitas sempre visível na página inicial
- 📱 **PWA instalável** no telemóvel/tablet — funciona como uma app nativa

### Para a equipa (administradores)
- 🔐 **Login com RBAC** — cada admin só vê e gere o seu pólo (Erpi Sede / Erpi Paraíso / Lar Residencial). Super-admin vê todos.
- 📊 **Dashboard** com:
  - Estatísticas de visitas do dia / semana
  - **Alertas de utentes em atraso** no regresso (saídas que passaram da hora prevista)
  - **Top 10 utentes** mais visitados no mês
- 🗓️ **Agenda semanal** com todas as marcações — imprimível para a receção
- 👥 **Gestão de utentes** — adicionar, editar, remover com confirmação
- 🚪 **Saídas dos utentes** — registar consultas, passeios, visitas familiares, com acompanhante e regresso previsto
- 📚 **Histórico** com dois separadores (Visitas / Saídas) e exportação CSV
- 🖨️ **Impressão** disponível em todas as páginas administrativas
- 💾 **Login automático** opcional para tablets do serviço

---

## 🛠️ Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Tailwind CSS, Shadcn UI, Lucide Icons, Sonner (toasts), React Router |
| Backend | FastAPI (Python 3.11), Uvicorn, Motor (MongoDB driver assíncrono) |
| Base de dados | MongoDB |
| PWA | Service Worker (network-first para JS/CSS, cache-first para assets) + Manifest |
| Autenticação | JWT session tokens + RBAC baseado em `scopes` |

---

## 🗂️ Estrutura do projeto

```
/
├── backend/
│   ├── server.py           # FastAPI: endpoints, models, business logic (~1075 linhas)
│   ├── utentes_seed.py     # Script inicial dos 115 utentes
│   ├── requirements.txt
│   └── .env                # MONGO_URL, DB_NAME, JWT_SECRET
│
├── frontend/
│   ├── public/
│   │   ├── index.html      # Meta tags PWA + logo Centro Social
│   │   ├── manifest.json   # Manifesto PWA
│   │   └── service-worker.js
│   │
│   └── src/
│       ├── App.js          # Router principal
│       ├── index.css       # Tailwind + design tokens
│       ├── lib/
│       │   ├── api.js      # Cliente HTTP (Axios)
│       │   └── auth.jsx    # Contexto de autenticação (React Context)
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── InstallPrompt.jsx
│       │   └── ui/         # Shadcn UI (não editar — reinstalável)
│       └── pages/
│           ├── HomePage.jsx        # Página inicial + regulamento
│           ├── BookingPage.jsx     # Marcar visita
│           ├── CheckinPage.jsx     # Entrada (quiosque)
│           ├── CheckoutPage.jsx    # Saída (quiosque)
│           ├── LoginPage.jsx       # Login admin (com lembrar sessão)
│           ├── DashboardPage.jsx   # Estatísticas + alertas
│           ├── WeeklyAgendaPage.jsx # Agenda semanal + imprimir
│           ├── UtentesPage.jsx     # CRUD de utentes
│           ├── SaidasPage.jsx      # Saídas dos utentes
│           └── HistoryPage.jsx     # Histórico com tabs
│
└── README.md               # (este ficheiro)
```

---

## 🚀 Como correr localmente

### Pré-requisitos
- Node.js 18+ e Yarn
- Python 3.11+
- MongoDB (local ou Atlas)

### 1. Clonar o repositório
```bash
git clone https://github.com/<seu-utilizador>/<nome-do-repo>.git
cd <nome-do-repo>
```

### 2. Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate     # macOS/Linux
# venv\Scripts\activate      # Windows
pip install -r requirements.txt

# Criar ficheiro .env
cat > .env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=csbrito
JWT_SECRET=algum-segredo-forte
EOF

uvicorn server:app --reload --port 8001
```

O backend fica em `http://localhost:8001` — teste em `http://localhost:8001/api/locations`.

### 3. Frontend (React)
```bash
cd ../frontend
yarn install

# Criar ficheiro .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

yarn start
```

Abre automaticamente em `http://localhost:3000`.

### 4. Contas de administrador predefinidas

Ao arrancar, o backend cria os administradores predefinidos:

| Nome | Palavra-passe | Âmbito |
|---|---|---|
| `Admin` | `admin2026` | Super-admin (todos os locais) |
| `Erpi Sede` | `sede123` | Só Erpi Sede + Secretaria Sede |
| `Erpi Paraíso` | `paraiso123` | Só Erpi Paraíso + Secretaria Paraíso |
| `Lar Residencial` | `residencial123` | Só Lar Residencial |

> ⚠️ **Deve alterar estas passwords no `server.py`** antes de colocar em produção real.

---

## 🌐 Deployment

### Opção 1 — Emergent (recomendado, pago)
Carregue no botão **"Deploy"** dentro do Emergent. A app fica online 24h em `<nome>.emergent.host`.

### Opção 2 — Gratuita (Vercel + Render + MongoDB Atlas)
- **Frontend** → Vercel (grátis)
- **Backend** → Render Web Service (free tier, dorme após 15 min sem uso)
- **BD** → MongoDB Atlas (free 512 MB)

Configure as variáveis `MONGO_URL`, `DB_NAME`, `JWT_SECRET` no Render e `REACT_APP_BACKEND_URL` (com o URL público do Render) no Vercel.

---

## 📐 Regras de negócio implementadas

### Horários de marcação
- **Segunda e Sexta:** 14:00 – 16:30
- **Terça, Quarta, Quinta, Sábado, Domingo:** 10:00 – 11:30 e 14:00 – 16:30
- **Pausa de almoço** (excluída): 12:00 – 13:30
- **Slots de 30 minutos**, 1 marcação por slot

### RBAC (permissões por local)
Cada administrador tem um conjunto de `scopes` (locais que pode gerir):
- `Erpi Sede` → `["erpi_sede", "secretaria_sede"]`
- `Erpi Paraíso` → `["erpi_parais", "secretaria_paraiso"]`
- `Lar Residencial` → `["lar_residencial"]`
- `Admin` → `"all"` (todos os locais)

Todos os endpoints (utentes, marcações, saídas, histórico, estatísticas) filtram automaticamente pelos scopes do utilizador autenticado.

---

## 🧪 Testes

O backend tem uma suite de testes automatizados em `/backend/tests/`:

```bash
cd backend
pytest tests/ -v
```

Cobre autenticação, RBAC, criação/cancelamento de marcações, regras de horários, e validação de campos obrigatórios.

---

## 👤 Autor

Projeto desenvolvido no âmbito de estágio / trabalho académico para o **Centro Social de Brito**.

## 📄 Licença

Uso interno do Centro Social de Brito. Não é permitida a redistribuição pública sem autorização.
