export interface Card {
  id: string;
  image: string;
  matched: boolean;
  flipped?: boolean;
}

export interface GameConfig {
  gameSettings: {
    theme: {
      cardBackColor: string;
      cardBorderRadius: string;
      cardPadding: string;
      layout: {
        backgroundType: 'solid' | 'gradient';
        backgroundColor?: string;
        gradientStart?: string;
        gradientEnd?: string;
        gradientDirection?: string;
      };
      gameBoard: {
        backgroundColor: string;
        borderRadius: string;
      };
      controls: {
        backgroundColor: string;
        borderRadius: string;
      };
      modal: {
        backgroundType: 'solid' | 'gradient';
        backgroundColor?: string;
        gradientStart?: string;
        gradientEnd?: string;
        gradientDirection?: string;
      };
    };
    logo: {
      url: string;
      width: string;
      height: string;
    };
    board: {
      rows: number;
      cols: number;
      totalPairs: number;
      maxMoves: number;
      cardSize: {
        width: string;
        height: string;
      };
    };
  };
  cards: Array<{
    id: number;
    image: string;
    matched: boolean;
  }>;
}

export type GameState = 'playing' | 'won' | 'lost' | 'paused';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Component Props Types
export interface CardProps {
  card: Card;
  onClick: (card: Card) => void;
  disabled?: boolean;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  backLogoUrl?: string;
}

export interface GameBoardProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  disabled?: boolean;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  backLogoUrl?: string;
}

export interface GameControlsProps {
  onNewGame: () => void;
  onPauseGame?: () => void;
  gameStatus: GameState;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  maxMoves: number;
  timer?: number;
  difficulty?: Difficulty;
  onDifficultyChange?: (difficulty: Difficulty) => void;
}

export interface GameOverModalProps {
  isOpen: boolean;
  isWin: boolean;
  moves: number;
  onTryAgain: () => void;
  onClose: () => void;
}

// Hook Return Types
export interface UseMemoryGameReturn {
  cards: Card[];
  handleCardClick: (card: Card) => void;
  handleNewGame: () => void;
  handleSelectGame: (gameId: string) => void;
  handlePauseGame: () => void;
  gameStatus: GameState;
  isGameOver: boolean;
  matchedPairs: number;
  totalPairs: number;
  moves: number;
  maxMoves: number;
  timer: number;
  score: number;
  currentGameId: string;
}