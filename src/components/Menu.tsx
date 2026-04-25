import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadGameRegistry, GameRegistryEntry } from '../utils/gameUtils';

const Menu: React.FC = () => {
  const [games, setGames] = useState<GameRegistryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGameRegistry()
      .then((reg) => setGames(reg.games || []))
      .catch((e) => setError(e.message || 'Error al cargar juegos'));
  }, []);

  const linkFor = (id: string) => (id === 'ficohsa' ? '/' : `/g/${id}`);

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Memory Games</h1>
      <p style={styles.subtitle}>
        Elegí un juego o <Link to="/admin" style={styles.adminLink}>creá uno nuevo</Link>.
      </p>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.grid}>
        {games.map((g) => (
          <Link key={g.id} to={linkFor(g.id)} style={styles.card}>
            <div style={styles.logoBox}>
              <img src={g.logo} alt={g.title} style={styles.logo} />
            </div>
            <div style={styles.cardTitle}>{g.title}</div>
            <div style={styles.cardId}>{g.id}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 960,
    margin: '0 auto',
    padding: 24,
    color: '#1a1a1a',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  },
  title: { fontSize: '2rem', marginBottom: 4 },
  subtitle: { marginTop: 0, marginBottom: 24, color: '#555' },
  adminLink: { color: '#0056b3', textDecoration: 'underline' },
  error: { color: '#c0392b' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    border: '1px solid #e3e3e3',
    borderRadius: 12,
    background: '#fff',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  },
  logoBox: {
    width: 120,
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  cardTitle: { fontWeight: 600, fontSize: '1.05rem' },
  cardId: { fontSize: '0.8rem', color: '#888', marginTop: 4 },
};

export default Menu;
