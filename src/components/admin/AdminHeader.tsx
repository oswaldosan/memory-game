import React from 'react';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  email: string | null;
  onLogout: () => void;
  /** Optional back link shown before the title (e.g. to the game list). */
  back?: { to: string; label: string };
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ email, onLogout, back }) => (
  <header className="adm-topbar">
    <nav className="adm-topbar__nav" aria-label="Administración">
      {back ? (
        <Link to={back.to} className="adm-link">
          ← {back.label}
        </Link>
      ) : (
        <Link to="/menu" className="adm-link">
          ← Menú de juegos
        </Link>
      )}
    </nav>
    <div className="adm-topbar__user">
      <span className="adm-topbar__email" title={email ?? undefined}>
        {email}
      </span>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onLogout}>
        Salir
      </button>
    </div>
  </header>
);

export default AdminHeader;
