import React, { useEffect, useState } from 'react';
import { GameOverModalProps } from '../types';
import gameConfig from '../gameConfig.json';
import { resolveGameAssets } from '../utils/gameUtils';

const GameOverModal: React.FC<GameOverModalProps> = ({ 
  isOpen, 
  isWin, 
  moves, 
  onTryAgain, 
  onClose 
}) => {
  const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const base = gameConfig.gameSettings.theme.modal as any;
    resolveGameAssets().then(({ theme }) => {
      const modal = theme?.modal ? { ...base, ...theme.modal } : base;
      if (modal.backgroundType === 'gradient') {
        setModalStyle({
          background: `linear-gradient(${modal.gradientDirection}, ${modal.gradientStart} 0%, ${modal.gradientEnd} 100%)`
        });
      } else {
        setModalStyle({
          backgroundColor: modal.backgroundColor || '#667eea'
        });
      }
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isWin ? '🎉 ¡Felicidades!' : '😔 ¡Juego Terminado!'}</h2>
        </div>
        <div className="modal-body">
          {isWin ? (
            <p>¡Has ganado en {moves} movimientos!</p>
          ) : (
            <p>Se agotaron los movimientos. ¡Intenta de nuevo!</p>
          )}
        </div>
        <div className="modal-actions">
          <button className="button primary" onClick={onTryAgain}>
            Intenta de Nuevo
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;