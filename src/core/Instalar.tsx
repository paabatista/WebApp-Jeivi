import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

/** Evento de Chrome/Android para mostrar el diálogo "Instalar app". */
interface PromptInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let promptGuardado: PromptInstalar | null = null;
const avisos = new Set<() => void>();

/** Se llama al arrancar (main.tsx): el evento llega antes de que se dibuje el inicio. */
export function escucharInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptGuardado = e as PromptInstalar;
    avisos.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    promptGuardado = null;
    avisos.forEach((f) => f());
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }
}

const LLAVE = 'jeivi-instalar-oculto';
const yaInstalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Tarjeta en el inicio: "Instala Jeivi en tu celular" (Android: un toque; iPhone: instrucciones). */
export function BotonInstalar() {
  const [, refrescar] = useState(0);
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(LLAVE) === '1';
    } catch {
      return false;
    }
  });
  const [verPasos, setVerPasos] = useState(false);

  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    avisos.add(f);
    return () => {
      avisos.delete(f);
    };
  }, []);

  if (oculto || yaInstalada()) return null;
  const ios = esIOS();
  if (!promptGuardado && !ios) return null;

  function ocultar() {
    setOculto(true);
    try {
      localStorage.setItem(LLAVE, '1');
    } catch {
      /* sin almacenamiento */
    }
  }

  async function instalar() {
    if (!promptGuardado) return setVerPasos(true);
    await promptGuardado.prompt();
    const { outcome } = await promptGuardado.userChoice;
    if (outcome === 'accepted') promptGuardado = null;
    refrescar((n) => n + 1);
  }

  return (
    <div className="tarjeta instalar">
      <img src="/icono-192.png" alt="" />
      <div className="instalar-texto">
        <strong>Instala Jeivi en tu celular</strong>
        <span className="suave pequeno">Ábrela desde la pantalla de inicio, como cualquier app.</span>
        {verPasos && ios && (
          <ol className="instalar-pasos">
            <li>
              Toca <Share size={15} /> <strong>Compartir</strong> (abajo en Safari).
            </li>
            <li>
              Elige <SquarePlus size={15} /> <strong>Agregar a inicio</strong>.
            </li>
            <li>
              Toca <strong>Agregar</strong>.
            </li>
          </ol>
        )}
      </div>
      {!verPasos && (
        <button className="boton primario" onClick={instalar}>
          <Download size={16} /> Instalar
        </button>
      )}
      <button className="icono-boton" title="No mostrar más" onClick={ocultar}>
        <X size={16} />
      </button>
    </div>
  );
}
