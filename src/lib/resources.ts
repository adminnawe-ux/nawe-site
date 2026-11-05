// Downloadable files attached to admin broadcasts, served at /resource/<slug>.
// Limits and types must match the `resources` storage bucket migration.

export const RESOURCE_BUCKET = 'resources';
export const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_RESOURCES_PER_BROADCAST = 5;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export const RESOURCE_ACCEPT = Object.keys(MIME_BY_EXTENSION).map(e => `.${e}`).join(',');

function splitExtension(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return { base: filename, ext: '' };
  return { base: filename.slice(0, dot), ext: filename.slice(dot + 1).toLowerCase() };
}

// Browsers often report no MIME type for Office files, so type is decided by extension.
export function mimeTypeForFilename(filename: string): string | null {
  return MIME_BY_EXTENSION[splitExtension(filename).ext] ?? null;
}

export function validateResourceFile(file: { name: string; size: number }): string | null {
  if (!mimeTypeForFilename(file.name)) {
    return `${file.name}: file type not allowed. Use PDF, PowerPoint, Word, Excel, PNG or JPG.`;
  }
  if (file.size <= 0) return `${file.name} is empty.`;
  if (file.size > MAX_RESOURCE_BYTES) return `${file.name} is larger than 25 MB.`;
  return null;
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_RE = new RegExp(`^[a-z0-9]{8}-[a-z0-9-]{1,60}\\.(${Object.keys(MIME_BY_EXTENSION).join('|')})$`);

const cryptoRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));

// e.g. "Q3 Report.pptx" → "k3f9x2ab-q3-report.pptx". The random prefix makes
// links unguessable and lets the same filename be uploaded more than once.
export function makeResourceSlug(filename: string, random: (n: number) => Uint8Array = cryptoRandom): string {
  const { base, ext } = splitExtension(filename.trim());
  const prefix = Array.from(random(8), b => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('');
  const name = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'file';
  return `${prefix}-${name}.${ext}`;
}

export function isValidResourceSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

// Ends in "/" because Render's static host 404s paths ending in known file
// extensions (.pdf, .png, .jpg, .doc…) instead of rewriting them to the app.
export function resourceUrl(slug: string, appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/resource/${slug}/`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
