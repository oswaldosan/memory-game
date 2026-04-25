import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isAdminEmail } from '../firebase';
import {
  deleteRemoteGame,
  getRemoteGame,
  updateRemoteGame,
} from '../utils/gamesRemote';
import { GameRegistryEntry, GameThemeOverride } from '../utils/gameUtils';

type Status = 'idle' | 'loading' | 'submitting' | 'deleting' | 'success' | 'error';

interface ThemeForm {
  bgType: 'solid' | 'gradient';
  bgColor: string;
  gradStart: string;
  gradEnd: string;
  textColor: string;
  cardBackColor: string;
  cardFaceBgColor: string;
}

const themeToForm = (t?: GameThemeOverride): ThemeForm => ({
  bgType: (t?.layout?.backgroundType as 'solid' | 'gradient') || 'solid',
  bgColor: t?.layout?.backgroundColor || '#ffffff',
  gradStart: t?.layout?.gradientStart || '#667eea',
  gradEnd: t?.layout?.gradientEnd || '#764ba2',
  textColor: t?.appTextColor || '#1a1a1a',
  cardBackColor: t?.cardBackColor || '#4a90e2',
  cardFaceBgColor: t?.cardFaceBgColor || '#ffffff',
});

const formToTheme = (f: ThemeForm): GameThemeOverride => ({
  appTextColor: f.textColor,
  modalTextColor: f.textColor,
  layout:
    f.bgType === 'gradient'
      ? {
          backgroundType: 'gradient',
          gradientStart: f.gradStart,
          gradientEnd: f.gradEnd,
          gradientDirection: '135deg',
        }
      : { backgroundType: 'solid', backgroundColor: f.bgColor },
  cardBackColor: f.cardBackColor,
  cardFaceBgColor: f.cardFaceBgColor,
});

const EditGame: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [game, setGame] = useState<GameRegistryEntry | null>(null);
  const [title, setTitle] = useState('');
  const [keepCards, setKeepCards] = useState<string[]>([]);
  const [newCardFiles, setNewCardFiles] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [themeForm, setThemeForm] = useState<ThemeForm>(themeToForm());

  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!id) return;
    setStatus('loading');
    getRemoteGame(id)
      .then((g) => {
        if (!g) {
          setStatus('error');
          setMessage('Juego no encontrado en Firestore (¿es estático del repo?)');
          return;
        }
        setGame(g);
        setTitle(g.title);
        setKeepCards(g.cards);
        setThemeForm(themeToForm(g.theme));
        setStatus('idle');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.message || 'Error al cargar el juego');
      });
  }, [id]);

  const setTheme = <K extends keyof ThemeForm>(k: K, v: ThemeForm[K]) =>
    setThemeForm((prev) => ({ ...prev, [k]: v }));

  const handleRemoveCard = (url: string) => {
    setKeepCards((prev) => prev.filter((u) => u !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (keepCards.length + newCardFiles.length < 2) {
      setStatus('error');
      setMessage('Tiene que quedar al menos 2 cartas');
      return;
    }
    setStatus('submitting');
    setMessage('');
    setProgress('Preparando…');
    try {
      await updateRemoteGame(
        {
          id,
          title: title.trim(),
          theme: formToTheme(themeForm),
          logoFile,
          keepCards,
          newCardFiles,
        },
        user.uid,
        (p) => {
          if (p.phase === 'card') setProgress(`Subiendo carta ${p.index}/${p.total}…`);
          else if (p.phase === 'logo') setProgress('Subiendo logo…');
          else if (p.phase === 'firestore') setProgress('Guardando configuración…');
          else if (p.phase === 'done') setProgress('Listo');
        }
      );
      setStatus('success');
      setProgress('');
      setMessage('Cambios guardados.');
      setNewCardFiles([]);
      setLogoFile(null);
      const refreshed = await getRemoteGame(id);
      if (refreshed) {
        setGame(refreshed);
        setKeepCards(refreshed.cards);
      }
    } catch (err: any) {
      setStatus('error');
      setProgress('');
      const code = err?.code ? ` [${err.code}]` : '';
      setMessage((err?.message || 'Error desconocido') + code);
      console.error('[edit] updateRemoteGame falló', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm(`¿Borrar el juego "${id}" y todas sus imágenes? No se puede deshacer.`)) return;
    setStatus('deleting');
    setMessage('');
    try {
      await deleteRemoteGame(id);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Error al borrar');
    }
  };

  if (!authReady || status === 'loading') {
    return (
      <div style={styles.wrap}>
        <p>Cargando…</p>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>Editar juego</h1>
        <p>Necesitás iniciar sesión como admin.</p>
        <Link to="/admin">← Ir a Admin</Link>
      </div>
    );
  }

  if (!game) {
    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>Editar juego</h1>
        <p style={styles.error}>{message || 'Juego no disponible'}</p>
        <Link to="/admin">← Volver</Link>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>Editar: {game.id}</h1>
        <Link to="/admin">← Admin</Link>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={styles.input}
          />
        </Field>

        <Field label="Logo actual">
          <img src={game.logo} alt="logo" style={styles.logoPreview} />
        </Field>
        <Field label="Reemplazar logo (opcional)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />
        </Field>

        <Field label={`Cartas actuales (${keepCards.length})`}>
          <div style={styles.cardGrid}>
            {keepCards.map((url) => (
              <div key={url} style={styles.cardThumb}>
                <img src={url} alt="carta" style={styles.cardImg} />
                <button
                  type="button"
                  onClick={() => handleRemoveCard(url)}
                  style={styles.removeBtn}
                  title="Quitar (no borra del Storage)"
                >
                  ×
                </button>
              </div>
            ))}
            {keepCards.length === 0 && <small style={styles.hint}>Sin cartas.</small>}
          </div>
        </Field>

        <Field label={`Agregar cartas nuevas (${newCardFiles.length})`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setNewCardFiles(Array.from(e.target.files || []))}
          />
          <small style={styles.hint}>
            Total tras guardar: {keepCards.length + newCardFiles.length}
          </small>
        </Field>

        <fieldset style={styles.fieldset}>
          <legend>Tema</legend>
          <Field label="Tipo de fondo">
            <select
              value={themeForm.bgType}
              onChange={(e) => setTheme('bgType', e.target.value as 'solid' | 'gradient')}
              style={styles.input}
            >
              <option value="solid">Sólido</option>
              <option value="gradient">Gradiente</option>
            </select>
          </Field>
          {themeForm.bgType === 'solid' ? (
            <Field label="Color de fondo">
              <input
                type="color"
                value={themeForm.bgColor}
                onChange={(e) => setTheme('bgColor', e.target.value)}
              />
            </Field>
          ) : (
            <>
              <Field label="Gradiente inicio">
                <input
                  type="color"
                  value={themeForm.gradStart}
                  onChange={(e) => setTheme('gradStart', e.target.value)}
                />
              </Field>
              <Field label="Gradiente fin">
                <input
                  type="color"
                  value={themeForm.gradEnd}
                  onChange={(e) => setTheme('gradEnd', e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Color de texto">
            <input
              type="color"
              value={themeForm.textColor}
              onChange={(e) => setTheme('textColor', e.target.value)}
            />
          </Field>
          <Field label="Reverso de carta">
            <input
              type="color"
              value={themeForm.cardBackColor}
              onChange={(e) => setTheme('cardBackColor', e.target.value)}
            />
          </Field>
          <Field label="Frente de carta">
            <input
              type="color"
              value={themeForm.cardFaceBgColor}
              onChange={(e) => setTheme('cardFaceBgColor', e.target.value)}
            />
          </Field>
        </fieldset>

        <div style={styles.actions}>
          <button type="submit" disabled={status === 'submitting'} style={styles.button}>
            {status === 'submitting' ? progress || 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={status === 'deleting'}
            style={styles.dangerBtn}
          >
            {status === 'deleting' ? 'Borrando…' : 'Borrar juego'}
          </button>
        </div>
      </form>

      {status === 'submitting' && progress && <p style={styles.progress}>{progress}</p>}
      {message && status !== 'submitting' && (
        <p style={status === 'error' ? styles.error : styles.success}>{message}</p>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={styles.field}>
    <span style={styles.label}>{label}</span>
    {children}
  </label>
);

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 720,
    margin: '0 auto',
    padding: 24,
    color: '#1a1a1a',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '1.6rem', marginBottom: 8 },
  form: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontWeight: 600, fontSize: '0.9rem' },
  input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.95rem' },
  hint: { color: '#666', fontSize: '0.8rem' },
  fieldset: {
    border: '1px solid #e3e3e3',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  logoPreview: { maxWidth: 120, maxHeight: 120, objectFit: 'contain' },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: 8,
  },
  cardThumb: { position: 'relative', border: '1px solid #ddd', borderRadius: 6, padding: 4 },
  cardImg: { width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: 0,
    background: 'rgba(192, 57, 43, 0.9)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
  },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  button: {
    padding: '10px 16px',
    background: '#0056b3',
    color: '#fff',
    border: 0,
    borderRadius: 6,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  dangerBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: '#c0392b',
    border: '1px solid #c0392b',
    borderRadius: 6,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  error: { color: '#c0392b' },
  success: { color: '#1e7e34' },
  progress: { color: '#0056b3', fontStyle: 'italic' },
};

export default EditGame;
