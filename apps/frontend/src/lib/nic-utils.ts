/**
 * Sri Lankan National Identity Card (NIC) utilities
 *
 * Sri Lankan NIC formats:
 * 1. Old NIC: 9 digits followed by 'V' or 'X' (e.g., 951234567V)
 *    - Chars 0..1: Birth year (e.g. 95 -> 1995)
 *    - Chars 2..4: Days elapsed in the year (001 - 866)
 *      - If days > 500: Female (500 added to day of year)
 *      - If days <= 500: Male
 *
 * 2. New NIC: 12 digits (e.g., 199512345678, 200215603421)
 *    - Chars 0..3: Birth year (e.g. 1995, 2002)
 *    - Chars 4..6: Days elapsed in the year (001 - 866)
 *      - If days > 500: Female
 *      - If days <= 500: Male
 */

export function getGenderFromNic(nic?: string | null): 'MALE' | 'FEMALE' | null {
  if (!nic) return null;
  const clean = String(nic).trim().toUpperCase();

  // Old NIC format: 9 digits + optional letter (V/X)
  if (/^\d{9}[VX]?$/.test(clean)) {
    const dayDigits = parseInt(clean.substring(2, 5), 10);
    if (!isNaN(dayDigits)) {
      return dayDigits > 500 ? 'FEMALE' : 'MALE';
    }
  }

  // New NIC format: 12 digits
  if (/^\d{12}$/.test(clean)) {
    const dayDigits = parseInt(clean.substring(4, 7), 10);
    if (!isNaN(dayDigits)) {
      return dayDigits > 500 ? 'FEMALE' : 'MALE';
    }
  }

  return null;
}

export function getTitleFromNic(nic?: string | null): string {
  const gender = getGenderFromNic(nic);
  if (gender === 'FEMALE') return 'Mrs.';
  if (gender === 'MALE') return 'Mr.';
  return '';
}

/**
 * Formats a user/student/lecturer name with automatically computed Mr/Mrs prefix based on their NIC.
 * If the name already starts with an existing honorific (Mr., Mrs., Ms., Dr., Prof., etc.), it is preserved.
 */
export function formatNameWithTitle(name?: string | null, nic?: string | null): string {
  if (!name) return '—';
  const trimmed = String(name).trim();
  if (!trimmed) return '—';

  // Check if already starts with a common title
  if (/^(mr\.|mrs\.|ms\.|miss\.|dr\.|prof\.|rev\.)/i.test(trimmed)) {
    return trimmed;
  }

  const title = getTitleFromNic(nic);
  if (title) {
    return `${title} ${trimmed}`;
  }

  return trimmed;
}
