import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadGameRegistry, type GameRegistryEntry } from '../utils/gameUtils';
import '../styles/admin.css';

type MenuState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; games: GameRegistryEntry[] };

const linkFor = (id: string) => (id === 'ficohsa' ? '/' : `/g/${id}`);

const Menu: React.FC = () => {
  const [state, setState] = useState<MenuState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadGameRegistry()
      .then((reg) => !cancelled && setState({ kind: 'ready', games: reg.games || [] }))
      .catch((e) => !cancelled && setState({ kind: 'error', message: e?.message || 'Error al cargar juegos' }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="adm">
      <main className="adm-main adm-main--wide">
        <div className="adm-page-head">
          <div>
            <h1 className="adm-h1">Memory Games</h1>
            <p className="adm-muted">Elige un juego para empezar.</p>
          </div>
          <Link to="/admin" className="adm-btn">
            Administrar juegos
          </Link>
        </div>

        {state.kind === 'error' && (
          <p className="adm-alert adm-alert--error" role="alert">
            {state.message}
          </p>
        )}

        {state.kind === 'ready' && state.games.length === 0 && (
          <div className="adm-empty-state">
            <p className="adm-empty-state__title">No hay juegos disponibles</p>
            <Link to="/admin" className="adm-btn adm-btn--primary">
              Crear un juego
            </Link>
          </div>
        )}

        <ul className="adm-menu-grid" aria-busy={state.kind === 'loading'}>
          {state.kind === 'loading'
            ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="adm-menu-card adm-menu-card--skeleton" aria-hidden="true">
                  <span className="adm-skel adm-skel--square" />
                  <span className="adm-skel adm-skel--text" />
                </li>
              ))
            : state.kind === 'ready' &&
              state.games.map((g) => (
                <li key={g.id}>
                  <Link to={linkFor(g.id)} className="adm-menu-card">
                    <span className="adm-menu-card__logo">
                      <img src={g.logo} alt="" loading="lazy" />
                    </span>
                    <span className="adm-menu-card__title">{g.title}</span>
                    <span className="adm-muted adm-menu-card__meta">
                      {g.cards.length} {g.cards.length === 1 ? 'pareja' : 'parejas'}
                    </span>
                  </Link>
                </li>
              ))}
        </ul>
      </main>
    </div>
  );
};

export default Menu;
