import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRemoteGame, listRemoteGames } from '../utils/gamesRemote';
import type { GameRegistry } from '../utils/gameUtils';
import AdminGate from './admin/AdminGate';
import AdminHeader from './admin/AdminHeader';
import GameForm, { type GameFormInitial } from './admin/GameForm';

const EMPTY: GameFormInitial = { id: '', title: '', cards: [] };

const CreateGame: React.FC = () => {
  const navigate = useNavigate();
  const [existingIds, setExistingIds] = useState<ReadonlySet<string>>(new Set());
  const [idsError, setIdsError] = useState<string | null>(null);

  /**
   * Loads every taken id (static repo games + Firestore). Unlike the player-facing loader this
   * does NOT swallow Firestore errors: an empty set would wrongly report every id as available.
   */
  const loadIds = useCallback(() => {
    let cancelled = false;
    setIdsError(null);
    const staticIds = fetch('/games/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<GameRegistry>) : { games: [] }))
      .then((reg) => (reg.games || []).map((g) => g.id))
      .catch(() => [] as string[]);
    Promise.all([staticIds, listRemoteGames()])
      .then(([local, remote]) => {
        if (!cancelled) setExistingIds(new Set([...local, ...remote.map((g) => g.id)]));
      })
      .catch((err) => {
        if (!cancelled) setIdsError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(loadIds, [loadIds]);

  return (
    <AdminGate title="Nuevo juego">
      {({ user, logout }) => (
        <>
          <AdminHeader email={user.email} onLogout={logout} back={{ to: '/admin', label: 'Juegos' }} />
          <main className="adm-main">
            <div className="adm-page-head">
              <div>
                <h1 className="adm-h1">Nuevo juego</h1>
                <p className="adm-muted">Completa los pasos y guarda. Podrás editarlo después.</p>
              </div>
            </div>
            {idsError && (
              <div className="adm-alert adm-alert--warning" role="alert">
                <span>
                  No se pudieron cargar los juegos existentes ({idsError}), así que no podemos avisarte de
                  identificadores repetidos mientras escribes. Al guardar se verificará igualmente.
                </span>
                <button type="button" className="adm-btn adm-btn--sm" onClick={loadIds}>
                  Reintentar
                </button>
              </div>
            )}
            <GameForm
              mode="create"
              initial={EMPTY}
              existingIds={existingIds}
              submitLabel="Crear juego"
              onSubmit={(input, onProgress) => createRemoteGame(input, user.uid, onProgress)}
              onSaved={(entry) =>
                navigate('/admin', {
                  replace: true,
                  state: { flash: `Juego "${entry.title}" creado. Ya está disponible en /g/${entry.id}.` },
                })
              }
            />
          </main>
        </>
      )}
    </AdminGate>
  );
};

export default CreateGame;
