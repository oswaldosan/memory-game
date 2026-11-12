import React, { useEffect, useId, useRef } from 'react';
import { formatDuration } from '../utils/gameUtils';

interface GameOverModalProps {
  isOpen: boolean;
  isWin: boolean;
  moves: number;
  maxMoves: number;
  matchedPairs: number;
  totalPairs: number;
  elapsedMs: number;
  modalStyle?: React.CSSProperties;
  onTryAgain: () => void;
  onClose: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isWin,
  moves,
  maxMoves,
  matchedPairs,
  totalPairs,
  elapsedMs,
  modalStyle,
  onTryAgain,
  onClose,
}) => {
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Minimal focus trap: keep Tab cycling inside the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-content"
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-emoji" aria-hidden="true">
            {isWin ? '🎉' : '😔'}
          </span>
          <h2 id={titleId}>{isWin ? '¡Felicidades!' : '¡Juego terminado!'}</h2>
        </div>
        <div className="modal-body">
          <p id={descId}>
            {isWin
              ? `Encontraste todas las parejas en ${moves} movimientos.`
              : 'Se agotaron los movimientos. ¡Inténtalo de nuevo!'}
          </p>
          <dl className="modal-stats">
            <div>
              <dt>Movimientos</dt>
              <dd>
                {moves}/{maxMoves}
              </dd>
            </div>
            <div>
              <dt>Parejas</dt>
              <dd>
                {matchedPairs}/{totalPairs}
              </dd>
            </div>
            <div>
              <dt>Tiempo</dt>
              <dd>{formatDuration(elapsedMs)}</dd>
            </div>
          </dl>
        </div>
        <div className="modal-actions">
          <button ref={primaryRef} type="button" className="button primary" onClick={onTryAgain}>
            {isWin ? 'Jugar de nuevo' : 'Intentar de nuevo'}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            Ver tablero
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;
