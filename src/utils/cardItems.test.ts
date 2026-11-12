import { describe, expect, it } from 'vitest';
import { screenFiles, toCardSources, type CardItem } from './cardItems';

const file = (name: string, type = 'image/png', size = 10, lastModified = 1) =>
  new File([new Uint8Array(size)], name, { type, lastModified });

describe('screenFiles', () => {
  it('accepts any number of valid images (no 4-image cap)', () => {
    const files = Array.from({ length: 12 }, (_, i) => file(`${i}.png`));
    const { accepted, rejected } = screenFiles([], files);
    expect(accepted).toHaveLength(12);
    expect(rejected).toEqual([]);
  });

  it('appends to an existing selection instead of replacing it', () => {
    const existing: CardItem[] = [
      { key: 'k1', kind: 'remote', url: 'https://x/1.png' },
      { key: 'k2', kind: 'local', file: file('a.png'), previewUrl: 'blob:a' },
    ];
    const { accepted } = screenFiles(existing, [file('b.png'), file('c.png')]);
    expect(accepted.map((f) => f.name)).toEqual(['b.png', 'c.png']);
  });

  it('rejects duplicates, unsupported types and oversized files with a reason', () => {
    const a = file('a.png');
    const existing: CardItem[] = [{ key: 'k', kind: 'local', file: a, previewUrl: 'blob:a' }];
    const { accepted, rejected } = screenFiles(existing, [
      file('a.png'),
      file('doc.pdf', 'application/pdf'),
      file('huge.jpg', 'image/jpeg', 21 * 1024 * 1024),
      file('ok.webp', 'image/webp'),
      file('ok.webp', 'image/webp'),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['ok.webp']);
    expect(rejected.map((r) => r.name)).toEqual(['a.png', 'doc.pdf', 'huge.jpg', 'ok.webp']);
  });
});

describe('toCardSources', () => {
  it('keeps the visual order of mixed remote and local items', () => {
    const f = file('n.png');
    const items: CardItem[] = [
      { key: '1', kind: 'local', file: f, previewUrl: 'blob:n' },
      { key: '2', kind: 'remote', url: 'u1' },
    ];
    expect(toCardSources(items)).toEqual([
      { kind: 'local', file: f },
      { kind: 'remote', url: 'u1' },
    ]);
  });
});
