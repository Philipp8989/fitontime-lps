// Telefonnummer-Normalisierung — zentrale Absicherung fuer alle Lead-Endpoints.
// Verhindert Muell wie "+41CH772243360" oder "CH +41793073964": Browser-Autofill
// setzt teils den ISO-Laendercode (CH) mit ins Feld. Hier wird er entfernt.
//
// Regeln: alle Zeichen ausser Ziffern und + raus, "00" am Anfang -> "+",
// fuehrende 0 -> Laendercode, vorhandenes + bleibt, "+41 0791..." -> "+41791...".
// Standard-Laendercode konfigurierbar (FitonTime = CH/+41).
export function normalizePhone(raw: unknown, cc = '41'): string {
  let c = (raw ?? '').toString().replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.startsWith('00')) c = '+' + c.slice(2);
  if (c.charAt(0) !== '+') c = c.charAt(0) === '0' ? '+' + cc + c.slice(1) : '+' + cc + c;
  // Nationale 0 nach dem Laendercode (haeufig bei "+41 079 ...") entfernen
  if (c.startsWith('+' + cc + '0')) c = '+' + cc + c.slice(cc.length + 2);
  return c;
}

// Plausibel = E.164-Form. Schweiz: exakt 9 Ziffern nach +41, erste 2 bis 9.
// Ausland: 10 bis 15 Ziffern (fängt "+78..." ab, wo die 0 von 078 fehlt).
// Beispiel Junk-Lead #9436: "+417" fällt hier durch.
export function isValidPhone(phone: string): boolean {
  if (!/^\+\d+$/.test(phone)) return false;
  if (phone.startsWith('+41')) return /^\+41[2-9]\d{8}$/.test(phone);
  const digits = phone.length - 1;
  return digits >= 10 && digits <= 15;
}
