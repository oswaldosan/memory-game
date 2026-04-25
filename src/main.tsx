import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import App from './App';
import Menu from './components/Menu';
import Admin from './components/Admin';
import EditGame from './components/EditGame';
import './styles/game.css';

const GameByParam: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  if (!gameId) return <Navigate to="/menu" replace />;
  if (gameId === 'ficohsa') return <Navigate to="/" replace />;
  return <App key={gameId} routeGameId={gameId} />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Ficohsa es el juego principal por ahora (evita depender de /ficohsa en producción). */}
        <Route path="/" element={<App routeGameId="ficohsa" />} />
        <Route path="/ficohsa" element={<Navigate to="/" replace />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/edit/:id" element={<EditGame />} />
        <Route path="/g/:gameId" element={<GameByParam />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
