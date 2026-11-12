import { describe, expect, it } from 'vitest';
import { isAcceptedImage, resolveImageType } from './imageProcessing';

const file = (name: string, type: string) => new File([new Uint8Array(4)], name, { type });

describe('isAcceptedImage', () => {
  it('accepts by MIME type', () => {
    expect(isAcceptedImage(file('a.png', 'image/png'))).toBe(true);
    expect(isAcceptedImage(file('a.pdf', 'application/pdf'))).toBe(false);
  });

  it('falls back to the extension when the browser reports no MIME type', () => {
    expect(isAcceptedImage(file('photo.JPG', ''))).toBe(true);
    expect(isAcceptedImage(file('icon.avif', ''))).toBe(true);
    expect(isAcceptedImage(file('vector.svg', ''))).toBe(true);
  });

  it('rejects formats the pipeline cannot render in all browsers (HEIC)', () => {
    expect(isAcceptedImage(file('IMG_0001.HEIC', ''))).toBe(false);
    expect(isAcceptedImage(file('IMG_0001.heic', 'image/heic'))).toBe(false);
    expect(isAcceptedImage(file('noext', ''))).toBe(false);
  });
});

describe('resolveImageType', () => {
  it('normalizes the content type from the extension', () => {
    expect(resolveImageType(file('a.jpeg', ''))).toBe('image/jpeg');
    expect(resolveImageType(file('a.webp', 'image/webp'))).toBe('image/webp');
    expect(resolveImageType(file('a.heic', ''))).toBeNull();
  });
});
