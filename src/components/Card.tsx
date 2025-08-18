import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onClick: (card: CardType) => void;
  flipped?: boolean;
  disabled?: boolean;
  cardBackColor?: string;
  backLogoUrl?: string;
}

const Card: React.FC<CardProps> = ({ card, onClick, cardBackColor = '#4a90e2', backLogoUrl }) => {
  const handleClick = () => {
    onClick(card);
  };

  return (
    <div className={`card ${card.flipped || card.matched ? 'flipped' : ''}`} onClick={handleClick}>
      <div className="card-inner">
        <div className="card-front" style={{ backgroundColor: cardBackColor }}>
          {backLogoUrl && <img src={backLogoUrl} alt="card back" className="card-logo" />}
        </div>
        <div className="card-back">
          <img src={card.image} alt="card" className="card-image" />
        </div>
      </div>
    </div>
  );
};

export default Card;