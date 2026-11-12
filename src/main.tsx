import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import App from './App';
import Menu from './components/Menu';
import './styles/game.css';

// Admin screens pull in Firebase Auth/Storage; load them on demand so players don't pay for it.
const Admin = lazy(() => import('./components/Admin'));
const CreateGame = lazy(() => import('./components/CreateGame'));
const EditGame = lazy(() => import('./components/EditGame'));

const RouteFallback: React.FC = () => (
  <div className="game-status" role="status">
    <span className="spinner" aria-hidden="true" />
    Cargando…
  </div>
);

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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Ficohsa es el juego principal por ahora (evita depender de /ficohsa en producción). */}
          <Route path="/" element={<App routeGameId="ficohsa" />} />
          <Route path="/ficohsa" element={<Navigate to="/" replace />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/new" element={<CreateGame />} />
          <Route path="/admin/edit/:id" element={<EditGame />} />
          <Route path="/g/:gameId" element={<GameByParam />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
