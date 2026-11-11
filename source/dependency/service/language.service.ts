import fs from 'node:fs/promises';
import { ApiLanguage } from '../value/system.enum.js';

export interface ChooseLanguageOptions {
  language?: ApiLanguage | string;
  code?: number;
}

export type LanguageDictionary = Record<string, string>;

export class LanguageService {
  private arabicLanguage!: LanguageDictionary;
  private englishLanguage!: LanguageDictionary;

  constructor() {}

  public async loadLanguages(): Promise<void> {
    const readLanguage = async (language: string): Promise<string> => {
      const locations = [
        new URL(`../../../distribution/i18n/${language}.json`, import.meta.url),
        new URL(`../../../source/i18n/${language}.json`, import.meta.url),
      ];

      let lastError: unknown;
      for (const location of locations) {
        try {
          return await fs.readFile(location, 'utf-8');
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    };

    const [arabic, english] = await Promise.all([readLanguage('ar'), readLanguage('en')]);

    this.arabicLanguage = JSON.parse(arabic);
    this.englishLanguage = JSON.parse(english);
  }

  chooseLanguage = (
    language: ApiLanguage | string = ApiLanguage.ENGLISH,
    code: number = 103
  ): string => {
    const normalizedLanguage = (language.split(',')[0] ?? '').split(';')[0]?.trim().toLowerCase();

    const messages = normalizedLanguage?.startsWith('ar')
      ? this.arabicLanguage
      : this.englishLanguage;

    const messageKey = String(code);

    return (
      messages[messageKey] ??
      this.englishLanguage[messageKey] ??
      this.englishLanguage['103'] ??
      'An error occurred'
    );
  };
}

export const languageService = await (async () => {
  const service = new LanguageService();
  await service.loadLanguages();
  return service;
})();
