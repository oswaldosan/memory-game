import React from 'react';
import type { GameStatus } from '../types';
import { formatDuration } from '../utils/gameUtils';

interface GameControlsProps {
  onNewGame: () => void;
  status: GameStatus;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  maxMoves: number;
  elapsedMs: number;
}

/** Remaining moves at or below this value are highlighted as a warning. */
const LOW_MOVES_THRESHOLD = 3;

const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  status,
  matchedPairs,
  totalPairs,
  moves,
  maxMoves,
  elapsedMs,
}) => {
  const remainingMoves = Math.max(0, maxMoves - moves);
  const progress = totalPairs > 0 ? Math.round((matchedPairs / totalPairs) * 100) : 0;
  const lowMoves = status === 'playing' && remainingMoves <= LOW_MOVES_THRESHOLD;

  return (
    <div className="game-controls">
      <dl className="game-stats">
        <div className="stat-item">
          <dt className="stat-label">Movimientos</dt>
          <dd className={`stat-value${lowMoves ? ' warning' : ''}`}>
            {moves}/{maxMoves}
          </dd>
        </div>
        <div className="stat-item">
          <dt className="stat-label">Parejas</dt>
          <dd className="stat-value">
            {matchedPairs}/{totalPairs}
          </dd>
        </div>
        <div className="stat-item">
          <dt className="stat-label">Tiempo</dt>
          <dd className="stat-value">
            <time dateTime={`PT${Math.floor(elapsedMs / 1000)}S`}>{formatDuration(elapsedMs)}</time>
          </dd>
        </div>
      </dl>

      <div className="progress-bar">
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Progreso del juego"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-text" aria-hidden="true">
          {progress}%
        </div>
      </div>

      <button type="button" className="button" onClick={onNewGame}>
        Nuevo juego
      </button>

      {/* Announce only meaningful changes to screen readers, not every timer tick. */}
      <p className="sr-only" aria-live="polite">
        {[
          `Parejas encontradas: ${matchedPairs} de ${totalPairs}`,
          lowMoves && remainingMoves > 0 ? `Quedan ${remainingMoves} movimientos` : '',
        ]
          .filter(Boolean)
          .join('. ')}
      </p>
    </div>
  );
};

export default GameControls;
