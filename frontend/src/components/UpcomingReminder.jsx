import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { Bell, X, Phone, Building2, Clock } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";

/**
 * UpcomingReminder — shows a sticky banner at the top whenever the admin has bookings
 * within the next 60 minutes. Auto-refreshes every 60 seconds.
 */
export default function UpcomingReminder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [locations, setLocations] = useState({});
  const lastNotified = useRef(new Set());

  useEffect(() => {
    if (!user?.is_admin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [bs, ls] = await Promise.all([api.get("/bookings", { params: { upcoming: true } }), api.get("/locations")]);
        if (cancelled) return;
        const now = Date.now();
        const soon = bs.data.filter(b => {
          const t = new Date(b.data_hora).getTime();
          return t > now && t - now <= 60 * 60 * 1000; // within 60 minutes
        });
        setItems(soon);
        const map = {}; ls.data.forEach(l => { map[l.key] = l.label; });
        setLocations(map);
        // Browser notifications for new items not yet notified
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          soon.forEach(b => {
            if (!lastNotified.current.has(b.booking_id)) {
              lastNotified.current.add(b.booking_id);
              const t = new Date(b.data_hora);
              try {
                new Notification("Visita em breve — Centro Social de Brito", {
                  body: `${t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · ${b.visitante_nome} → ${b.pessoa_visitada}`,
                  tag: b.booking_id,
                });
              } catch {}
            }
          });
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  // Ask for notification permission once
  useEffect(() => {
    if (!user?.is_admin) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const asked = localStorage.getItem("notif_asked");
      if (!asked) {
        Notification.requestPermission().finally(() => {
          localStorage.setItem("notif_asked", "1");
        });
      }
    }
  }, [user]);

  if (!user?.is_admin) return null;
  const visible = items.filter(i => !dismissed.has(i.booking_id));
  if (visible.length === 0) return null;

  return (
    <div className="bg-[#4A7C59] text-white sticky top-0 z-40 shadow-md" data-testid="reminder-banner">
      {visible.map(b => {
        const t = new Date(b.data_hora);
        const minsLeft = Math.max(0, Math.round((t.getTime() - Date.now()) / 60000));
        return (
          <div key={b.booking_id} className="max-w-7xl mx-auto px-6 md:px-10 py-3 flex items-center gap-4 flex-wrap">
            <Bell className="w-5 h-5 shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                Visita em <span className="font-bold">{minsLeft} min</span> · {t.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-sm text-white/90 flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5">
                <span><strong>{b.visitante_nome}</strong> → {b.pessoa_visitada}</span>
                <span className="flex items-center gap-1 text-xs"><Building2 className="w-3.5 h-3.5" />{locations[b.local] || b.local}</span>
                {b.telefone && <span className="flex items-center gap-1 text-xs"><Phone className="w-3.5 h-3.5" />{b.telefone}</span>}
              </div>
            </div>
            <button onClick={() => navigate("/agenda")} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md flex items-center gap-1.5" data-testid={`reminder-go-${b.booking_id}`}>
              <Clock className="w-3.5 h-3.5" /> Ver agenda
            </button>
            <button onClick={() => setDismissed(new Set([...dismissed, b.booking_id]))} className="text-white/80 hover:text-white p-1" data-testid={`reminder-dismiss-${b.booking_id}`} title="Dispensar">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
