import React, { useId, useRef, useState } from 'react';
import {
  itemSrc,
  nextItemKey,
  screenFiles,
  type CardItem,
  type RejectedFile,
} from '../../utils/cardItems';
import { moveItem } from '../../utils/gameUtils';
import { ACCEPT_ATTRIBUTE } from '../../utils/imageProcessing';

interface CardImagesEditorProps {
  items: CardItem[];
  onChange: (items: CardItem[]) => void;
  disabled?: boolean;
  error?: string;
  warning?: string;
  /** id used by the parent to focus/scroll to this field on validation errors. */
  inputId?: string;
}

const CardImagesEditor: React.FC<CardImagesEditorProps> = ({
  items,
  onChange,
  disabled = false,
  error,
  warning,
  inputId,
}) => {
  const fallbackId = useId();
  const fileInputId = inputId ?? fallbackId;
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const addFiles = (files: File[]) => {
    if (disabled || files.length === 0) return;
    const { accepted, rejected: rej } = screenFiles(items, files);
    setRejected(rej);
    if (accepted.length > 0) {
      const added: CardItem[] = accepted.map((file) => ({
        key: nextItemKey(),
        kind: 'local',
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      onChange([...items, ...added]);
      setAnnouncement(
        `${accepted.length} ${accepted.length === 1 ? 'imagen agregada' : 'imágenes agregadas'}. Total: ${items.length + accepted.length}.`
      );
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    // Reset so picking the same file(s) again still fires `change` (Chrome skips identical selections).
    e.target.value = '';
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (dragKey) return; // internal reorder drag, not a file drop
    addFiles(Array.from(e.dataTransfer.files));
  };

  const remove = (index: number) => {
    const item = items[index];
    if (item.kind === 'local') URL.revokeObjectURL(item.previewUrl);
    onChange(items.filter((_, i) => i !== index));
    setAnnouncement(`Imagen ${index + 1} quitada. Total: ${items.length - 1}.`);
  };

  const move = (from: number, to: number, focusSelector?: string) => {
    if (to < 0 || to >= items.length) return;
    onChange(moveItem(items, from, to));
    setAnnouncement(`Imagen movida a la posición ${to + 1}.`);
    if (focusSelector) {
      // Keep keyboard focus on the moved item's control after re-render.
      requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>(`[data-key="${items[from].key}"] ${focusSelector}`)?.focus()
      );
    }
  };

  const localCount = items.filter((i) => i.kind === 'local').length;

  return (
    <div className="adm-cards">
      <div
        className={`adm-drop${dragOver ? ' is-over' : ''}${error ? ' is-invalid' : ''}${disabled ? ' is-disabled' : ''}`}
        onDragOver={(e) => {
          if (dragKey || disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropFiles}
      >
        <svg className="adm-drop__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="adm-drop__title">Arrastra imágenes aquí</p>
        <p className="adm-drop__sub" id={hintId}>
          PNG, JPG, WebP, GIF, SVG o AVIF. Puedes agregar todas las que quieras; cada imagen forma una pareja.
        </p>
        <label htmlFor={fileInputId} className="adm-btn adm-btn--primary adm-btn--sm">
          Elegir imágenes
        </label>
        <input
          ref={inputRef}
          id={fileInputId}
          className="adm-visually-hidden"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          disabled={disabled}
          onChange={handleInput}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={!!error}
        />
      </div>

      <div className="adm-cards__summary">
        <span>
          <strong>{items.length}</strong> {items.length === 1 ? 'imagen' : 'imágenes'} ·{' '}
          <strong>{items.length}</strong> {items.length === 1 ? 'pareja' : 'parejas'} ·{' '}
          <strong>{items.length * 2}</strong> cartas
        </span>
        {localCount > 0 && <span className="adm-chip adm-chip--new">{localCount} sin subir</span>}
      </div>

      {error && (
        <p className="adm-field__error" id={errorId}>
          {error}
        </p>
      )}
      {!error && warning && <p className="adm-field__warning">{warning}</p>}

      {rejected.length > 0 && (
        <div className="adm-alert adm-alert--warning" role="alert">
          <div>
            <strong>
              {rejected.length === 1 ? 'Se omitió 1 archivo:' : `Se omitieron ${rejected.length} archivos:`}
            </strong>
            <ul>
              {rejected.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  {r.name} — {r.reason}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="adm-icon-btn" aria-label="Cerrar aviso" onClick={() => setRejected([])}>
            ×
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="adm-empty">Todavía no hay imágenes. Agrega al menos 2 para poder jugar.</p>
      ) : (
        <ol className="adm-thumbs" aria-label="Imágenes de cartas (en orden)">
          {items.map((item, index) => (
            <li
              key={item.key}
              data-key={item.key}
              className={`adm-thumb${dragKey === item.key ? ' is-dragging' : ''}`}
              draggable={!disabled}
              onDragStart={(e) => {
                setDragKey(item.key);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.key);
              }}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => {
                if (!dragKey) return;
                e.preventDefault();
                const from = items.findIndex((i) => i.key === dragKey);
                if (from !== -1 && from !== index) onChange(moveItem(items, from, index));
              }}
              onDrop={(e) => {
                if (dragKey) {
                  e.preventDefault();
                  setDragKey(null);
                }
              }}
            >
              <div className="adm-thumb__media">
                <img src={itemSrc(item)} alt={`Imagen ${index + 1}`} loading="lazy" draggable={false} />
                <span className="adm-thumb__badge">{index + 1}</span>
                {item.kind === 'local' && <span className="adm-chip adm-chip--new adm-thumb__new">Nueva</span>}
              </div>
              <div className="adm-thumb__actions">
                <button
                  type="button"
                  className="adm-icon-btn"
                  data-action="prev"
                  onClick={() => move(index, index - 1, '[data-action="prev"]')}
                  disabled={disabled || index === 0}
                  aria-label={`Mover imagen ${index + 1} antes`}
                  title="Mover antes"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  data-action="next"
                  onClick={() => move(index, index + 1, '[data-action="next"]')}
                  disabled={disabled || index === items.length - 1}
                  aria-label={`Mover imagen ${index + 1} después`}
                  title="Mover después"
                >
                  →
                </button>
                <button
                  type="button"
                  className="adm-icon-btn adm-icon-btn--danger"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label={`Quitar imagen ${index + 1}`}
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="adm-visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
};

export default CardImagesEditor;
