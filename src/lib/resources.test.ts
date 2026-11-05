import { describe, it, expect } from 'vitest';
import {
  MAX_RESOURCE_BYTES,
  MAX_RESOURCES_PER_BROADCAST,
  formatBytes,
  isValidResourceSlug,
  makeResourceSlug,
  mimeTypeForFilename,
  resourceUrl,
  validateResourceFile,
} from './resources';

// Deterministic randomness for slug tests: always picks 'a'..'h'
const fixedRandom = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);

describe('makeResourceSlug', () => {
  it('prefixes 8 random characters and keeps a cleaned name + extension', () => {
    expect(makeResourceSlug('Q3 Report.pptx', fixedRandom)).toBe('abcdefgh-q3-report.pptx');
  });

  it('produces valid slugs for awkward filenames', () => {
    const cases: [string, string][] = [
      ['Café Programme (final) v2.PDF', 'abcdefgh-cafe-programme-final-v2.pdf'],
      ['  --weird__name--.docx', 'abcdefgh-weird-name.docx'],
      ['archive.tar.xlsx', 'abcdefgh-archive-tar.xlsx'],
      ['🙂🙂.png', 'abcdefgh-file.png'],
      ['.jpg', 'abcdefgh-file.jpg'],
    ];
    for (const [input, expected] of cases) {
      const slug = makeResourceSlug(input, fixedRandom);
      expect(slug).toBe(expected);
      expect(isValidResourceSlug(slug)).toBe(true);
    }
  });

  it('caps very long names', () => {
    const slug = makeResourceSlug(`${'a'.repeat(300)}.pdf`, fixedRandom);
    expect(slug.length).toBeLessThanOrEqual(8 + 1 + 60 + 4);
    expect(isValidResourceSlug(slug)).toBe(true);
  });

  it('uses real randomness by default, so two uploads of the same file differ', () => {
    const a = makeResourceSlug('doc.pdf');
    const b = makeResourceSlug('doc.pdf');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]{8}-doc\.pdf$/);
  });
});

describe('isValidResourceSlug', () => {
  it('rejects anything that could escape the bucket or is malformed', () => {
    for (const bad of ['', 'doc.pdf', 'abcdefgh-doc', '../abcdefgh-doc.pdf', 'abcdefgh-doc.pdf/x',
      'ABCDEFGH-doc.pdf', 'abcdefgh-doc.pdf?x=1', 'abcdefgh-do c.pdf', 'abcdefgh-doc.exe']) {
      expect(isValidResourceSlug(bad), bad).toBe(false);
    }
  });
});

describe('validateResourceFile', () => {
  const ok = { name: 'deck.pptx', size: 1024 };

  it('accepts allowed types within the size limit', () => {
    for (const name of ['a.pdf', 'a.ppt', 'a.pptx', 'a.doc', 'a.docx', 'a.xls', 'a.xlsx', 'a.png', 'a.jpg', 'a.JPEG']) {
      expect(validateResourceFile({ name, size: 10 }), name).toBeNull();
    }
    expect(validateResourceFile({ ...ok, size: MAX_RESOURCE_BYTES })).toBeNull();
  });

  it('rejects disallowed types (by extension — browsers often send no MIME for Office files)', () => {
    for (const name of ['a.exe', 'a.zip', 'a.html', 'a.svg', 'a.js', 'noextension']) {
      expect(validateResourceFile({ name, size: 10 }), name).toMatch(/not allowed/i);
    }
  });

  it('rejects empty and oversized files', () => {
    expect(validateResourceFile({ ...ok, size: 0 })).toMatch(/empty/i);
    expect(validateResourceFile({ ...ok, size: MAX_RESOURCE_BYTES + 1 })).toMatch(/25 MB/);
  });
});

describe('mimeTypeForFilename', () => {
  it('maps extensions to the MIME types the bucket allows', () => {
    expect(mimeTypeForFilename('x.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(mimeTypeForFilename('x.JPG')).toBe('image/jpeg');
    expect(mimeTypeForFilename('x.exe')).toBeNull();
  });
});

describe('resourceUrl / formatBytes / limits', () => {
  it('builds the public link on the site domain', () => {
    // Trailing slash: Render's static host 404s paths ending in known file
    // extensions (.pdf, .png, .jpg, .doc…) instead of rewriting them to the app.
    expect(resourceUrl('abcdefgh-doc.pdf', 'https://nawe.co.ke')).toBe('https://nawe.co.ke/resource/abcdefgh-doc.pdf/');
    expect(resourceUrl('abcdefgh-doc.pdf', 'https://nawe.co.ke/')).toBe('https://nawe.co.ke/resource/abcdefgh-doc.pdf/');
  });

  it('formats sizes for display', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('has the agreed limits', () => {
    expect(MAX_RESOURCE_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_RESOURCES_PER_BROADCAST).toBe(5);
  });
});
