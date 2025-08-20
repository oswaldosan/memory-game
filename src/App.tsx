import React, { useEffect, useMemo, useState } from 'react';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOverModal from './components/GameOverModal';
import { useMemoryGame } from './hooks/useMemoryGame';
import gameConfig from './gameConfig.json';
import { resolveGameAssets, GameThemeOverride } from './utils/gameUtils';
import './styles/game.css';

const App: React.FC = () => {
  const {
    cards,
    handleCardClick,
    handleNewGame,
    gameStatus,
    isGameOver,
    matchedPairs,
    totalPairs,
    moves,
    maxMoves,
  } = useMemoryGame();

  const isWin = gameStatus === 'won';

  const [backLogoUrl, setBackLogoUrl] = useState<string | undefined>(undefined);
  const [gameTitle, setGameTitle] = useState<string>('');
  const [override, setOverride] = useState<GameThemeOverride | undefined>(undefined);
  const cardBackColor = override?.cardBackColor || gameConfig.gameSettings.theme.cardBackColor;
  const cardFaceBgColor = override?.cardFaceBgColor;

  useEffect(() => {
    const applyTheme = (ov?: GameThemeOverride) => {
      const root = document.documentElement;
      const baseLayout = gameConfig.gameSettings.theme.layout;
      const layout = ov?.layout ? { ...baseLayout, ...ov.layout } : baseLayout;
      if (layout.backgroundType === 'gradient') {
        root.style.setProperty('--app-background',
          `linear-gradient(${layout.gradientDirection}, ${layout.gradientStart} 0%, ${layout.gradientEnd} 100%)`
        );
      } else {
        root.style.setProperty('--app-background', layout.backgroundColor || '#667eea');
      }

      // Card size
      const { cardSize } = gameConfig.gameSettings.board;
      root.style.setProperty('--card-width', cardSize.width);
      root.style.setProperty('--card-height', cardSize.height);

      // Board/controls backgrounds
      const { gameBoard, controls } = gameConfig.gameSettings.theme;
      root.style.setProperty('--game-board-bg', ov?.gameBoardBg || gameBoard.backgroundColor);
      root.style.setProperty('--game-board-radius', gameBoard.borderRadius);
      root.style.setProperty('--controls-bg', ov?.controlsBg || controls.backgroundColor);
      root.style.setProperty('--controls-radius', controls.borderRadius);

      // Buttons
      const buttons = ov?.buttons;
      root.style.setProperty('--btn-base-start', buttons?.baseStart || '#4a90e2');
      root.style.setProperty('--btn-base-end', buttons?.baseEnd || '#357ab8');
      root.style.setProperty('--btn-text', buttons?.textColor || '#ffffff');
      root.style.setProperty('--btn-primary-start', buttons?.primaryStart || '#4CAF50');
      root.style.setProperty('--btn-primary-end', buttons?.primaryEnd || '#45a049');
      root.style.setProperty('--btn-primary-text', buttons?.primaryTextColor || '#ffffff');
    };

    applyTheme(override);
  }, [override]);

  useEffect(() => {
    // Load dynamic game assets and overrides based on game ID
    resolveGameAssets().then(({ logoUrl, theme, title }) => {
      setBackLogoUrl(logoUrl);
      setOverride(theme);
      setGameTitle(title);
    });
  }, []);

  return (
    <div className="app">
      {backLogoUrl && (
        <div className="app-header">
          <img className="brand-logo" src={backLogoUrl} alt={gameTitle || 'Game Logo'} />
        </div>
      )}
      <GameControls 
        onNewGame={handleNewGame} 
        gameStatus={gameStatus}
        matchedPairs={matchedPairs}
        totalPairs={totalPairs}
        moves={moves}
        maxMoves={maxMoves}
      />
      <GameBoard 
        cards={cards} 
        onCardClick={handleCardClick}
        disabled={isGameOver || gameStatus === 'paused'}
        cardBackColor={cardBackColor}
        cardFaceBgColor={cardFaceBgColor}
        backLogoUrl={backLogoUrl}
      />
      <GameOverModal
        isOpen={isGameOver}
        isWin={isWin}
        moves={moves}
        onTryAgain={handleNewGame}
        onClose={() => {}}
      />
    </div>
  );
};

export default App;