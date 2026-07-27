import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RichTextEditor, { cleanPastedHtml, looksLikeHtml } from './RichTextEditor';

describe('looksLikeHtml', () => {
  it('returns false for null/undefined/empty', () => {
    expect(looksLikeHtml(null)).toBe(false);
    expect(looksLikeHtml(undefined)).toBe(false);
    expect(looksLikeHtml('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(looksLikeHtml('Just a plain sentence.')).toBe(false);
  });

  it('returns true for HTML content', () => {
    expect(looksLikeHtml('<p>Hello <strong>world</strong></p>')).toBe(true);
    expect(looksLikeHtml('<h2>Title</h2>')).toBe(true);
  });
});

describe('cleanPastedHtml', () => {
  it('strips inline style, class, and lang attributes', () => {
    const dirty = '<p style="margin:0" class="MsoNormal" lang="EN-US">Hello</p>';
    const clean = cleanPastedHtml(dirty);
    expect(clean).not.toContain('style=');
    expect(clean).not.toContain('class=');
    expect(clean).not.toContain('lang=');
    expect(clean).toContain('Hello');
  });

  it('unwraps font tags while keeping their content', () => {
    const dirty = '<p><font face="Arial" color="red">Styled text</font></p>';
    const clean = cleanPastedHtml(dirty);
    expect(clean).not.toContain('<font');
    expect(clean).toContain('Styled text');
  });

  it('removes empty span wrappers and unwraps non-empty ones', () => {
    const dirty = '<p>Hello<span style="mso-spacerun:yes">&nbsp;&nbsp;</span><span>World</span></p>';
    const clean = cleanPastedHtml(dirty);
    expect(clean).not.toContain('<span');
    expect(clean).toContain('World');
  });

  it('preserves semantic tags like headings, lists, and links', () => {
    const dirty = '<h2 style="color:red">Title</h2><ul class="MsoListParagraph"><li>Item</li></ul><a href="https://example.com" style="color:blue">link</a>';
    const clean = cleanPastedHtml(dirty);
    expect(clean).toContain('<h2>Title</h2>');
    expect(clean).toContain('<li>Item</li>');
    expect(clean).toContain('href="https://example.com"');
  });
});

describe('RichTextEditor', () => {
  it('renders toolbar and editor content', () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear formatting')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows word/character count', () => {
    render(<RichTextEditor value="<p>Hello world</p>" onChange={vi.fn()} />);
    expect(screen.getByText(/words/)).toBeInTheDocument();
    expect(screen.getByText(/characters/)).toBeInTheDocument();
  });

  it('renders existing content as HTML rather than escaped text', () => {
    render(<RichTextEditor value="<p><strong>Bold</strong> text</p>" onChange={vi.fn()} />);
    expect(document.querySelector('.ProseMirror strong')).not.toBeNull();
  });
});
