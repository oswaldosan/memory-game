import React from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import '../../styles/admin.css';

interface AdminGateProps {
  title: string;
  children: (ctx: { user: User; logout: () => void }) => React.ReactNode;
}

/** Shared shell for admin pages: handles auth loading, sign-in and permission checks. */
const AdminGate: React.FC<AdminGateProps> = ({ title, children }) => {
  const { user, ready, error, signingIn, isAdmin, signIn, logout } = useAdminAuth();

  if (!ready) {
    return (
      <div className="adm">
        <div className="adm-center" role="status">
          <span className="adm-spinner" aria-hidden="true" />
          Cargando…
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="adm">
        <div className="adm-auth">
          <h1 className="adm-auth__title">{title}</h1>
          {!user ? (
            <>
              <p className="adm-muted">Inicia sesión con una cuenta autorizada para crear y editar juegos.</p>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                onClick={() => void signIn()}
                disabled={signingIn}
              >
                {signingIn ? 'Abriendo Google…' : 'Iniciar sesión con Google'}
              </button>
            </>
          ) : (
            <>
              <p className="adm-muted">
                La cuenta <strong>{user.email}</strong> no tiene permisos de administración.
              </p>
              <button type="button" className="adm-btn" onClick={() => void logout()}>
                Cerrar sesión
              </button>
            </>
          )}
          {error && (
            <p className="adm-alert adm-alert--error" role="alert">
              {error}
            </p>
          )}
          <Link to="/menu" className="adm-link">
            ← Volver al menú
          </Link>
        </div>
      </div>
    );
  }

  return <div className="adm">{children({ user, logout: () => void logout() })}</div>;
};

export default AdminGate;
