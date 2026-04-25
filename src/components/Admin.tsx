import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, isAdminEmail } from '../firebase';
import { createRemoteGame, loadRemoteGames } from '../utils/gamesRemote';
import { loadGameRegistry, GameRegistryEntry } from '../utils/gameUtils';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const Admin: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [cardFiles, setCardFiles] = useState<File[]>([]);

  const [bgType, setBgType] = useState<'solid' | 'gradient'>('solid');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [gradStart, setGradStart] = useState('#667eea');
  const [gradEnd, setGradEnd] = useState('#764ba2');
  const [textColor, setTextColor] = useState('#1a1a1a');
  const [cardBackColor, setCardBackColor] = useState('#4a90e2');
  const [cardFaceBgColor, setCardFaceBgColor] = useState('#ffffff');

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<string>('');
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [remoteGames, setRemoteGames] = useState<GameRegistryEntry[]>([]);

  const refreshRemote = () => {
    loadRemoteGames().then(setRemoteGames).catch(() => setRemoteGames([]));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    loadGameRegistry()
      .then((reg) => setExistingIds(new Set(reg.games.map((g) => g.id))))
      .catch(() => {});
    refreshRemote();
  }, []);

  const handleLogin = async () => {
    setMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setMessage(err.message || 'Error al iniciar sesión');
      setStatus('error');
    }
  };

  const handleLogout = () => signOut(auth);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus('submitting');
    setMessage('');
    setProgress('Preparando…');
    try {
      const cleanId = id.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(cleanId)) {
        throw new Error('ID inválido (a-z, 0-9, guiones, máx 40)');
      }
      if (existingIds.has(cleanId)) {
        throw new Error(`Ya existe un juego con id "${cleanId}"`);
      }
      if (cardFiles.length < 2) throw new Error('Subí al menos 2 imágenes de cartas');
      if (cardFiles.length > 24) throw new Error('Máximo 24 cartas');

      const theme = {
        appTextColor: textColor,
        modalTextColor: textColor,
        layout:
          bgType === 'gradient'
            ? {
                backgroundType: 'gradient' as const,
                gradientStart: gradStart,
                gradientEnd: gradEnd,
                gradientDirection: '135deg',
              }
            : { backgroundType: 'solid' as const, backgroundColor: bgColor },
        cardBackColor,
        cardFaceBgColor,
      };

      await createRemoteGame(
        { id: cleanId, title: title.trim(), theme, logoFile, cardFiles },
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
      setMessage(`Juego "${cleanId}" creado. Probalo en /g/${cleanId}.`);
      setExistingIds((prev) => new Set([...prev, cleanId]));
      setId('');
      setTitle('');
      setLogoFile(null);
      setCardFiles([]);
      refreshRemote();
    } catch (err: any) {
      setStatus('error');
      setProgress('');
      const code = err?.code ? ` [${err.code}]` : '';
      setMessage((err?.message || 'Error desconocido') + code);
      console.error('[admin] createRemoteGame falló', err);
    }
  };

  if (!authReady) {
    return (
      <div style={styles.wrap}>
        <p>Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>Admin</h1>
        <p>
          <Link to="/menu">← Volver al menú</Link>
        </p>
        <p>Iniciá sesión para crear juegos.</p>
        <button onClick={handleLogin} style={styles.button}>
          Iniciar sesión con Google
        </button>
        {message && <p style={styles.error}>{message}</p>}
      </div>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>Admin</h1>
        <p>
          La cuenta <strong>{user.email}</strong> no tiene permisos de admin.
        </p>
        <button onClick={handleLogout} style={styles.buttonGhost}>
          Cerrar sesión
        </button>{' '}
        <Link to="/menu">← Menú</Link>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>Crear nuevo juego</h1>
        <div>
          <span style={styles.userTag}>{user.email}</span>
          <button onClick={handleLogout} style={styles.buttonGhost}>
            Salir
          </button>
        </div>
      </div>
      <p>
        <Link to="/menu">← Volver al menú</Link>
      </p>

      {remoteGames.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.h2}>Juegos editables ({remoteGames.length})</h2>
          <ul style={styles.list}>
            {remoteGames.map((g) => (
              <li key={g.id} style={styles.listItem}>
                <img src={g.logo} alt="" style={styles.listLogo} />
                <div style={styles.listInfo}>
                  <strong>{g.title}</strong>
                  <span style={styles.listId}>{g.id} · {g.cards.length} cartas</span>
                </div>
                <Link to={`/admin/edit/${g.id}`} style={styles.editLink}>
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 style={styles.h2}>Crear juego nuevo</h2>
      <form onSubmit={onSubmit} style={styles.form}>
        <Field label="ID (slug)">
          <input
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            placeholder="mi-juego"
            pattern="[a-z0-9][a-z0-9-]{0,40}"
            title="a-z, 0-9 y guiones, máx 40"
            required
            style={styles.input}
          />
        </Field>
        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mi Memory"
            required
            style={styles.input}
          />
        </Field>

        <Field label="Logo (opcional)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />
        </Field>

        <Field label={`Cartas (mínimo 2 — actualmente ${cardFiles.length})`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setCardFiles(Array.from(e.target.files || []))}
            required
          />
          <small style={styles.hint}>
            Cada imagen forma un par. Recomendado: 4-8 imágenes.
          </small>
        </Field>

        <fieldset style={styles.fieldset}>
          <legend>Tema</legend>
          <Field label="Tipo de fondo">
            <select
              value={bgType}
              onChange={(e) => setBgType(e.target.value as 'solid' | 'gradient')}
              style={styles.input}
            >
              <option value="solid">Sólido</option>
              <option value="gradient">Gradiente</option>
            </select>
          </Field>
          {bgType === 'solid' ? (
            <Field label="Color de fondo">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Gradiente inicio">
                <input
                  type="color"
                  value={gradStart}
                  onChange={(e) => setGradStart(e.target.value)}
                />
              </Field>
              <Field label="Gradiente fin">
                <input type="color" value={gradEnd} onChange={(e) => setGradEnd(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Color de texto">
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </Field>
          <Field label="Reverso de carta">
            <input
              type="color"
              value={cardBackColor}
              onChange={(e) => setCardBackColor(e.target.value)}
            />
          </Field>
          <Field label="Frente de carta">
            <input
              type="color"
              value={cardFaceBgColor}
              onChange={(e) => setCardFaceBgColor(e.target.value)}
            />
          </Field>
        </fieldset>

        <button type="submit" disabled={status === 'submitting'} style={styles.button}>
          {status === 'submitting' ? progress || 'Subiendo…' : 'Crear juego'}
        </button>
      </form>

      {status === 'submitting' && progress && (
        <p style={styles.progress}>{progress}</p>
      )}
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
    maxWidth: 640,
    margin: '0 auto',
    padding: 24,
    color: '#1a1a1a',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  userTag: { fontSize: '0.85rem', color: '#555', marginRight: 8 },
  title: { fontSize: '1.8rem', marginBottom: 8 },
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
  button: {
    padding: '10px 16px',
    background: '#0056b3',
    color: '#fff',
    border: 0,
    borderRadius: 6,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  buttonGhost: {
    padding: '6px 10px',
    background: 'transparent',
    color: '#0056b3',
    border: '1px solid #0056b3',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  error: { color: '#c0392b' },
  success: { color: '#1e7e34' },
  progress: { color: '#0056b3', fontStyle: 'italic' },
  section: { marginTop: 20, marginBottom: 20 },
  h2: { fontSize: '1.1rem', marginTop: 24, marginBottom: 8 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    border: '1px solid #e3e3e3',
    borderRadius: 8,
  },
  listLogo: { width: 40, height: 40, objectFit: 'contain' },
  listInfo: { display: 'flex', flexDirection: 'column', flex: 1 },
  listId: { fontSize: '0.8rem', color: '#777' },
  editLink: {
    padding: '6px 12px',
    background: '#0056b3',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
};

export default Admin;
