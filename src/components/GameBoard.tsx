import React from 'react';
import type { Card as CardType } from '../types';
import { getBoardColumns } from '../utils/gameUtils';
import Card from './Card';

interface GameBoardProps {
  cards: CardType[];
  onCardClick: (id: string) => void;
  disabled?: boolean;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  backLogoUrl?: string;
}

/** Mobile never goes beyond 4 columns so cards stay tappable; the board scrolls instead. */
const MOBILE_MAX_COLUMNS = 4;

const GameBoard: React.FC<GameBoardProps> = ({
  cards,
  onCardClick,
  disabled = false,
  cardBackColor,
  cardFaceBgColor,
  backLogoUrl,
}) => {
  const cols = getBoardColumns(cards.length);
  const style = {
    '--cols-desktop': cols,
    '--cols-mobile': Math.min(cols, MOBILE_MAX_COLUMNS),
  } as React.CSSProperties;

  return (
    <section className="game-board" style={style} aria-label="Tablero de cartas">
      {cards.map((card, index) => (
        <Card
          key={card.id}
          card={card}
          position={index + 1}
          onFlip={onCardClick}
          disabled={disabled}
          cardBackColor={cardBackColor}
          cardFaceBgColor={cardFaceBgColor}
          backLogoUrl={backLogoUrl}
        />
      ))}
    </section>
  );
};

export default GameBoard;
