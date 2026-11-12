import React from 'react';
import type { ThemeForm } from '../../utils/gameForm';

interface ThemePreviewProps {
  theme: ThemeForm;
  logoUrl?: string;
  sampleImage?: string;
  title: string;
}

/** Small live mock of the game screen so admins see colors before saving. */
const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, logoUrl, sampleImage, title }) => {
  const background =
    theme.bgType === 'gradient'
      ? `linear-gradient(135deg, ${theme.gradStart} 0%, ${theme.gradEnd} 100%)`
      : theme.bgColor;

  return (
    <figure className="adm-preview" aria-label="Vista previa del juego">
      <div className="adm-preview__screen" style={{ background, color: theme.textColor }}>
        {logoUrl ? (
          <img className="adm-preview__logo" src={logoUrl} alt="" />
        ) : (
          <span className="adm-preview__title">{title || 'Tu juego'}</span>
        )}
        <div className="adm-preview__stats">
          <span>Movimientos 3/20</span>
          <span>Parejas 1/4</span>
        </div>
        <div className="adm-preview__cards">
          <span className="adm-preview__card" style={{ backgroundColor: theme.cardBackColor }}>
            {logoUrl && <img src={logoUrl} alt="" />}
          </span>
          <span className="adm-preview__card" style={{ backgroundColor: theme.cardFaceBgColor }}>
            {sampleImage ? <img src={sampleImage} alt="" /> : <span className="adm-preview__placeholder">?</span>}
          </span>
          <span className="adm-preview__card" style={{ backgroundColor: theme.cardBackColor }}>
            {logoUrl && <img src={logoUrl} alt="" />}
          </span>
        </div>
      </div>
      <figcaption className="adm-muted">Vista previa</figcaption>
    </figure>
  );
};

export default ThemePreview;
