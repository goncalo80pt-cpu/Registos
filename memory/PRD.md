# PRD — Registo de Visitas (Creche & Lar de Idosos)

## Original Problem Statement
> cria um site completo para a web que um site para registos de entradas e saídas das pessoas que entram e saiam para visitar os idosos ou ir buscar as crianças e tem que dizer a hora de entrada e saída e tem que ter histórico de tudo o que acontece. e tem que ser simples para as pessoas poderem usar

## User Choices
- Instituição: Ambos (Creche/Infantário + Lar de Idosos)
- Autenticação: Login Google (Emergent) + Login admin simples
- Campos: nome, documento, telefone, pessoa visitada, motivo, observações
- Extras: Filtros por data/nome, Dashboard com estatísticas, Exportar CSV
- Idioma: Português (Portugal)

## User Personas
- **Visitante (família, amigos)** — Usa o tablet da recepção para registar entrada/saída em segundos. Não faz login.
- **Administrador (direcção/coordenação)** — Consulta dashboard, filtra histórico, exporta relatórios.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async). Rotas em `/api/*`. Sessões em `user_sessions` (7 dias). Auth via cookie httpOnly + fallback Bearer.
- **Frontend**: React 19 + React Router 7 + shadcn UI + Tailwind. Fontes Outfit + DM Sans. Paleta Organic & Earthy.
- **Auth**: Emergent Google OAuth (`/auth/session` com `X-Session-ID`) + login admin por credencial (.env).

## Implemented (2026-05-04)
- [x] Backend: checkin, checkout, active, history (filtros nome/instituição/datas), stats (7 dias + tempo médio), export CSV
- [x] Backend: auth/session (Google), auth/admin-login, auth/me, auth/logout
- [x] Frontend: HomePage, CheckinPage (kiosk split-screen com selecção Creche/Lar), CheckoutPage (lista viva), LoginPage (Google + Admin), AuthCallback, DashboardPage (Bento + bar chart 7 dias), HistoryPage (filtros + export)
- [x] 22/22 backend pytest + todos fluxos frontend validados pelo testing agent
- [x] **Rebrand** para `centro.social.de.brito.Registos` (header + title da aba)
- [x] **Histórico permanente**: `to_list(length=None)` em `/api/visits/history` e `/api/visits/export` — sem qualquer limite de registos. MongoDB não tem TTL configurado, pelo que os dados ficam guardados indefinidamente.

## Backlog
- **P1**: Substituir date inputs nativos por shadcn Calendar em `/historico`.
- **P1**: Multi-tenant (várias instituições com o mesmo deploy).
- **P2**: Notificações por SMS quando tempo de permanência excede limite (útil em creche: atraso na recolha).
- **P2**: Impressão/QR de crachá temporário do visitante.
- **P2**: Pesquisa avançada com operador "apenas pendentes" (sem saída).
- **P3**: Suprimir log 401 de `/auth/me` em páginas não autenticadas.

## Test Credentials
Ver `/app/memory/test_credentials.md`
