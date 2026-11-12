import React, { memo } from 'react';
import type { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  /** 1-based position on the board, used for the accessible name. */
  position: number;
  onFlip: (id: string) => void;
  disabled?: boolean;
  cardBackColor?: string;
  cardFaceBgColor?: string;
  backLogoUrl?: string;
}

const Card: React.FC<CardProps> = ({
  card,
  position,
  onFlip,
  disabled = false,
  cardBackColor,
  cardFaceBgColor,
  backLogoUrl,
}) => {
  const faceUp = card.flipped || card.matched;
  const label = card.matched
    ? `Carta ${position}: pareja encontrada`
    : faceUp
      ? `Carta ${position}: boca arriba`
      : `Carta ${position}: boca abajo`;

  return (
    <button
      type="button"
      className={`card${faceUp ? ' flipped' : ''}${card.matched ? ' matched' : ''}`}
      onClick={() => onFlip(card.id)}
      // Face-up cards stay focusable (aria-disabled) so keyboard focus is not lost mid-turn.
      aria-disabled={disabled || faceUp}
      aria-label={label}
    >
      <span className="card-inner">
        <span className="card-front" style={{ backgroundColor: cardBackColor }}>
          {backLogoUrl && <img src={backLogoUrl} alt="" className="card-logo" draggable={false} />}
        </span>
        <span className="card-back" style={{ backgroundColor: cardFaceBgColor }}>
          <img src={card.image} alt="" className="card-image" draggable={false} loading="lazy" />
        </span>
      </span>
    </button>
  );
};

export default memo(Card);
