/**
 * FAMILJ – i18next Initialization
 *
 * Language priority:
 * 1. User preference stored in Supabase profile
 * 2. Device language (via expo-localization)
 * 3. Fallback: 'en'
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en/translation.json';
import sv from './locales/sv/translation.json';
import de from './locales/de/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'sv', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Derive the best supported language from a locale string.
 * e.g. 'sv-SE' → 'sv', 'de-AT' → 'de', 'fr-FR' → 'en' (fallback)
 */
export function getBestLanguage(locale: string): SupportedLanguage {
  const lang = locale.split('-')[0];
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    return lang as SupportedLanguage;
  }
  return 'en';
}

const deviceLocale = Localization.getLocales()[0]?.languageTag ?? 'en';
const deviceLanguage = getBestLanguage(deviceLocale);

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sv: { translation: sv },
      de: { translation: de },
    },
    lng: deviceLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    compatibilityJSON: 'v4',
  });

export default i18n;
