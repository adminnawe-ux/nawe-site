// What a verified unsubscribe token should do.
// u = user_id (profile opt-out), s = newsletter_subscribers.id, e = email.
// Guest event attendees have neither id, so their email goes on the
// broadcast_suppressions list instead (send-broadcast skips those addresses).
export function unsubscribeActions(token: { u: string | null; s: string | null; e: string }): {
  optOutUserId: string | null;
  unsubscribeSubscriberId: string | null;
  suppressEmail: string | null;
} {
  const email = token.e.trim().toLowerCase();
  return {
    optOutUserId: token.u,
    unsubscribeSubscriberId: token.s,
    suppressEmail: !token.u && !token.s && email ? email : null,
  };
}
