import { SLUG_PATTERN, type GameThemeOverride } from './gameUtils';

/** Above this many pairs the board gets very long on phones; warn but allow it. */
export const LARGE_DECK_WARNING_PAIRS = 30;
export const TITLE_MAX_LENGTH = 60;

export interface ThemeForm {
  bgType: 'solid' | 'gradient';
  bgColor: string;
  gradStart: string;
  gradEnd: string;
  textColor: string;
  cardBackColor: string;
  cardFaceBgColor: string;
}

export const defaultThemeForm: ThemeForm = {
  bgType: 'solid',
  bgColor: '#ffffff',
  gradStart: '#667eea',
  gradEnd: '#764ba2',
  textColor: '#1a1a1a',
  cardBackColor: '#4a90e2',
  cardFaceBgColor: '#ffffff',
};

export const themeToForm = (t?: GameThemeOverride): ThemeForm => ({
  bgType: t?.layout?.backgroundType === 'gradient' ? 'gradient' : 'solid',
  bgColor: t?.layout?.backgroundColor || defaultThemeForm.bgColor,
  gradStart: t?.layout?.gradientStart || defaultThemeForm.gradStart,
  gradEnd: t?.layout?.gradientEnd || defaultThemeForm.gradEnd,
  textColor: t?.appTextColor || defaultThemeForm.textColor,
  cardBackColor: t?.cardBackColor || defaultThemeForm.cardBackColor,
  cardFaceBgColor: t?.cardFaceBgColor || defaultThemeForm.cardFaceBgColor,
});

export const themeFormsEqual = (a: ThemeForm, b: ThemeForm): boolean =>
  (Object.keys(a) as (keyof ThemeForm)[]).every((k) => a[k] === b[k]);

/**
 * Applies the edited theme fields on top of `base`, writing ONLY what actually changed.
 * - Nothing changed → returns `base` as-is (including `undefined`), so a game without a theme
 *   keeps inheriting the app defaults instead of having admin defaults baked in.
 * - Fields the form does not expose (buttons, modal, board backgrounds…) are always preserved.
 * - `modalTextColor` is only overwritten when the text color itself was changed.
 */
export const formToTheme = (f: ThemeForm, base?: GameThemeOverride): GameThemeOverride | undefined => {
  const prev = themeToForm(base);
  if (themeFormsEqual(f, prev)) return base;

  const next: GameThemeOverride = { ...base };

  const layoutChanged =
    f.bgType !== prev.bgType ||
    (f.bgType === 'solid' ? f.bgColor !== prev.bgColor : f.gradStart !== prev.gradStart || f.gradEnd !== prev.gradEnd);
  if (layoutChanged) {
    next.layout =
      f.bgType === 'gradient'
        ? {
            backgroundType: 'gradient',
            gradientStart: f.gradStart,
            gradientEnd: f.gradEnd,
            gradientDirection: base?.layout?.gradientDirection || '135deg',
          }
        : { backgroundType: 'solid', backgroundColor: f.bgColor };
  }

  if (f.textColor !== prev.textColor) {
    next.appTextColor = f.textColor;
    next.modalTextColor = f.textColor;
  }
  if (f.cardBackColor !== prev.cardBackColor) next.cardBackColor = f.cardBackColor;
  if (f.cardFaceBgColor !== prev.cardFaceBgColor) next.cardFaceBgColor = f.cardFaceBgColor;

  return next;
};

export interface GameFormValues {
  id: string;
  title: string;
  /** Number of images (each one becomes a pair). */
  cardCount: number;
  theme: ThemeForm;
  maxMovesMode: 'auto' | 'custom';
  maxMoves: string;
}

export type GameFormField = 'id' | 'title' | 'cards' | 'maxMoves';

export interface GameFormValidation {
  errors: Partial<Record<GameFormField, string>>;
  warnings: Partial<Record<GameFormField, string>>;
}

export const validateGameForm = (
  v: GameFormValues,
  ctx: { mode: 'create' | 'edit'; existingIds: ReadonlySet<string> }
): GameFormValidation => {
  const errors: GameFormValidation['errors'] = {};
  const warnings: GameFormValidation['warnings'] = {};

  if (ctx.mode === 'create') {
    const id = v.id.trim();
    if (!id) errors.id = 'El identificador es obligatorio.';
    else if (!SLUG_PATTERN.test(id))
      errors.id = 'Usa solo minúsculas, números y guiones (máx. 41 caracteres, sin guion inicial).';
    else if (ctx.existingIds.has(id)) errors.id = `Ya existe un juego con el identificador "${id}".`;
  }

  const title = v.title.trim();
  if (!title) errors.title = 'El título es obligatorio.';
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Máximo ${TITLE_MAX_LENGTH} caracteres.`;

  if (v.cardCount < 2) {
    errors.cards = 'Agrega al menos 2 imágenes. Cada imagen forma una pareja.';
  } else if (v.cardCount > LARGE_DECK_WARNING_PAIRS) {
    warnings.cards = `Con ${v.cardCount} parejas (${v.cardCount * 2} cartas) el tablero será largo en móviles.`;
  }

  if (v.maxMovesMode === 'custom') {
    const raw = v.maxMoves.trim();
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n <= 0) {
      errors.maxMoves = 'Ingresa un número entero mayor que 0.';
    } else if (n < v.cardCount) {
      errors.maxMoves = `Debe ser al menos ${v.cardCount} (una jugada por pareja) o el juego no se podría ganar.`;
    }
  }

  return { errors, warnings };
};
