import { useEffect, useState } from 'react';
import { Layout } from '../../core/Layout';
import { MODULOS, moduloPorId } from '../../core/modulos';
import { IconoModulo } from '../../core/IconoModulo';
import { guardarDoc } from '../../lib/datos';
import { IGLESIA_ID } from '../../lib/firebase';
import { guardarFoto } from '../../lib/fotos';
import { useSesion, type Iglesia } from '../../lib/sesion';

const modulo = moduloPorId('configuracion')!;

export function Configuracion() {
  const { iglesia, perfil } = useSesion();
  const [f, setF] = useState<Iglesia>(iglesia);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => setF(iglesia), [iglesia]);

  const set = <K extends keyof Iglesia>(k: K, v: Iglesia[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setError('');
    try {
      await guardarDoc(`iglesias/${IGLESIA_ID}`, { ...f });
      setMsg('Configuración guardada.');
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setError('No se pudo guardar. Solo el super admin puede cambiar la configuración.');
    }
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    try {
      set('logoUrl', await guardarFoto(archivo, f, 'jeivi/marca', { autor: perfil, titulo: 'Logo de la iglesia' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  const alternarModulo = (id: string) =>
    set('modulosActivos', f.modulosActivos.includes(id) ? f.modulosActivos.filter((m) => m !== id) : [...f.modulosActivos, id]);

  return (
    <Layout modulo={modulo}>
      <div className="pila">
        <section className="tarjeta">
          <h2>Iglesia</h2>
          <div className="formulario">
            <label>
              Nombre completo
              <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </label>
            <div className="fila">
              <label>
                Nombre corto
                <input value={f.nombreCorto} onChange={(e) => set('nombreCorto', e.target.value)} />
              </label>
              <label>
                Sitio web
                <input value={f.sitioWeb || ''} onChange={(e) => set('sitioWeb', e.target.value)} />
              </label>
            </div>
            <label>
              Lema
              <input value={f.lema || ''} onChange={(e) => set('lema', e.target.value)} />
            </label>
            <div className="fila">
              <label>
                Color principal
                <input type="color" value={f.colorPrimario} onChange={(e) => set('colorPrimario', e.target.value)} />
              </label>
              <label>
                Color de acento
                <input type="color" value={f.colorAcento} onChange={(e) => set('colorAcento', e.target.value)} />
              </label>
            </div>
            <div className="fila logo-fila">
              {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="logo-previa" /> : <span className="marca-j grande">J</span>}
              <label>
                Logo (enlace de la imagen, PNG con fondo transparente ideal)
                <input value={f.logoUrl || ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" />
              </label>
              <label className="boton subir-archivo">
                {subiendo ? 'Subiendo…' : 'Subir logo'}
                <input type="file" accept="image/*" onChange={subirLogo} hidden />
              </label>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <h2>Módulos visibles</h2>
          <p className="suave">Como en Odoo: activa solo las apps que la iglesia usa.</p>
          <div className="lista-modulos">
            {MODULOS.map((m) => (
              <label key={m.id} className="modulo-opcion">
                <input
                  type="checkbox"
                  checked={m.siempreVisible || f.modulosActivos.includes(m.id)}
                  disabled={m.id === 'configuracion' || m.siempreVisible}
                  onChange={() => alternarModulo(m.id)}
                />
                <IconoModulo modulo={m} tam={40} />
                <span>
                  <strong>{m.nombre}</strong>
                  {m.estado === 'proximamente' && <span className="chip mini">pronto</span>}
                  <small className="suave">{m.descripcion}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <h2>Imágenes (Cloudinary)</h2>
          <p className="suave">
            Para subir fotos al banco de imágenes y el logo. Crea una cuenta gratis en cloudinary.com, ve a Settings → Upload →
            Upload presets, crea uno en modo <strong>Unsigned</strong> y copia aquí su nombre.
          </p>
          <div className="fila">
            <label>
              Cloud name
              <input
                value={f.cloudinary?.cloudName || ''}
                onChange={(e) => set('cloudinary', { cloudName: e.target.value.trim(), uploadPreset: f.cloudinary?.uploadPreset || '' })}
              />
            </label>
            <label>
              Upload preset (unsigned)
              <input
                value={f.cloudinary?.uploadPreset || ''}
                onChange={(e) => set('cloudinary', { cloudName: f.cloudinary?.cloudName || '', uploadPreset: e.target.value.trim() })}
              />
            </label>
          </div>
        </section>

        <div className="barra-guardar">
          {error && <div className="error">{error}</div>}
          {msg && <div className="exito">{msg}</div>}
          <button className="boton primario" onClick={guardar}>
            Guardar configuración
          </button>
        </div>
      </div>
    </Layout>
  );
}
