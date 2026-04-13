export function formatTherapistDisplayName(firstName?: string | null, lastName?: string | null, fallback = 'Therapist') {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (!first && !last) return fallback;
  if (first && !last) return first;
  if (!first && last) return last;

  return `${first} ${last?.charAt(0).toUpperCase()}.`;
}
