import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listRemoteGames } from '../utils/gamesRemote';
import type { GameRegistryEntry } from '../utils/gameUtils';
import AdminGate from './admin/AdminGate';
import AdminHeader from './admin/AdminHeader';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; games: GameRegistryEntry[] };

const GameList: React.FC = () => {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    listRemoteGames()
      .then((games) => setState({ kind: 'ready', games }))
      .catch((err) =>
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'No se pudieron cargar los juegos.' })
      );
  }, []);

  useEffect(load, [load]);

  return (
    <section aria-labelledby="games-title">
      <div className="adm-page-head">
        <div>
          <h1 id="games-title" className="adm-h1">Juegos</h1>
          <p className="adm-muted">Crea y administra los juegos de memoria guardados en Firebase.</p>
        </div>
        <Link to="/admin/new" className="adm-btn adm-btn--primary">
          + Nuevo juego
        </Link>
      </div>

      {flash && (
        <p className="adm-alert adm-alert--success" role="status">
          {flash}
        </p>
      )}

      {state.kind === 'loading' && (
        <ul className="adm-game-list" aria-busy="true" aria-label="Cargando juegos">
          {[0, 1, 2].map((i) => (
            <li key={i} className="adm-game adm-game--skeleton">
              <span className="adm-skel adm-skel--logo" />
              <span className="adm-skel adm-skel--text" />
            </li>
          ))}
        </ul>
      )}

      {state.kind === 'error' && (
        <div className="adm-alert adm-alert--error" role="alert">
          <span>No se pudieron cargar los juegos: {state.message}</span>
          <button type="button" className="adm-btn adm-btn--sm" onClick={load}>
            Reintentar
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.games.length === 0 && (
        <div className="adm-empty-state">
          <p className="adm-empty-state__title">Aún no hay juegos creados</p>
          <p className="adm-muted">Crea el primero: solo necesitas un título y al menos 2 imágenes.</p>
          <Link to="/admin/new" className="adm-btn adm-btn--primary">
            Crear juego
          </Link>
        </div>
      )}

      {state.kind === 'ready' && state.games.length > 0 && (
        <ul className="adm-game-list">
          {state.games.map((g) => (
            <li key={g.id} className="adm-game">
              <div className="adm-game__logo">
                <img src={g.logo} alt="" loading="lazy" />
              </div>
              <div className="adm-game__info">
                <strong className="adm-game__title">{g.title}</strong>
                <span className="adm-muted adm-game__meta">
                  /g/{g.id} · {g.cards.length} {g.cards.length === 1 ? 'pareja' : 'parejas'}
                </span>
              </div>
              <div className="adm-game__actions">
                <Link to={`/g/${g.id}`} className="adm-btn adm-btn--ghost adm-btn--sm" aria-label={`Jugar ${g.title}`}>
                  Jugar
                </Link>
                <Link to={`/admin/edit/${g.id}`} className="adm-btn adm-btn--sm" aria-label={`Editar ${g.title}`}>
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Admin: React.FC = () => (
  <AdminGate title="Administración">
    {({ user, logout }) => (
      <>
        <AdminHeader email={user.email} onLogout={logout} />
        <main className="adm-main">
          <GameList />
        </main>
      </>
    )}
  </AdminGate>
);

export default Admin;
