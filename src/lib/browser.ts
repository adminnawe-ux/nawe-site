// Thin wrapper so full-page navigations can be mocked in tests (jsdom can't navigate).
export function redirectTo(url: string): void {
  window.location.replace(url);
}
