import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteRemoteGame, getRemoteGame, updateRemoteGame } from '../utils/gamesRemote';
import type { GameRegistryEntry } from '../utils/gameUtils';
import AdminGate from './admin/AdminGate';
import AdminHeader from './admin/AdminHeader';
import GameForm from './admin/GameForm';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; game: GameRegistryEntry; version: number };

const EditGameBody: React.FC<{ id: string; uid: string }> = ({ id, uid }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getRemoteGame(id)
      .then((game) => {
        if (cancelled) return;
        setState(game ? { kind: 'ready', game, version: 0 } : { kind: 'missing' });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Error al cargar el juego.' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (state.kind !== 'ready') return;
    const ok = window.confirm(
      `¿Eliminar "${state.game.title}" y todas sus imágenes? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRemoteGame(id);
      navigate('/admin', { replace: true, state: { flash: `Juego "${state.game.title}" eliminado.` } });
    } catch (err) {
      setDeleting(false);
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el juego.');
    }
  };

  if (state.kind === 'loading') {
    return (
      <div className="adm-center" role="status">
        <span className="adm-spinner" aria-hidden="true" />
        Cargando juego…
      </div>
    );
  }

  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <div className="adm-empty-state">
        <p className="adm-empty-state__title">
          {state.kind === 'missing' ? 'Juego no encontrado' : 'No se pudo cargar el juego'}
        </p>
        <p className="adm-muted">
          {state.kind === 'missing'
            ? `No existe un juego editable con el identificador "${id}". Los juegos incluidos en el repositorio no se editan desde aquí.`
            : state.message}
        </p>
        <div className="adm-row">
          {state.kind === 'error' && (
            <button type="button" className="adm-btn" onClick={load}>
              Reintentar
            </button>
          )}
          <Link to="/admin" className="adm-btn adm-btn--primary">
            Volver a juegos
          </Link>
        </div>
      </div>
    );
  }

  const { game, version } = state;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">Editar juego</h1>
          <p className="adm-muted">
            {game.title} ·{' '}
            <Link to={`/g/${game.id}`} className="adm-link">
              Abrir juego ↗
            </Link>
          </p>
        </div>
      </div>

      {savedAt && (
        <p className="adm-alert adm-alert--success" role="status">
          Cambios guardados a las {savedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}
      {deleteError && (
        <p className="adm-alert adm-alert--error" role="alert">
          {deleteError}
        </p>
      )}

      <GameForm
        // Remount with fresh server data after each save so "dirty" tracking restarts cleanly.
        key={version}
        mode="edit"
        initial={{
          id: game.id,
          title: game.title,
          logoUrl: game.logo,
          cards: game.cards,
          theme: game.theme,
          maxMoves: game.maxMoves,
        }}
        submitLabel="Guardar cambios"
        onSubmit={(input, onProgress) => updateRemoteGame(input, uid, onProgress)}
        onSaved={(updated) => {
          setSavedAt(new Date());
          setState({ kind: 'ready', game: updated, version: version + 1 });
        }}
        secondaryAction={
          <button
            type="button"
            className="adm-btn adm-btn--danger"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        }
      />
    </>
  );
};

const EditGame: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <AdminGate title="Editar juego">
      {({ user, logout }) => (
        <>
          <AdminHeader email={user.email} onLogout={logout} back={{ to: '/admin', label: 'Juegos' }} />
          <main className="adm-main">{id ? <EditGameBody id={id} uid={user.uid} /> : null}</main>
        </>
      )}
    </AdminGate>
  );
};

export default EditGame;
