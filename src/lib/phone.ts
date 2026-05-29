// Telefonnummer-Normalisierung — zentrale Absicherung fuer alle Lead-Endpoints.
// Verhindert Muell wie "+41CH772243360" oder "CH +41793073964": Browser-Autofill
// setzt teils den ISO-Laendercode (CH) mit ins Feld. Hier wird er entfernt.
//
// Regeln: alle Zeichen ausser Ziffern und + raus, fuehrende 0 -> Laendercode,
// vorhandenes + bleibt. Standard-Laendercode konfigurierbar (FitonTime = CH/+41).
export function normalizePhone(raw: unknown, cc = '41'): string {
  const c = (raw ?? '').toString().replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.charAt(0) === '+') return c;
  if (c.charAt(0) === '0') return '+' + cc + c.slice(1);
  return '+' + cc + c;
}
