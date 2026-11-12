import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  remoteItems,
  revokeLocalPreviews,
  toCardSources,
  type CardItem,
} from '../../utils/cardItems';
import {
  TITLE_MAX_LENGTH,
  formToTheme,
  themeToForm,
  validateGameForm,
  type GameFormField,
  type ThemeForm,
} from '../../utils/gameForm';
import {
  DEFAULT_LOGO,
  MOVES_PER_PAIR,
  getMaxMovesForPairs,
  slugify,
  type GameRegistryEntry,
  type GameThemeOverride,
} from '../../utils/gameUtils';
import type { ProgressFn, ProgressPhase, RemoteGameInput } from '../../utils/gamesRemote';
import { ACCEPT_ATTRIBUTE, MAX_SOURCE_BYTES, formatBytes, isAcceptedImage } from '../../utils/imageProcessing';
import CardImagesEditor from './CardImagesEditor';
import ThemePreview from './ThemePreview';

export interface GameFormInitial {
  id: string;
  title: string;
  logoUrl?: string;
  cards: string[];
  theme?: GameThemeOverride;
  maxMoves?: number | null;
}

interface GameFormProps {
  mode: 'create' | 'edit';
  initial: GameFormInitial;
  existingIds?: ReadonlySet<string>;
  submitLabel: string;
  onSubmit: (input: RemoteGameInput, onProgress: ProgressFn) => Promise<GameRegistryEntry>;
  onSaved: (entry: GameRegistryEntry) => void;
  /** Extra content rendered in the sticky action bar (e.g. delete). */
  secondaryAction?: React.ReactNode;
  /** Reports unsaved changes to the parent (for navigation guards). */
  onDirtyChange?: (dirty: boolean) => void;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; progress: ProgressPhase | null }
  | { kind: 'error'; message: string };

const FIELD_ORDER: GameFormField[] = ['title', 'id', 'cards', 'maxMoves'];

const describeProgress = (p: ProgressPhase | null): { label: string; percent: number | null } => {
  if (!p) return { label: 'Preparando…', percent: null };
  switch (p.phase) {
    case 'preparing':
      return { label: `Optimizando imágenes ${p.done}/${p.total}…`, percent: null };
    case 'uploading':
      return { label: `Subiendo imágenes ${p.done}/${p.total} · ${p.percent}%`, percent: p.percent };
    case 'saving':
      return { label: 'Guardando configuración…', percent: 100 };
    case 'done':
      return { label: 'Listo', percent: 100 };
  }
};

const firebaseErrorMessage = (err: unknown): string => {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'storage/unauthorized' || code === 'permission-denied')
    return 'No tienes permiso para guardar. Verifica que tu cuenta sea administradora y las reglas de Firebase.';
  if (code === 'storage/quota-exceeded') return 'Se superó la cuota de Firebase Storage.';
  if (code === 'storage/retry-limit-exceeded' || code === 'unavailable')
    return 'Problema de conexión. Revisa tu internet e inténtalo de nuevo.';
  const msg = err instanceof Error ? err.message : 'Error desconocido.';
  return code ? `${msg} [${code}]` : msg;
};

const GameForm: React.FC<GameFormProps> = ({
  mode,
  initial,
  existingIds = new Set<string>(),
  submitLabel,
  onSubmit,
  onSaved,
  secondaryAction,
  onDirtyChange,
}) => {
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const [title, setTitle] = useState(initial.title);
  const [id, setId] = useState(initial.id);
  const [idEdited, setIdEdited] = useState(mode === 'edit');
  const [items, setItems] = useState<CardItem[]>(() => remoteItems(initial.cards));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  /** Edit mode: revert to the default logo on save. */
  const [resetLogo, setResetLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeForm>(() => themeToForm(initial.theme));
  const [maxMovesMode, setMaxMovesMode] = useState<'auto' | 'custom'>(initial.maxMoves ? 'custom' : 'auto');
  const [maxMoves, setMaxMoves] = useState(initial.maxMoves ? String(initial.maxMoves) : '');
  const [touched, setTouched] = useState<Partial<Record<GameFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  const saving = save.kind === 'saving';

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  // Revoke any remaining blob previews when the form unmounts.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => revokeLocalPreviews(itemsRef.current), []);

  const { errors, warnings } = validateGameForm(
    { id, title, cardCount: items.length, theme, maxMovesMode, maxMoves },
    { mode, existingIds }
  );
  const visibleError = (f: GameFormField) => (submitted || touched[f] ? errors[f] : undefined);
  const errorCount = Object.keys(errors).length;

  const dirty = useMemo(() => {
    const initialTheme = themeToForm(initial.theme);
    return (
      title !== initial.title ||
      (mode === 'create' && id !== initial.id) ||
      logoFile !== null ||
      resetLogo ||
      items.length !== initial.cards.length ||
      items.some((it, i) => it.kind === 'local' || it.url !== initial.cards[i]) ||
      (Object.keys(theme) as (keyof ThemeForm)[]).some((k) => theme[k] !== initialTheme[k]) ||
      (maxMovesMode === 'custom' ? maxMoves : '') !== (initial.maxMoves ? String(initial.maxMoves) : '')
    );
  }, [title, id, logoFile, resetLogo, items, theme, maxMovesMode, maxMoves, initial, mode]);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Warn before closing the tab with unsaved work (or mid-upload).
  useEffect(() => {
    if (!dirty && !saving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saving]);

  const touch = (f: GameFormField) => setTouched((t) => (t[f] ? t : { ...t, [f]: true }));
  const setThemeField = <K extends keyof ThemeForm>(k: K, v: ThemeForm[K]) =>
    setTheme((prev) => ({ ...prev, [k]: v }));

  const handleTitle = (value: string) => {
    setTitle(value);
    if (mode === 'create' && !idEdited) setId(slugify(value));
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!isAcceptedImage(file)) {
      setLogoError('Formato no soportado.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setLogoError(`El archivo supera ${formatBytes(MAX_SOURCE_BYTES)}.`);
      return;
    }
    setLogoError(null);
    setLogoFile(file);
    setResetLogo(false);
  };

  const autoMoves = getMaxMovesForPairs(items.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (errorCount > 0) {
      const first = FIELD_ORDER.find((f) => errors[f]);
      if (first) {
        const el = document.getElementById(fieldId(first));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
      }
      return;
    }

    setSave({ kind: 'saving', progress: null });
    try {
      const entry = await onSubmit(
        {
          id: mode === 'create' ? id.trim() : initial.id,
          title: title.trim(),
          theme: formToTheme(theme, initial.theme),
          logoFile,
          resetLogo: !logoFile && resetLogo,
          cards: toCardSources(items),
          maxMoves: maxMovesMode === 'custom' ? Number(maxMoves) : null,
        },
        (progress) => setSave({ kind: 'saving', progress })
      );
      setSave({ kind: 'idle' });
      onSaved(entry);
    } catch (err) {
      console.error('[admin] guardar juego falló', err);
      setSave({ kind: 'error', message: firebaseErrorMessage(err) });
    }
  };

  const progress = save.kind === 'saving' ? describeProgress(save.progress) : null;
  const currentLogo = logoPreview ?? (resetLogo ? DEFAULT_LOGO : initial.logoUrl);
  const hasCustomSavedLogo = !!initial.logoUrl && initial.logoUrl !== DEFAULT_LOGO;

  return (
    <form className="adm-form" onSubmit={handleSubmit} noValidate aria-busy={saving}>
      <fieldset className="adm-form__fields" disabled={saving}>
        {/* 1. Datos básicos */}
        <section className="adm-section" aria-labelledby={fieldId('s1')}>
          <header className="adm-section__head">
            <span className="adm-step" aria-hidden="true">1</span>
            <div>
              <h2 id={fieldId('s1')} className="adm-section__title">Datos básicos</h2>
              <p className="adm-section__desc">Nombre visible del juego y su dirección.</p>
            </div>
          </header>

          <div className="adm-grid-2">
            <div className="adm-field">
              <label htmlFor={fieldId('title')} className="adm-label">Título</label>
              <input
                id={fieldId('title')}
                className="adm-input"
                value={title}
                maxLength={TITLE_MAX_LENGTH + 20}
                onChange={(e) => handleTitle(e.target.value)}
                onBlur={() => touch('title')}
                placeholder="Ej. Memoria Navideña"
                aria-invalid={!!visibleError('title')}
                aria-describedby={visibleError('title') ? fieldId('title-err') : undefined}
                autoComplete="off"
              />
              {visibleError('title') && (
                <p className="adm-field__error" id={fieldId('title-err')}>{visibleError('title')}</p>
              )}
            </div>

            <div className="adm-field">
              <label htmlFor={fieldId('id')} className="adm-label">Identificador (URL)</label>
              {mode === 'create' ? (
                <>
                  <div className="adm-input-group">
                    <span className="adm-input-group__prefix" aria-hidden="true">/g/</span>
                    <input
                      id={fieldId('id')}
                      className="adm-input"
                      value={id}
                      onChange={(e) => {
                        setIdEdited(true);
                        setId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                      onBlur={() => touch('id')}
                      placeholder="memoria-navidena"
                      aria-invalid={!!visibleError('id')}
                      aria-describedby={`${fieldId('id-hint')}${visibleError('id') ? ` ${fieldId('id-err')}` : ''}`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="adm-field__hint" id={fieldId('id-hint')}>
                    Minúsculas, números y guiones. Se genera a partir del título.
                  </p>
                  {visibleError('id') && (
                    <p className="adm-field__error" id={fieldId('id-err')}>{visibleError('id')}</p>
                  )}
                </>
              ) : (
                <p className="adm-readonly" id={fieldId('id')}>
                  /g/{initial.id}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 2. Cartas */}
        <section className="adm-section" aria-labelledby={fieldId('s2')}>
          <header className="adm-section__head">
            <span className="adm-step" aria-hidden="true">2</span>
            <div>
              <h2 id={fieldId('s2')} className="adm-section__title">Imágenes de las cartas</h2>
              <p className="adm-section__desc">
                Cada imagen aparece dos veces en el tablero. Arrastra para reordenar. Las fotos grandes se optimizan
                automáticamente al guardar.
              </p>
            </div>
          </header>
          <CardImagesEditor
            inputId={fieldId('cards')}
            items={items}
            onChange={(next) => {
              setItems(next);
              touch('cards');
            }}
            disabled={saving}
            error={visibleError('cards')}
            warning={warnings.cards}
          />
        </section>

        {/* 3. Apariencia */}
        <section className="adm-section" aria-labelledby={fieldId('s3')}>
          <header className="adm-section__head">
            <span className="adm-step" aria-hidden="true">3</span>
            <div>
              <h2 id={fieldId('s3')} className="adm-section__title">Apariencia</h2>
              <p className="adm-section__desc">Logo y colores. La vista previa se actualiza al instante.</p>
            </div>
          </header>

          <div className="adm-appearance">
            <div className="adm-appearance__controls">
              <div className="adm-field">
                <span className="adm-label" id={fieldId('logo-label')}>Logo (también se usa en el reverso de las cartas)</span>
                <div className="adm-logo">
                  <div className="adm-logo__preview">
                    {currentLogo ? <img src={currentLogo} alt="Logo actual" /> : <span className="adm-muted">Sin logo</span>}
                  </div>
                  <div className="adm-logo__actions">
                    <label htmlFor={fieldId('logo')} className="adm-btn adm-btn--sm">
                      {currentLogo ? 'Cambiar logo' : 'Subir logo'}
                    </label>
                    <input
                      id={fieldId('logo')}
                      className="adm-visually-hidden"
                      type="file"
                      accept={ACCEPT_ATTRIBUTE}
                      onChange={handleLogo}
                      aria-labelledby={fieldId('logo-label')}
                    />
                    {logoFile && (
                      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setLogoFile(null)}>
                        Descartar cambio
                      </button>
                    )}
                    {mode === 'edit' && hasCustomSavedLogo && !logoFile && (
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost adm-btn--sm"
                        aria-pressed={resetLogo}
                        onClick={() => setResetLogo((v) => !v)}
                      >
                        {resetLogo ? 'Mantener logo actual' : 'Usar logo predeterminado'}
                      </button>
                    )}
                  </div>
                </div>
                {logoError && <p className="adm-field__error">{logoError}</p>}
              </div>

              <div className="adm-field">
                <span className="adm-label" id={fieldId('bg-label')}>Fondo</span>
                <div className="adm-segmented" role="radiogroup" aria-labelledby={fieldId('bg-label')}>
                  {(['solid', 'gradient'] as const).map((t) => (
                    <label key={t} className={`adm-segmented__opt${theme.bgType === t ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name={fieldId('bgType')}
                        value={t}
                        checked={theme.bgType === t}
                        onChange={() => setThemeField('bgType', t)}
                      />
                      {t === 'solid' ? 'Sólido' : 'Degradado'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="adm-colors">
                {theme.bgType === 'solid' ? (
                  <ColorField id={fieldId('bg')} label="Color de fondo" value={theme.bgColor} onChange={(v) => setThemeField('bgColor', v)} />
                ) : (
                  <>
                    <ColorField id={fieldId('g1')} label="Degradado inicio" value={theme.gradStart} onChange={(v) => setThemeField('gradStart', v)} />
                    <ColorField id={fieldId('g2')} label="Degradado fin" value={theme.gradEnd} onChange={(v) => setThemeField('gradEnd', v)} />
                  </>
                )}
                <ColorField id={fieldId('tx')} label="Texto" value={theme.textColor} onChange={(v) => setThemeField('textColor', v)} />
                <ColorField id={fieldId('cb')} label="Reverso de carta" value={theme.cardBackColor} onChange={(v) => setThemeField('cardBackColor', v)} />
                <ColorField id={fieldId('cf')} label="Frente de carta" value={theme.cardFaceBgColor} onChange={(v) => setThemeField('cardFaceBgColor', v)} />
              </div>
            </div>

            <ThemePreview
              theme={theme}
              logoUrl={currentLogo}
              sampleImage={items[0] ? (items[0].kind === 'remote' ? items[0].url : items[0].previewUrl) : undefined}
              title={title}
            />
          </div>
        </section>

        {/* 4. Reglas */}
        <section className="adm-section" aria-labelledby={fieldId('s4')}>
          <header className="adm-section__head">
            <span className="adm-step" aria-hidden="true">4</span>
            <div>
              <h2 id={fieldId('s4')} className="adm-section__title">Reglas</h2>
              <p className="adm-section__desc">Cantidad máxima de movimientos (un movimiento = voltear dos cartas).</p>
            </div>
          </header>

          <div className="adm-choice" role="radiogroup" aria-label="Límite de movimientos">
            <label className={`adm-choice__opt${maxMovesMode === 'auto' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name={fieldId('mm')}
                checked={maxMovesMode === 'auto'}
                onChange={() => setMaxMovesMode('auto')}
              />
              <span>
                <strong>Automático</strong>
                <span className="adm-muted">
                  {items.length > 0
                    ? `${autoMoves} movimientos (${MOVES_PER_PAIR} por pareja)`
                    : `${MOVES_PER_PAIR} movimientos por pareja`}
                </span>
              </span>
            </label>
            <label className={`adm-choice__opt${maxMovesMode === 'custom' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name={fieldId('mm')}
                checked={maxMovesMode === 'custom'}
                onChange={() => {
                  setMaxMovesMode('custom');
                  if (!maxMoves) setMaxMoves(String(autoMoves || ''));
                }}
              />
              <span>
                <strong>Personalizado</strong>
                <span className="adm-muted">Define un límite fijo</span>
              </span>
            </label>
          </div>
          {maxMovesMode === 'custom' && (
            <div className="adm-field adm-field--inline">
              <label htmlFor={fieldId('maxMoves')} className="adm-label">Movimientos máximos</label>
              <input
                id={fieldId('maxMoves')}
                className="adm-input adm-input--narrow"
                type="number"
                inputMode="numeric"
                min={Math.max(1, items.length)}
                step={1}
                value={maxMoves}
                onChange={(e) => setMaxMoves(e.target.value)}
                onBlur={() => touch('maxMoves')}
                aria-invalid={!!visibleError('maxMoves')}
                aria-describedby={visibleError('maxMoves') ? fieldId('mm-err') : undefined}
              />
              {visibleError('maxMoves') && (
                <p className="adm-field__error" id={fieldId('mm-err')}>{visibleError('maxMoves')}</p>
              )}
            </div>
          )}
        </section>
      </fieldset>

      {/* Sticky action bar */}
      <div className="adm-savebar">
        <div className="adm-savebar__status" aria-live="polite">
          {progress ? (
            <div className="adm-progress">
              <span className="adm-progress__label">{progress.label}</span>
              <span
                className={`adm-progress__track${progress.percent === null ? ' is-indeterminate' : ''}`}
                role="progressbar"
                aria-label="Progreso de guardado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent ?? undefined}
              >
                <span className="adm-progress__fill" style={{ width: `${progress.percent ?? 30}%` }} />
              </span>
            </div>
          ) : save.kind === 'error' ? (
            <span className="adm-text-error" role="alert">{save.message}</span>
          ) : submitted && errorCount > 0 ? (
            <span className="adm-text-error">
              {errorCount === 1 ? 'Hay 1 campo por corregir.' : `Hay ${errorCount} campos por corregir.`}
            </span>
          ) : dirty ? (
            <span className="adm-muted">Cambios sin guardar</span>
          ) : (
            <span className="adm-muted">
              {items.length} {items.length === 1 ? 'pareja' : 'parejas'} · {items.length * 2} cartas
            </span>
          )}
        </div>
        <div className="adm-savebar__actions">
          {secondaryAction}
          <button
            type="submit"
            className="adm-btn adm-btn--primary"
            disabled={saving || (mode === 'edit' && !dirty)}
          >
            {saving ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
};

const ColorField: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void }> = ({
  id,
  label,
  value,
  onChange,
}) => (
  <div className="adm-color">
    <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    <label htmlFor={id}>
      <span className="adm-color__label">{label}</span>
      <span className="adm-color__value">{value.toUpperCase()}</span>
    </label>
  </div>
);

export default GameForm;
