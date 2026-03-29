import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enTranslation from "@/locales/en/translation.json";
import itTranslation from "@/locales/it/translation.json";

export const defaultNS = "translation";

export const resources = {
	en: {
		translation: enTranslation,
	},
	it: {
		translation: itTranslation,
	},
} as const;

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
