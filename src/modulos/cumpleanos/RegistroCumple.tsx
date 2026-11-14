import { useState, type FormEvent } from 'react';
import { explicarError } from '../../lib/errores';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { guardarDoc } from '../../lib/datos';
import { nuevoId, type Enlace } from '../../lib/enlaces';
import { guardarFoto } from '../../lib/fotos';
import { hoyISO } from '../../lib/fechas';
import { RUTA_CUMPLES, partirFecha, textoFecha, type Cumple } from './datos';
import { limpiarTelefono } from '../lectura/suscriptores';

interface Persona {
  clave: string;
  nombre: string;
  fecha: string;
  ocultarAnio: boolean;
  archivo?: File;
  vista?: string;
}

const vacia = (): Persona => ({ clave: nuevoId(8), nombre: '', fecha: '', ocultarAnio: false });

function CampoPersona({ p, titulo, cambiar, quitar }: { p: Persona; titulo: string; cambiar: (c: Partial<Persona>) => void; quitar?: () => void }) {
  return (
    <fieldset className="persona">
      <legend>
        {titulo}
        {quitar && (
          <button type="button" className="icono-boton peligro" onClick={quitar} title="Quitar">
            <Trash2 size={16} />
          </button>
        )}
      </legend>
      <div className="persona-cuerpo">
        <label className="foto-circulo" title="Foto">
          {p.vista ? <img src={p.vista} alt="" /> : <ImagePlus size={26} />}
          <span>{p.vista ? 'Cambiar' : 'Foto'}</span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) cambiar({ archivo: f, vista: URL.createObjectURL(f) });
            }}
          />
        </label>
        <div className="formulario crece">
          <label>
            Nombre completo
            <input value={p.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} required maxLength={80} />
          </label>
          <label>
            Fecha de nacimiento
            <input type="date" value={p.fecha} max={hoyISO()} onChange={(e) => cambiar({ fecha: e.target.value })} required />
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={p.ocultarAnio} onChange={(e) => cambiar({ ocultarAnio: e.target.checked })} />
            <span>No guardar el año (solo día y mes)</span>
          </label>
        </div>
      </div>
    </fieldset>
  );
}

/** Formulario público de cumpleaños (se abre con el link que comparte un diácono). */
export function RegistroCumple({ enlace }: { enlace: Enlace }) {
  const [titular, setTitular] = useState<Persona>(vacia());
  const [hijos, setHijos] = useState<Persona[]>([]);
  const [telefono, setTelefono] = useState('');
  const [autoriza, setAutoriza] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const personas = [{ ...titular, parentesco: 'titular' as const }, ...hijos.map((h) => ({ ...h, parentesco: 'hijo' as const }))];
    for (const p of personas) {
      if (!p.nombre.trim() || !partirFecha(p.fecha)) return setError('Completa el nombre y la fecha de cada persona.');
    }
    setEnviando(true);
    const grupo = nuevoId(12);
    try {
      for (const p of personas) {
        const f = partirFecha(p.fecha)!;
        const foto = p.archivo && autoriza ? await guardarFoto(p.archivo, 'jeivi/cumpleanos', { publicoToken: enlace.id }) : '';
        const doc: Omit<Cumple, 'id'> = {
          nombre: p.nombre.trim(),
          dia: f.dia,
          mes: f.mes,
          anio: p.ocultarAnio ? null : f.anio,
          foto,
          telefono: limpiarTelefono(telefono),
          familia: titular.nombre.trim(),
          grupo,
          parentesco: p.parentesco,
          origen: 'link',
          enlace: enlace.id,
          autorizaFoto: autoriza,
          creado: new Date().toISOString(),
        };
        await guardarDoc(`${RUTA_CUMPLES}/${nuevoId(16)}`, doc, false);
      }
      setListo(personas.map((p) => `${p.nombre.trim()} — ${textoFecha(partirFecha(p.fecha)!)}`));
    } catch (err) {
      setError(explicarError(err) || 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo.length) {
    return (
      <section className="tarjeta centrado">
        <h1>¡Gracias! 🎉</h1>
        <p className="suave">Registramos estos cumpleaños:</p>
        <ul className="lista-check">
          {listo.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="suave">La iglesia los tendrá presentes en su día.</p>
      </section>
    );
  }

  return (
    <form className="pila" onSubmit={enviar}>
      <section className="tarjeta">
        <h1>🎂 Registra tu cumpleaños</h1>
        <p className="suave">
          Queremos celebrar contigo. Registra tu fecha y la de tus hijos; puedes agregar una foto para el anuncio de cumpleaños.
        </p>
      </section>
      <section className="tarjeta pila">
        <CampoPersona p={titular} titulo="Tus datos" cambiar={(c) => setTitular((t) => ({ ...t, ...c }))} />
        <label>
          WhatsApp (opcional, para felicitarte)
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="6000-0000" inputMode="tel" maxLength={20} />
        </label>
      </section>
      {hijos.map((h, i) => (
        <section key={h.clave} className="tarjeta">
          <CampoPersona
            p={h}
            titulo={`Hijo/a ${i + 1}`}
            cambiar={(c) => setHijos((l) => l.map((x) => (x.clave === h.clave ? { ...x, ...c } : x)))}
            quitar={() => setHijos((l) => l.filter((x) => x.clave !== h.clave))}
          />
        </section>
      ))}
      <button type="button" className="boton" onClick={() => setHijos((l) => [...l, vacia()])}>
        <Plus size={16} /> Agregar hijo/a
      </button>
      <section className="tarjeta pila">
        <label className="interruptor">
          <input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} />
          <span>Autorizo a la iglesia a usar estas fotos en el anuncio de cumpleaños.</span>
        </label>
        {error && <div className="error">{error}</div>}
        <button className="boton primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Enviar registro'}
        </button>
        <small className="suave">Tus datos solo los ven los pastores y diáconos de la iglesia.</small>
      </section>
    </form>
  );
}
