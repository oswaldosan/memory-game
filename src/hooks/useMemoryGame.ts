import { useEffect, useState } from 'react';
import { Card, GameState } from '../types';
import { createGameCards, resolveGameAssets } from '../utils/gameUtils';
import gameConfig from '../gameConfig.json';

export const useMemoryGame = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<Card[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameState>('playing');
  const [moves, setMoves] = useState(0);
  const [currentGameId, setCurrentGameId] = useState<string>('initial');
  const [totalPairs, setTotalPairs] = useState<number>(gameConfig.gameSettings.board.totalPairs);

  const maxMoves = gameConfig.gameSettings.board.maxMoves;

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    if (matchedPairs === totalPairs && gameStatus === 'playing') {
      setGameStatus('won');
    }
  }, [matchedPairs, totalPairs, gameStatus]);

  useEffect(() => {
    if (moves >= maxMoves && matchedPairs < totalPairs && gameStatus === 'playing') {
      setGameStatus('lost');
    }
  }, [moves, maxMoves, matchedPairs, totalPairs, gameStatus]);

  useEffect(() => {
    if (flippedCards.length === 2) {
      const [first, second] = flippedCards;
      setMoves(prev => prev + 1);
      
      if (first.image === second.image) {
        // Coincidencia encontrada
        setTimeout(() => {
          setCards(prev => 
            prev.map(card => 
              card.id === first.id || card.id === second.id
                ? { ...card, matched: true, flipped: true }
                : card
            )
          );
          setMatchedPairs(prev => prev + 1);
          setFlippedCards([]);
        }, 1000);
      } else {
        // Sin coincidencia
        setTimeout(() => {
          setCards(prev => 
            prev.map(card => 
              card.id === first.id || card.id === second.id
                ? { ...card, flipped: false }
                : card
            )
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  }, [flippedCards]);

  const initializeGame = async (explicitGameId?: string) => {
    const { images, gameId } = await resolveGameAssets(explicitGameId);
    const pairs = Math.min(images.length, gameConfig.gameSettings.board.totalPairs);
    setTotalPairs(pairs);
    const selected = images.slice(0, pairs);
    const gameCards = createGameCards(selected);
    setCards(gameCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameStatus('playing');
    setMoves(0);
    setCurrentGameId(gameId);
  };

  const handleCardClick = (clickedCard: Card) => {
    if (
      gameStatus !== 'playing' ||
      flippedCards.length >= 2 || 
      clickedCard.matched || 
      clickedCard.flipped ||
      flippedCards.some(card => card.id === clickedCard.id) ||
      moves >= maxMoves
    ) {
      return;
    }

    const updatedCard = { ...clickedCard, flipped: true };
    setCards(prev => 
      prev.map(card => 
        card.id === clickedCard.id ? updatedCard : card
      )
    );
    setFlippedCards(prev => [...prev, updatedCard]);
  };

  const handleNewGame = () => {
    initializeGame();
  };

  const handleSelectGame = (gameId: string) => {
    initializeGame(gameId);
  };

  const handlePauseGame = () => {
    setGameStatus(gameStatus === 'paused' ? 'playing' : 'paused');
  };

  const isGameOver = gameStatus === 'won' || gameStatus === 'lost';

  return {
    cards,
    handleCardClick,
    handleNewGame,
    handleSelectGame,
    handlePauseGame,
    gameStatus,
    isGameOver,
    matchedPairs,
    totalPairs,
    moves,
    maxMoves,
    timer: 0,
    score: 0,
    currentGameId
  };
};