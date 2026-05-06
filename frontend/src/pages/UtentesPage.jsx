import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Trash2, Pencil, Building2, Check, X, Users, Printer } from "lucide-react";
import { toast } from "sonner";

export default function UtentesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filterLocal, setFilterLocal] = useState("");
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newLocal, setNewLocal] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editLocal, setEditLocal] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null); // { id, nome } or null
  const [deleting, setDeleting] = useState(false);

  const locMap = locations.reduce((m, l) => ({ ...m, [l.key]: l.label }), {});
  // Filter locations to user's scope (super-admin sees all)
  const userScopes = user?.scopes;
  const visibleLocations = (userScopes && userScopes !== "all" && Array.isArray(userScopes))
    ? locations.filter(l => userScopes.includes(l.key))
    : locations;

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const params = {};
      if (filterLocal) params.local = filterLocal;
      if (search) params.nome = search;
      const [rs, ls] = await Promise.all([
        api.get("/utentes", { params }),
        api.get("/locations"),
      ]);
      setList(rs.data);
      setLocations(ls.data);
    } catch {
      toast.error("Erro a carregar utentes");
    } finally {
      setFetching(false);
    }
  }, [filterLocal, search]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { navigate("/login?next=/utentes", { replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  const addUtente = async (e) => {
    e.preventDefault();
    if (!newNome.trim() || !newLocal) { toast.error("Preencha nome e local"); return; }
    try {
      await api.post("/utentes", { nome: newNome, local: newLocal });
      toast.success("Utente adicionado");
      setNewNome(""); setNewLocal(""); setShowAdd(false);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erro"); }
  };

  const startEdit = (u) => {
    setEditingId(u.utente_id);
    setEditNome(u.nome);
    setEditLocal(u.local);
  };

  const saveEdit = async () => {
    try {
      await api.put(`/utentes/${editingId}`, { nome: editNome, local: editLocal });
      toast.success("Atualizado");
      setEditingId(null);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erro"); }
  };

  const removeUtente = (id, nome) => setConfirmDelete({ id, nome });

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/utentes/${confirmDelete.id}`);
      toast.success(`"${confirmDelete.nome}" removido`);
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setDeleting(false);
    }
  };

  // Group by local
  const grouped = list.reduce((acc, u) => {
    (acc[u.local] = acc[u.local] || []).push(u);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" data-testid="utentes-page">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 md:py-14 fade-in-up">
        <div className="hidden print:block mb-6 text-center" data-testid="print-header">
          <div className="text-xs uppercase tracking-widest text-gray-600">Centro Social de Brito</div>
          <div className="font-heading text-2xl font-light mt-1">Lista de utentes</div>
          <div className="text-xs text-gray-700 mt-1">Impresso em {new Date().toLocaleDateString("pt-PT")} · {list.length} utente(s)</div>
        </div>

        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap print:hidden">
          <div>
            <div className="label-up mb-3">Administração</div>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-light text-[#1F2924]">Lista de utentes</h1>
            <p className="text-[#5C6B62] mt-2">{list.length} utentes na lista</p>
          </div>
          <div className="flex items-center gap-3 self-start flex-wrap">
            <button onClick={() => window.print()} className="btn-ghost px-4 py-3 flex items-center gap-2 text-sm" data-testid="print-utentes-btn">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={() => setShowAdd(s => !s)} className="btn-primary px-5 py-3 flex items-center gap-2" data-testid="add-utente-btn">
              <Plus className="w-4 h-4" /> Adicionar utente
            </button>
          </div>
        </div>

        {showAdd && (
          <form onSubmit={addUtente} className="card-crisp p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end print:hidden" data-testid="add-utente-form">
            <div className="md:col-span-2">
              <label className="label-up mb-2 block">Nome do utente</label>
              <input className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={newNome} onChange={e=>setNewNome(e.target.value)} placeholder="Nome completo" data-testid="new-utente-nome" />
            </div>
            <div>
              <label className="label-up mb-2 block">Local</label>
              <select className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={newLocal} onChange={e=>setNewLocal(e.target.value)} data-testid="new-utente-local">
                <option value="">Escolher...</option>
                {visibleLocations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="btn-primary px-5 py-3 text-sm flex items-center gap-2" data-testid="save-utente"><Check className="w-4 h-4" /> Guardar</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost px-5 py-3 text-sm">Cancelar</button>
            </div>
          </form>
        )}

        <div className="card-crisp p-5 mb-6 flex flex-col md:flex-row gap-4 print:hidden">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62]" />
            <input className="input-kiosk pl-11 !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar por nome..." data-testid="search-utentes" />
          </div>
          <select className="input-kiosk !h-12 !text-base md:w-64" style={{height:'3rem',fontSize:'1rem'}} value={filterLocal} onChange={e=>setFilterLocal(e.target.value)} data-testid="filter-local">
            <option value="">Todos os locais</option>
            {visibleLocations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>

        {fetching ? (
          <div className="card-crisp p-16 text-center text-[#5C6B62]">A carregar...</div>
        ) : list.length === 0 ? (
          <div className="card-crisp p-16 text-center" data-testid="utentes-empty">
            <Users className="w-12 h-12 mx-auto text-[#5C6B62] mb-4" />
            <p className="text-[#1F2924] font-heading text-xl">Sem utentes para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([localKey, utentes]) => (
              <section key={localKey} data-testid={`group-${localKey}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center text-[#4A7C59]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="label-up">Local</div>
                    <div className="font-heading text-2xl text-[#1F2924]">{locMap[localKey] || localKey}</div>
                  </div>
                  <div className="ml-auto text-sm text-[#5C6B62]">{utentes.length} utentes</div>
                </div>
                <div className="card-crisp overflow-hidden">
                  <div className="divide-y divide-[#E5E7E2]">
                    {utentes.map((u) => (
                      <div key={u.utente_id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#F9F8F6]" data-testid={`utente-${u.utente_id}`}>
                        {editingId === u.utente_id ? (
                          <>
                            <input className="input-kiosk flex-1 !h-10" style={{height:'2.5rem',fontSize:'0.9rem'}} value={editNome} onChange={e=>setEditNome(e.target.value)} data-testid="edit-nome" />
                            <select className="input-kiosk !h-10 w-48" style={{height:'2.5rem',fontSize:'0.9rem'}} value={editLocal} onChange={e=>setEditLocal(e.target.value)} data-testid="edit-local">
                              {locations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                            </select>
                            <button onClick={saveEdit} className="btn-primary px-3 py-2 text-xs flex items-center gap-1" data-testid={`save-${u.utente_id}`}><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingId(null)} className="btn-ghost px-3 py-2 text-xs"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="text-[#1F2924] font-medium truncate">{u.nome}</div>
                            </div>
                            <button onClick={() => startEdit(u)} className="btn-ghost p-2 text-[#5C6B62] hover:text-[#1F2924] print:hidden" data-testid={`edit-${u.utente_id}`} title="Editar"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => removeUtente(u.utente_id, u.nome)} className="btn-ghost p-2 text-[#C26D5C] print:hidden" data-testid={`remove-${u.utente_id}`} title="Remover"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2924]/60 backdrop-blur-sm print:hidden"
          onClick={() => !deleting && setConfirmDelete(null)}
          data-testid="confirm-delete-overlay"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#FAEFEB] flex items-center justify-center text-[#C26D5C] mb-5">
              <Trash2 className="w-7 h-7" />
            </div>
            <h2 className="font-heading text-2xl text-[#1F2924] mb-2">Eliminar utente?</h2>
            <p className="text-[#5C6B62] leading-relaxed">
              Tem a certeza que quer eliminar <strong className="text-[#1F2924]">"{confirmDelete.nome}"</strong> da lista de utentes? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 mt-6 flex-col-reverse sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="btn-ghost px-5 py-3 text-sm"
                data-testid="confirm-delete-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={performDelete}
                disabled={deleting}
                className="px-5 py-3 text-sm font-medium text-white rounded-md flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: "#C26D5C" }}
                data-testid="confirm-delete-confirm"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "A eliminar..." : "Sim, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
