import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOverModal from './components/GameOverModal';
import { useMemoryGame } from './hooks/useMemoryGame';
import gameConfig from './gameConfig.json';
import type { GameThemeOverride } from './utils/gameUtils';
import './styles/game.css';

export type AppProps = {
  /** When set (e.g. `/ficohsa`), this game wins over `?game=`. */
  routeGameId?: string;
};

const baseTheme = gameConfig.gameSettings.theme;

/** Writes the game theme into CSS custom properties consumed by game.css. */
const applyTheme = (ov?: GameThemeOverride) => {
  const root = document.documentElement;
  const layout = { ...baseTheme.layout, ...ov?.layout };
  const appText = ov?.appTextColor ?? baseTheme.appTextColor ?? '#1a1a1a';
  const modalText = ov?.modalTextColor ?? baseTheme.modalTextColor ?? appText;
  root.style.setProperty('--app-foreground', appText);
  root.style.setProperty('--modal-foreground', modalText);
  root.style.setProperty(
    '--app-background',
    layout.backgroundType === 'gradient'
      ? `linear-gradient(${layout.gradientDirection || '135deg'}, ${layout.gradientStart} 0%, ${layout.gradientEnd} 100%)`
      : layout.backgroundColor || '#ffffff'
  );

  const { cardSize } = gameConfig.gameSettings.board;
  root.style.setProperty('--card-width', cardSize.width);
  root.style.setProperty('--card-height', cardSize.height);

  const { gameBoard, controls } = baseTheme;
  root.style.setProperty('--game-board-bg', ov?.gameBoardBg || gameBoard.backgroundColor);
  root.style.setProperty('--game-board-radius', gameBoard.borderRadius);
  root.style.setProperty('--controls-bg', ov?.controlsBg || controls.backgroundColor);
  root.style.setProperty('--controls-radius', controls.borderRadius);

  const buttons = ov?.buttons;
  root.style.setProperty('--btn-base-start', buttons?.baseStart || '#4a90e2');
  root.style.setProperty('--btn-base-end', buttons?.baseEnd || '#357ab8');
  root.style.setProperty('--btn-text', buttons?.textColor || '#ffffff');
  root.style.setProperty('--btn-primary-start', buttons?.primaryStart || '#4CAF50');
  root.style.setProperty('--btn-primary-end', buttons?.primaryEnd || '#45a049');
  root.style.setProperty('--btn-primary-text', buttons?.primaryTextColor || '#ffffff');
};

const getModalStyle = (ov?: GameThemeOverride): React.CSSProperties => {
  const modal = { ...baseTheme.modal, ...ov?.modal };
  return modal.backgroundType === 'gradient'
    ? {
        background: `linear-gradient(${modal.gradientDirection || '135deg'}, ${modal.gradientStart} 0%, ${modal.gradientEnd} 100%)`,
      }
    : { backgroundColor: modal.backgroundColor || '#ffffff' };
};

const App: React.FC<AppProps> = ({ routeGameId }) => {
  const game = useMemoryGame(routeGameId);
  const { assets, status, endedAt } = game;
  const theme = assets?.theme;

  /** The modal can be dismissed per finished round (keyed by its end timestamp). */
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);
  const closeModal = useCallback(() => setDismissedRound(endedAt), [endedAt]);

  useEffect(() => {
    if (assets) applyTheme(theme);
  }, [assets, theme]);

  useEffect(() => {
    if (assets?.title) document.title = assets.title;
  }, [assets?.title]);

  const modalStyle = useMemo(() => getModalStyle(theme), [theme]);
  const cardBackColor = theme?.cardBackColor || baseTheme.cardBackColor;

  return (
    <main className="app">
      {assets?.logoUrl && (
        <header className="app-header">
          <img className="brand-logo" src={assets.logoUrl} alt={assets.title || 'Logo del juego'} />
        </header>
      )}

      {status === 'loading' && (
        <div className="game-status" role="status">
          <span className="spinner" aria-hidden="true" />
          Cargando juego…
        </div>
      )}

      {status === 'error' && (
        <div className="game-status game-status--error" role="alert">
          <p>{game.error || 'No se pudo cargar el juego.'}</p>
          <div className="modal-actions">
            <button type="button" className="button" onClick={() => void game.retry()}>
              Reintentar
            </button>
            <Link to="/menu" className="button secondary">
              Ver todos los juegos
            </Link>
          </div>
        </div>
      )}

      {status !== 'loading' && status !== 'error' && (
        <>
          <GameControls
            onNewGame={game.handleNewGame}
            status={status}
            matchedPairs={game.matchedPairs}
            totalPairs={game.totalPairs}
            moves={game.moves}
            maxMoves={game.maxMoves}
            elapsedMs={game.elapsedMs}
          />
          <GameBoard
            cards={game.cards}
            onCardClick={game.handleCardClick}
            disabled={game.isGameOver || game.locked}
            cardBackColor={cardBackColor}
            cardFaceBgColor={theme?.cardFaceBgColor}
            backLogoUrl={assets?.logoUrl}
          />
        </>
      )}

      <GameOverModal
        isOpen={game.isGameOver && dismissedRound !== endedAt}
        isWin={status === 'won'}
        moves={game.moves}
        maxMoves={game.maxMoves}
        matchedPairs={game.matchedPairs}
        totalPairs={game.totalPairs}
        elapsedMs={game.elapsedMs}
        modalStyle={modalStyle}
        onTryAgain={game.handleNewGame}
        onClose={closeModal}
      />

      <footer className="app-version">v{__APP_VERSION__}</footer>
    </main>
  );
};

export default App;
