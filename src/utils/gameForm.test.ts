import { describe, expect, it } from 'vitest';
import {
  defaultThemeForm,
  formToTheme,
  themeToForm,
  validateGameForm,
  type GameFormValues,
} from './gameForm';

const values = (over: Partial<GameFormValues> = {}): GameFormValues => ({
  id: 'mi-juego',
  title: 'Mi juego',
  cardCount: 4,
  theme: defaultThemeForm,
  maxMovesMode: 'auto',
  maxMoves: '',
  ...over,
});

describe('validateGameForm', () => {
  it('accepts a valid create form', () => {
    expect(validateGameForm(values(), { mode: 'create', existingIds: new Set() }).errors).toEqual({});
  });

  it('has no upper limit on the number of images', () => {
    const r = validateGameForm(values({ cardCount: 60 }), { mode: 'create', existingIds: new Set() });
    expect(r.errors.cards).toBeUndefined();
    expect(r.warnings.cards).toBeTruthy();
  });

  it('requires at least 2 images', () => {
    const r = validateGameForm(values({ cardCount: 1 }), { mode: 'edit', existingIds: new Set() });
    expect(r.errors.cards).toBeTruthy();
  });

  it('requires a title', () => {
    const r = validateGameForm(values({ title: '   ' }), { mode: 'edit', existingIds: new Set() });
    expect(r.errors.title).toBeTruthy();
  });

  it('validates id format and uniqueness only when creating', () => {
    const ctx = { mode: 'create' as const, existingIds: new Set(['ficohsa']) };
    expect(validateGameForm(values({ id: 'Bad Id' }), ctx).errors.id).toBeTruthy();
    expect(validateGameForm(values({ id: '' }), ctx).errors.id).toBeTruthy();
    expect(validateGameForm(values({ id: 'ficohsa' }), ctx).errors.id).toMatch(/existe/);
    expect(
      validateGameForm(values({ id: 'ficohsa' }), { mode: 'edit', existingIds: new Set(['ficohsa']) }).errors.id
    ).toBeUndefined();
  });

  it('requires a custom move limit to be an integer of at least the number of pairs', () => {
    const ctx = { mode: 'edit' as const, existingIds: new Set<string>() };
    expect(validateGameForm(values({ maxMovesMode: 'custom', maxMoves: '3' }), ctx).errors.maxMoves).toBeTruthy();
    expect(validateGameForm(values({ maxMovesMode: 'custom', maxMoves: 'abc' }), ctx).errors.maxMoves).toBeTruthy();
    expect(validateGameForm(values({ maxMovesMode: 'custom', maxMoves: '4.5' }), ctx).errors.maxMoves).toBeTruthy();
    expect(validateGameForm(values({ maxMovesMode: 'custom', maxMoves: '12' }), ctx).errors.maxMoves).toBeUndefined();
  });
});

describe('theme form mapping', () => {
  it('round-trips the editable fields', () => {
    const form = { ...defaultThemeForm, bgType: 'gradient' as const, gradStart: '#111111', textColor: '#eeeeee' };
    expect(themeToForm(formToTheme(form))).toEqual(form);
  });

  it('returns the original theme untouched (even undefined) when no theme field changed', () => {
    expect(formToTheme(themeToForm(undefined), undefined)).toBeUndefined();
    const original = { appTextColor: '#ffffff', modalTextColor: '#000000', cardBackColor: '#C8102E' };
    expect(formToTheme(themeToForm(original), original)).toBe(original);
  });

  it('only writes the fields that changed on a game without a theme', () => {
    const t = formToTheme({ ...themeToForm(undefined), cardBackColor: '#ff0000' }, undefined);
    expect(t).toEqual({ cardBackColor: '#ff0000' });
  });

  it('keeps modalTextColor unless the text color changed', () => {
    const original = { appTextColor: '#ffffff', modalTextColor: '#111111' };
    const sameText = formToTheme({ ...themeToForm(original), cardBackColor: '#00ff00' }, original);
    expect(sameText?.modalTextColor).toBe('#111111');
    const newText = formToTheme({ ...themeToForm(original), textColor: '#222222' }, original);
    expect(newText?.appTextColor).toBe('#222222');
    expect(newText?.modalTextColor).toBe('#222222');
  });

  it('preserves theme fields the form does not edit (buttons, modal, board backgrounds)', () => {
    const original = {
      buttons: { baseStart: '#C8102E' },
      modal: { backgroundType: 'gradient' as const, gradientStart: '#C8102E' },
      controlsBg: 'rgba(255,255,255,0.12)',
      cardBackColor: '#000000',
    };
    const merged = formToTheme({ ...themeToForm(original), cardBackColor: '#ff0000' }, original);
    expect(merged).toBeDefined();
    if (!merged) return;
    expect(merged.buttons).toEqual(original.buttons);
    expect(merged.modal).toEqual(original.modal);
    expect(merged.controlsBg).toBe(original.controlsBg);
    expect(merged.cardBackColor).toBe('#ff0000');
  });
});
