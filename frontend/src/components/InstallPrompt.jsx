import React, { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

/**
 * InstallPrompt — friendly banner suggesting users add the site to their home screen.
 * - Chrome/Android: uses the native beforeinstallprompt event.
 * - iOS Safari: shows manual instructions (Share -> Add to Home Screen).
 * - Hides itself if already installed (display-mode: standalone) or user dismissed.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return;
    if (localStorage.getItem("install_dismissed")) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      // Show iOS instructions after 3s on first visit
      const t = setTimeout(() => setIosShow(true), 3000);
      return () => clearTimeout(t);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    setIosShow(false);
    localStorage.setItem("install_dismissed", "1");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!show && !iosShow) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 card-crisp p-4 shadow-2xl border-2 border-[#4A7C59]/20 fade-in-up" data-testid="install-prompt">
      <button onClick={dismiss} className="absolute top-2 right-2 text-[#5C6B62] hover:text-[#1F2924]" data-testid="install-dismiss" aria-label="Fechar">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#4A7C59] flex items-center justify-center text-white shrink-0">
          <Download className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-medium text-[#1F2924] mb-1">Instalar como app</div>
          {show ? (
            <>
              <p className="text-sm text-[#5C6B62] mb-3">Acesso rápido a partir do ecrã principal, igual a uma app.</p>
              <button onClick={install} className="btn-primary px-4 py-2 text-sm" data-testid="install-go">Instalar</button>
            </>
          ) : (
            <p className="text-sm text-[#5C6B62] leading-relaxed">
              No iPhone/iPad: toque em <Share className="inline w-3.5 h-3.5 mx-0.5" /> em baixo,
              depois em <Plus className="inline w-3.5 h-3.5 mx-0.5" /> <strong>Adicionar ao Ecrã Principal</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
