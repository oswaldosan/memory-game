import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { gameReducer, initialGameState } from '../utils/gameReducer';
import {
  createGameCards,
  getMaxMovesForPairs,
  resolveEffectiveGameId,
  resolveGameAssets,
  type ResolvedGameAssets,
} from '../utils/gameUtils';

/** How long a mismatched pair stays visible before flipping back. */
export const MISMATCH_DELAY_MS = 900;

/**
 * Loads a game's assets and runs a round with the pure `gameReducer`.
 * Assets are resolved once per game id and shared with the rest of the UI,
 * so App/Modal never need to fetch the registry again.
 */
export const useMemoryGame = (routeGameId?: string) => {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [assets, setAssets] = useState<ResolvedGameAssets | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Incremented on each load so a slow, stale request can never overwrite a newer one. */
  const requestRef = useRef(0);

  const startRound = useCallback((resolved: ResolvedGameAssets) => {
    const cards = createGameCards(resolved.images);
    const pairs = cards.length / 2;
    dispatch({ type: 'START', cards, maxMoves: getMaxMovesForPairs(pairs, resolved.maxMoves) });
  }, []);

  const loadGame = useCallback(async () => {
    const requestId = ++requestRef.current;
    dispatch({ type: 'LOAD' });
    try {
      const resolved = await resolveGameAssets(resolveEffectiveGameId(routeGameId));
      if (requestId !== requestRef.current) return;
      setAssets(resolved);
      startRound(resolved);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      const message = err instanceof Error ? err.message : 'No se pudo cargar el juego.';
      dispatch({ type: 'FAIL', message });
    }
  }, [routeGameId, startRound]);

  /** Marks any in-flight load as stale (on unmount / game change). */
  const invalidateRequests = useCallback(() => {
    requestRef.current++;
  }, []);

  useEffect(() => {
    void loadGame();
    return invalidateRequests;
  }, [loadGame, invalidateRequests]);

  // Flip a mismatched pair back. Cleared on restart/unmount, so it can never touch a new deck.
  useEffect(() => {
    if (!state.locked) return;
    const t = window.setTimeout(() => dispatch({ type: 'RESOLVE_MISMATCH' }), MISMATCH_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [state.locked]);

  // Tick the clock only while a round is actually running.
  const timerRunning = state.status === 'playing' && state.startedAt !== null;
  useEffect(() => {
    if (!timerRunning) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timerRunning]);

  const handleCardClick = useCallback((id: string) => {
    dispatch({ type: 'FLIP', id, now: Date.now() });
  }, []);

  /** Reshuffles the same game without refetching; falls back to a full load if assets are missing. */
  const handleNewGame = useCallback(() => {
    if (assets) startRound(assets);
    else void loadGame();
  }, [assets, loadGame, startRound]);

  const elapsedMs =
    state.startedAt === null ? 0 : Math.max(0, (state.endedAt ?? now) - state.startedAt);

  return {
    ...state,
    assets,
    elapsedMs,
    isGameOver: state.status === 'won' || state.status === 'lost',
    handleCardClick,
    handleNewGame,
    retry: loadGame,
  };
};
