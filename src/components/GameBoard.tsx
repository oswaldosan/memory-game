import React from 'react';
import { Card as CardType } from '../types';
import { useMemoryGame } from '../hooks/useMemoryGame';
import Card from './Card';
import '../styles/game.css';

interface GameBoardProps {
  disabled?: boolean;
  cards: CardType[];
  onCardClick: (card: CardType) => void;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  backLogoUrl?: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ cards, onCardClick, cardBackColor, cardFaceBgColor, backLogoUrl }) => {
  const { gameStatus } = useMemoryGame();

  return (
    <div className="game-board">
      {gameStatus === 'playing' ? (
        cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onClick={onCardClick}
            flipped={card.flipped}
            disabled={gameStatus !== 'playing'}
            cardBackColor={cardBackColor}
            cardFaceBgColor={cardFaceBgColor}
            backLogoUrl={backLogoUrl}
          />
        ))
      ) : (
        <div className="game-over">
          <h2>{gameStatus === 'won' ? 'You Won!' : 'Game Over'}</h2>
        </div>
      )}
    </div>
  );
};

export default GameBoard;