import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, MessageCircle, Share2 } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { FONDOS, fondoPorId } from '../lectura/fondos';
import { FORMATOS, cargarImagen, type Formato } from '../lectura/dibujarBanner';
import { MiniFondo, cargarFuentes } from '../lectura/GeneradorBanner';
import { useLectura } from '../lectura/useLectura';
import { numeroWhatsApp } from '../lectura/suscriptores';
import { dibujarCumple } from './dibujarCumple';
import { mensajeFelicitacion, textoFecha, type Cumple } from './datos';

export function BannerCumple({ persona }: { persona: Cumple }) {
  const { iglesia } = useSesion();
  const { config } = useLectura();
  const ref = useRef<HTMLCanvasElement>(null);
  const [formato, setFormato] = useState<Formato>('vertical');
  const [fondoSel, setFondoSel] = useState('proc:realeza');
  const [fotoFondo, setFotoFondo] = useState('');
  const [fotoPersona, setFotoPersona] = useState('');
  const [oscurecer, setOscurecer] = useState(0.2);
  const [titulo, setTitulo] = useState('¡Feliz cumpleaños!');
  const [nombre, setNombre] = useState(persona.nombre);
  const [fecha, setFecha] = useState(textoFecha(persona));
  const [mensaje, setMensaje] = useState('Que el Señor te bendiga y te guarde. Números 6:24');
  const [error, setError] = useState('');

  useEffect(() => {
    setNombre(persona.nombre);
    setFecha(textoFecha(persona));
    setFotoPersona('');
  }, [persona.id]);

  const { w, h } = FORMATOS[formato];

  useEffect(() => {
    let cancelado = false;
    (async () => {
      await cargarFuentes();
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      let fondo: Parameters<typeof dibujarCumple>[1]['fondo'] = { tipo: 'proc', fondo: fondoPorId(fondoSel.slice(5)) };
      if (!fondoSel.startsWith('proc:')) {
        const url = fondoSel === 'propia' ? fotoFondo : config.imagenes.find((i) => `banco:${i.id}` === fondoSel)?.url;
        const img = url ? await cargarImagen(url).catch(() => null) : null;
        if (img) fondo = { tipo: 'img', img };
        else setError('No se pudo cargar la imagen de fondo; se usa un fondo del banco.');
      }
      const urlFoto = fotoPersona || persona.foto;
      const foto = urlFoto ? await cargarImagen(urlFoto).catch(() => null) : null;
      if (cancelado) return;
      dibujarCumple(ctx, { w, h, fondo, oscurecer, foto, colorAcento: iglesia.colorAcento, iglesia: iglesia.nombre, titulo, nombre, fecha, mensaje, pie: config.pieBanner });
    })().catch(() => setError('No se pudo cargar una de las imágenes.'));
    return () => {
      cancelado = true;
    };
  }, [w, h, fondoSel, fotoFondo, fotoPersona, oscurecer, titulo, nombre, fecha, mensaje, persona, iglesia, config]);

  const archivo = () =>
    new Promise<File>((ok, mal) => {
      try {
        ref.current!.toBlob((b) => (b ? ok(new File([b], `cumple-${nombre.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.png`, { type: 'image/png' })) : mal(new Error())), 'image/png');
      } catch (e) {
        mal(e);
      }
    });

  async function descargar() {
    try {
      const f = await archivo();
      const u = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = u;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch {
      setError('No se pudo generar la imagen con esa foto. Prueba subiéndola desde tu equipo.');
    }
  }

  async function compartir() {
    try {
      const f = await archivo();
      if (navigator.canShare?.({ files: [f] })) return void (await navigator.share({ files: [f], text: mensajeFelicitacion(persona, iglesia.nombre) }));
      await descargar();
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError('No se pudo compartir; usa Descargar.');
    }
  }

  const subir = (set: (u: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) set(URL.createObjectURL(f));
    e.target.value = '';
  };

  return (
    <div className="generador">
      <div className="generador-vista">
        <div className="lienzo" style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc((100vh - 220px) * ${w / h}))` }}>
          <canvas ref={ref} width={w} height={h} />
        </div>
        <div className="acciones">
          <button className="boton whatsapp" onClick={compartir}>
            <Share2 size={18} /> Compartir
          </button>
          <button className="boton" onClick={descargar}>
            <Download size={18} /> Descargar
          </button>
          {persona.telefono && (
            <a className="boton" href={`https://wa.me/${numeroWhatsApp(persona.telefono)}?text=${encodeURIComponent(mensajeFelicitacion(persona, iglesia.nombre))}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} /> Felicitar por WhatsApp
            </a>
          )}
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="generador-panel">
        <h3>Foto del cumpleañero</h3>
        <label className="boton subir-archivo">
          <ImagePlus size={16} /> {persona.foto || fotoPersona ? 'Usar otra foto' : 'Subir foto'}
          <input type="file" accept="image/*" hidden onChange={subir(setFotoPersona)} />
        </label>
        <h3>Fondo</h3>
        <div className="fondos">
          {FONDOS.filter((f) => f.tema === 'claro').map((f) => (
            <MiniFondo key={f.id} fondo={f} activo={fondoSel === `proc:${f.id}`} onClick={() => setFondoSel(`proc:${f.id}`)} />
          ))}
          {config.imagenes.map((i) => (
            <button key={i.id} className={`mini-fondo ${fondoSel === `banco:${i.id}` ? 'activo' : ''}`} onClick={() => setFondoSel(`banco:${i.id}`)}>
              <img src={i.url} alt={i.titulo} crossOrigin="anonymous" />
              <span>{i.titulo}</span>
            </button>
          ))}
          <label className={`mini-fondo subir ${fondoSel === 'propia' ? 'activo' : ''}`}>
            {fotoFondo ? <img src={fotoFondo} alt="" /> : <ImagePlus size={28} />}
            <span>Otra imagen</span>
            <input type="file" accept="image/*" hidden onChange={subir((u) => (setFotoFondo(u), setFondoSel('propia')))} />
          </label>
        </div>
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
            Oscurecer ({Math.round(oscurecer * 100)}%)
            <input type="range" min={0} max={0.8} step={0.05} value={oscurecer} onChange={(e) => setOscurecer(Number(e.target.value))} />
          </label>
        </div>
        <h3>Textos</h3>
        <label>
          Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>
          Fecha
          <input value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Mensaje o versículo
          <textarea rows={2} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
