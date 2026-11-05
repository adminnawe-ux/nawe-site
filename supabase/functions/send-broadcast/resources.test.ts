/**
 * Tests for broadcast file-link helpers. Imports the real module.
 *
 * Run with:
 *   deno test --allow-env supabase/functions/send-broadcast/resources.test.ts
 */

import { assert, assertEquals, assertFalse, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDownloadsHtml, MAX_RESOURCES_PER_BROADCAST, parseResourceIds } from './resources.ts';

const ID1 = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const ID2 = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

// ---------------------------------------------------------------------------
// parseResourceIds
// ---------------------------------------------------------------------------

Deno.test('parseResourceIds: missing / empty → no files', () => {
  assertEquals(parseResourceIds(undefined), { ids: [] });
  assertEquals(parseResourceIds(null), { ids: [] });
  assertEquals(parseResourceIds([]), { ids: [] });
});

Deno.test('parseResourceIds: valid uuids pass through, de-duplicated', () => {
  assertEquals(parseResourceIds([ID1, ID2, ID1]), { ids: [ID1, ID2] });
});

Deno.test('parseResourceIds: rejects non-arrays and non-uuid entries', () => {
  for (const bad of ['abc', 42, { id: ID1 }, [ID1, 'not-a-uuid'], [ID1, 7], ["'; drop table resources;--"]]) {
    assert('error' in parseResourceIds(bad), JSON.stringify(bad));
  }
});

Deno.test(`parseResourceIds: rejects more than ${MAX_RESOURCES_PER_BROADCAST} files`, () => {
  const six = Array.from({ length: 6 }, (_, i) => `3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6${i}`);
  const res = parseResourceIds(six);
  assert('error' in res);
  assertStringIncludes(res.error, '5');
  assertEquals(parseResourceIds(six.slice(0, 5)), { ids: six.slice(0, 5) });
});

// ---------------------------------------------------------------------------
// buildDownloadsHtml
// ---------------------------------------------------------------------------

const deck = { slug: 'abcdefgh-q3-report.pptx', original_filename: 'Q3 Report.pptx', size_bytes: 5 * 1024 * 1024 };

Deno.test('buildDownloadsHtml: nothing attached → empty string', () => {
  assertEquals(buildDownloadsHtml([], 'https://nawe.co.ke'), '');
});

Deno.test('buildDownloadsHtml: links each file on the site domain with name and size', () => {
  const html = buildDownloadsHtml([deck], 'https://nawe.co.ke');
  assertStringIncludes(html, 'href="https://nawe.co.ke/resource/abcdefgh-q3-report.pptx"');
  assertStringIncludes(html, 'Q3 Report.pptx');
  assertStringIncludes(html, '5.0 MB');
  assertStringIncludes(html, 'Downloads');
});

Deno.test('buildDownloadsHtml: one link per file, in order', () => {
  const pdf = { slug: 'zzzzzzzz-agenda.pdf', original_filename: 'Agenda.pdf', size_bytes: 2048 };
  const html = buildDownloadsHtml([deck, pdf], 'https://nawe.co.ke/');
  assertEquals(html.match(/href="/g)?.length, 2);
  assert(html.indexOf('Q3 Report.pptx') < html.indexOf('Agenda.pdf'));
  assertStringIncludes(html, 'href="https://nawe.co.ke/resource/zzzzzzzz-agenda.pdf"');
});

Deno.test('buildDownloadsHtml: escapes filenames — no HTML injection via an uploaded name', () => {
  const evil = { slug: 'abcdefgh-x.pdf', original_filename: '<img src=x onerror=alert(1)>"&.pdf', size_bytes: 10 };
  const html = buildDownloadsHtml([evil], 'https://nawe.co.ke');
  assertFalse(html.includes('<img'));
  assertStringIncludes(html, '&lt;img src=x onerror=alert(1)&gt;&quot;&amp;.pdf');
});
