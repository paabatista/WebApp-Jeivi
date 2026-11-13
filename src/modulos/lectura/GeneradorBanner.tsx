import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImagePlus, MessageCircle, Share2 } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { FONDOS, fondoPorId, type Fondo } from './fondos';
import { FORMATOS, cargarImagen, dibujarBanner, type Formato, type Plantilla, FUENTE_TEXTO, FUENTE_TITULO } from './dibujarBanner';
import type { ImagenBanco } from './useLectura';

export interface DatosBanner {
  etiqueta: string;
  titulo: string;
  lectura: string;
  nota: string;
  fecha: string;
}

interface Props {
  inicial: DatosBanner;
  pie: string;
  imagenesBanco: ImagenBanco[];
  /** Texto para el mensaje de WhatsApp. */
  textoMensaje: (d: DatosBanner) => string;
  nombreArchivo: string;
  /** Cambia los nombres de los campos (para reutilizarlo en anuncios, eventos…). */
  etiquetas?: Partial<Record<keyof DatosBanner, string>>;
  separarComas?: boolean;
}

let fuentesListas: Promise<unknown> | null = null;
export function cargarFuentes() {
  if (!fuentesListas && 'fonts' in document) {
    fuentesListas = Promise.all([
      document.fonts.load(`800 40px ${FUENTE_TEXTO}`),
      document.fonts.load(`600 40px ${FUENTE_TEXTO}`),
      document.fonts.load(`500 40px ${FUENTE_TEXTO}`),
      document.fonts.load(`italic 700 40px ${FUENTE_TITULO}`),
      document.fonts.load(`italic 400 40px ${FUENTE_TITULO}`),
    ]).catch(() => null);
  }
  return fuentesListas ?? Promise.resolve();
}

export function MiniFondo({ fondo, activo, onClick }: { fondo: Fondo; activo: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) fondo.dibujar(ctx, c.width, c.height);
  }, [fondo]);
  return (
    <button className={`mini-fondo ${activo ? 'activo' : ''}`} onClick={onClick} title={fondo.nombre}>
      <canvas ref={ref} width={108} height={135} />
      <span>{fondo.nombre}</span>
    </button>
  );
}

export function GeneradorBanner({ inicial, pie, imagenesBanco, textoMensaje, nombreArchivo, etiquetas = {}, separarComas = true }: Props) {
  const { iglesia } = useSesion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [datos, setDatos] = useState<DatosBanner>(inicial);
  const [formato, setFormato] = useState<Formato>('vertical');
  const [plantilla, setPlantilla] = useState<Plantilla>('centrado');
  const [fondoSel, setFondoSel] = useState<string>('proc:amanecer');
  const [fotoPropia, setFotoPropia] = useState<string>('');
  const [temaFoto, setTemaFoto] = useState<'claro' | 'oscuro'>('claro');
  const [oscurecer, setOscurecer] = useState(0.25);
  const [conLogo, setConLogo] = useState(true);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setDatos(inicial), [JSON.stringify(inicial)]);

  // Al elegir una foto oscurecemos más para que el texto se lea.
  useEffect(() => {
    setOscurecer(fondoSel.startsWith('proc:') ? 0.15 : 0.4);
  }, [fondoSel]);

  useEffect(() => () => {
    if (fotoPropia) URL.revokeObjectURL(fotoPropia);
  }, [fotoPropia]);

  const { w, h } = FORMATOS[formato];

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setError('');
      await cargarFuentes();
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx || cancelado) return;
      let fondo: Parameters<typeof dibujarBanner>[1]['fondo'];
      try {
        if (fondoSel.startsWith('proc:')) fondo = { tipo: 'proc', fondo: fondoPorId(fondoSel.slice(5)) };
        else {
          const url = fondoSel === 'propia' ? fotoPropia : imagenesBanco.find((i) => `banco:${i.id}` === fondoSel)?.url;
          if (!url) throw new Error('Imagen no disponible');
          fondo = { tipo: 'img', img: await cargarImagen(url), tema: temaFoto };
        }
      } catch {
        setError('No se pudo cargar la imagen. Se usa un fondo del banco.');
        fondo = { tipo: 'proc', fondo: FONDOS[0] };
      }
      let logo: HTMLImageElement | null = null;
      if (conLogo && iglesia.logoUrl) logo = await cargarImagen(iglesia.logoUrl).catch(() => null);
      if (cancelado) return;
      dibujarBanner(ctx, {
        separarComas,
        w,
        h,
        fondo,
        oscurecer,
        plantilla,
        colorAcento: iglesia.colorAcento,
        iglesia: iglesia.nombre,
        pie,
        logo,
        ...datos,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [datos, formato, plantilla, fondoSel, fotoPropia, temaFoto, oscurecer, conLogo, iglesia, pie, imagenesBanco, w, h, separarComas]);

  const mensaje = useMemo(() => textoMensaje(datos), [datos, textoMensaje]);

  function avisar(t: string) {
    setAviso(t);
    setTimeout(() => setAviso(''), 3000);
  }

  function obtenerArchivo(): Promise<File> {
    return new Promise((ok, mal) => {
      try {
        canvasRef.current!.toBlob((b) => (b ? ok(new File([b], `${nombreArchivo}.png`, { type: 'image/png' })) : mal(new Error('sin imagen'))), 'image/png');
      } catch (e) {
        // Canvas "contaminado" por una imagen sin permisos CORS.
        mal(e);
      }
    });
  }

  async function descargar() {
    try {
      const f = await obtenerArchivo();
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      avisar('Imagen descargada. Ahora adjúntala en WhatsApp.');
    } catch {
      setError('No se pudo generar la imagen con esa foto. Prueba con otra imagen del banco o súbela desde tu equipo.');
    }
  }

  async function compartir() {
    try {
      const f = await obtenerArchivo();
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], text: mensaje });
        return;
      }
      await descargar();
      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError('No se pudo compartir. Usa "Descargar" y adjunta la imagen en WhatsApp.');
    }
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(mensaje);
      avisar('Texto copiado.');
    } catch {
      setError('No se pudo copiar el texto.');
    }
  }

  function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('El archivo debe ser una imagen.');
    setFotoPropia(URL.createObjectURL(f));
    setFondoSel('propia');
    e.target.value = '';
  }

  const campo = (k: keyof DatosBanner) => ({
    value: datos[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDatos((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <div className="generador">
      <div className="generador-vista">
        <div className="lienzo" style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc((100vh - 220px) * ${w / h}))` }}>
          <canvas ref={canvasRef} width={w} height={h} />
        </div>
        <div className="acciones">
          <button className="boton whatsapp" onClick={compartir}>
            <Share2 size={18} /> Compartir en WhatsApp
          </button>
          <button className="boton" onClick={descargar}>
            <Download size={18} /> Descargar imagen
          </button>
          <a className="boton" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> Solo texto
          </a>
          <button className="boton" onClick={copiarTexto}>
            <Copy size={18} /> Copiar texto
          </button>
        </div>
        {aviso && <div className="exito">{aviso}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="generador-panel">
        <h3>Imagen de fondo</h3>
        <div className="fondos">
          {FONDOS.map((f) => (
            <MiniFondo key={f.id} fondo={f} activo={fondoSel === `proc:${f.id}`} onClick={() => setFondoSel(`proc:${f.id}`)} />
          ))}
          {imagenesBanco.map((i) => (
            <button key={i.id} className={`mini-fondo ${fondoSel === `banco:${i.id}` ? 'activo' : ''}`} onClick={() => setFondoSel(`banco:${i.id}`)} title={i.titulo}>
              <img src={i.url} alt={i.titulo} crossOrigin="anonymous" />
              <span>{i.titulo}</span>
            </button>
          ))}
          <label className={`mini-fondo subir ${fondoSel === 'propia' ? 'activo' : ''}`}>
            {fotoPropia ? <img src={fotoPropia} alt="Tu foto" /> : <ImagePlus size={28} />}
            <span>{fotoPropia ? 'Tu foto' : 'Subir mi foto'}</span>
            <input type="file" accept="image/*" onChange={subirFoto} hidden />
          </label>
        </div>
        {fondoSel === 'propia' && <p className="suave pequeno">Tu foto solo se usa en tu dispositivo; no se sube a ningún servidor.</p>}

        <div className="fila">
          <label>
            Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
              {Object.entries(FORMATOS).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Diseño
            <select value={plantilla} onChange={(e) => setPlantilla(e.target.value as Plantilla)}>
              <option value="centrado">Centrado</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="minimal">Minimalista</option>
            </select>
          </label>
        </div>
        <label>
          Oscurecer fondo ({Math.round(oscurecer * 100)}%)
          <input type="range" min={0} max={0.8} step={0.05} value={oscurecer} onChange={(e) => setOscurecer(Number(e.target.value))} />
        </label>
        {!fondoSel.startsWith('proc:') && (
          <label>
            Color del texto
            <select value={temaFoto} onChange={(e) => setTemaFoto(e.target.value as 'claro' | 'oscuro')}>
              <option value="claro">Blanco (para fotos oscuras)</option>
              <option value="oscuro">Oscuro (para fotos claras)</option>
            </select>
          </label>
        )}
        {iglesia.logoUrl && (
          <label className="interruptor">
            <input type="checkbox" checked={conLogo} onChange={(e) => setConLogo(e.target.checked)} />
            <span>Mostrar logo de la iglesia</span>
          </label>
        )}

        <h3>Textos</h3>
        <label>
          {etiquetas.etiqueta ?? 'Encabezado'}
          <input {...campo('etiqueta')} />
        </label>
        <label>
          {etiquetas.titulo ?? 'Título'}
          <input {...campo('titulo')} />
        </label>
        <label>
          {etiquetas.lectura ?? 'Lectura'}
          <textarea rows={2} {...campo('lectura')} />
        </label>
        <label>
          {etiquetas.nota ?? 'Nota o versículo (opcional)'}
          <textarea rows={2} {...campo('nota')} placeholder="Ej. Lámpara es a mis pies tu palabra — Salmo 119:105" />
        </label>
        <label>
          {etiquetas.fecha ?? 'Fecha'}
          <input {...campo('fecha')} />
        </label>
      </div>
    </div>
  );
}
