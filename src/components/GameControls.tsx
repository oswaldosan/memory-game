import React from 'react';
import { GameControlsProps } from '../types';

const GameControls: React.FC<GameControlsProps> = ({ 
  onNewGame, 
  gameStatus, 
  matchedPairs, 
  totalPairs,
  moves,
  maxMoves 
}) => {
  const remainingMoves = maxMoves - moves;
  const progressPercentage = (matchedPairs / totalPairs) * 100;
  
  return (
    <div className="game-controls">
      <button className="button" onClick={onNewGame}>
        Nuevo Juego
      </button>
      <div className="game-stats">
        <div className="stat-item">
          <span className="stat-label">Movimientos:</span>
          <span className={`stat-value ${remainingMoves <= 3 ? 'warning' : ''}`}>
            {moves}/{maxMoves}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Parejas:</span>
          <span className="stat-value">{matchedPairs}/{totalPairs}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Estado:</span>
          <span className="stat-value">
            {gameStatus === 'playing' && 'Jugando'}
            {gameStatus === 'won' && 'Ganado'}
            {gameStatus === 'lost' && 'Perdido'}
            {gameStatus === 'paused' && 'Pausado'}
          </span>
        </div>
      </div>
      <div className="progress-bar">
        <div className="progress-label">Progreso del Juego</div>
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-text">{Math.round(progressPercentage)}%</div>
      </div>
    </div>
  );
};

export default GameControls;