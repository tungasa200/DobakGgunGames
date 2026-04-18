import badwordsData from '../../../shared/badwords.json';

const BADWORDS: string[] = badwordsData.badwords;

export function containsProfanity(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return BADWORDS.some((word) => normalized.includes(word.toLowerCase()));
}
