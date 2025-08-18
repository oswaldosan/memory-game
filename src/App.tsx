import React, { useEffect, useMemo, useState } from 'react';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOverModal from './components/GameOverModal';
import { useMemoryGame } from './hooks/useMemoryGame';
import gameConfig from './gameConfig.json';
import { resolveGameAssets } from './utils/gameUtils';
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
  const cardBackColor = gameConfig.gameSettings.theme.cardBackColor;

  useEffect(() => {
    // Apply dynamic styles from config
    const { layout } = gameConfig.gameSettings.theme;
    const root = document.documentElement;
    
    if (layout.backgroundType === 'gradient') {
      root.style.setProperty('--app-background', 
        `linear-gradient(${layout.gradientDirection}, ${layout.gradientStart} 0%, ${layout.gradientEnd} 100%)`
      );
    } else {
      root.style.setProperty('--app-background', layout.backgroundColor || '#667eea');
    }

    // Set card size
    const { cardSize } = gameConfig.gameSettings.board;
    root.style.setProperty('--card-width', cardSize.width);
    root.style.setProperty('--card-height', cardSize.height);

    // Set other theme colors
    const { gameBoard, controls } = gameConfig.gameSettings.theme;
    root.style.setProperty('--game-board-bg', gameBoard.backgroundColor);
    root.style.setProperty('--game-board-radius', gameBoard.borderRadius);
    root.style.setProperty('--controls-bg', controls.backgroundColor);
    root.style.setProperty('--controls-radius', controls.borderRadius);

  }, []);

  useEffect(() => {
    // Load dynamic game assets (logo) based on game ID
    resolveGameAssets().then(({ logoUrl }) => setBackLogoUrl(logoUrl));
  }, []);

  return (
    <div className="app">
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