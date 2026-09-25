// Serverseitige Mindestpruefung fuer Lead-Daten. Das Frontend prueft auch,
// aber Buttons mit onclick statt <form> umgehen die HTML-Validierung
// (Junk-Lead #9436 am 21.09.2026: Name "b", Mail "a", Telefon "+417").
import { isValidPhone } from './phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Mindestens 2 Buchstaben, keine Ziffern, kein @ (Mail im Namensfeld)
export function isValidName(name: string): boolean {
  const n = name.trim();
  if (n.length > 80 || /[\d@]/.test(n)) return false;
  return (n.match(/\p{L}/gu) || []).length >= 2;
}

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && EMAIL_RE.test(e);
}

// Liefert die Felder, die durchfallen. Telefon nur, wenn mitgeschickt
// (E-Mail-only-Funnels wie figur-check schicken bewusst keins).
export function invalidLeadFields(d: { name?: unknown; email?: unknown; phone?: unknown }): string[] {
  const bad: string[] = [];
  if (!isValidName(String(d.name ?? ''))) bad.push('name');
  if (!isValidEmail(String(d.email ?? ''))) bad.push('email');
  if (d.phone && !isValidPhone(String(d.phone))) bad.push('phone');
  return bad;
}
