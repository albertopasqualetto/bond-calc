import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enTranslation from "@/locales/en/translation.json";
import itTranslation from "@/locales/it/translation.json";
import type { Locale as DateFnsLocale } from "date-fns/locale";
import { enUS, it } from "date-fns/locale";

export const defaultNS = "translation";

export const resources = {
	en: {
		translation: enTranslation,
	},
	it: {
		translation: itTranslation,
	},
} as const;

export const dateFnsLocalesByLanguage: Record<string, DateFnsLocale> = {
	en: enUS,
	it,
};

export const getDateFnsLocaleByLanguage = (
	language: string,
): DateFnsLocale | undefined => {
	switch (language) {
		case "en":
			return dateFnsLocalesByLanguage.en;
		case "it":
			return dateFnsLocalesByLanguage.it;
		default:
			return undefined;
	}
};

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		defaultNS,
		fallbackLng: "en",
		supportedLngs: ["en", "it"],
		nonExplicitSupportedLngs: true,
		detection: {
			order: ["querystring", "localStorage", "navigator", "htmlTag"],
			caches: ["localStorage"],
		},
		interpolation: {
			escapeValue: false,
		},
	});

export default i18n;
