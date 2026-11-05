// File links attached to a broadcast. Files live in the `resources` bucket and
// are served at <APP_URL>/resource/<slug> (see src/pages/ResourceDownload.tsx).

export const MAX_RESOURCES_PER_BROADCAST = 5;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseResourceIds(raw: unknown): { ids: string[] } | { error: string } {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string' && UUID_RE.test(v))) {
    return { error: 'resource_ids must be an array of file IDs' };
  }
  const ids = [...new Set(raw as string[])];
  if (ids.length > MAX_RESOURCES_PER_BROADCAST) {
    return { error: `You can attach up to ${MAX_RESOURCES_PER_BROADCAST} files` };
  }
  return { ids };
}

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface BroadcastResource {
  slug: string;
  original_filename: string;
  size_bytes: number;
}

// Links end in "/" because Render's static host 404s paths ending in known file
// extensions (.pdf, .png, .jpg, .doc…) instead of rewriting them to the app.
export function buildDownloadsHtml(resources: BroadcastResource[], appUrl: string): string {
  if (resources.length === 0) return '';
  const base = appUrl.replace(/\/+$/, '');
  const rows = resources.map((r) => `
    <tr><td style="padding:6px 0">
      <a href="${base}/resource/${encodeURIComponent(r.slug)}/" style="display:inline-block;background:#10b981;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">
        Download: ${escapeHtml(r.original_filename)}
      </a>
      <span style="color:#6b7280;font-size:13px;margin-left:8px">${formatBytes(r.size_bytes)}</span>
    </td></tr>`).join('');
  return `
    <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px">
      <p style="margin:0 0 8px;font-weight:bold">Downloads</p>
      <table style="border-collapse:collapse">${rows}</table>
    </div>`;
}
