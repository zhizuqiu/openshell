/**
 * Internationalization (i18n) support
 * Supports Chinese (zh) and English (en)
 * Default: Chinese
 */
export type Language = 'zh' | 'en';
declare class I18n {
    private currentLanguage;
    setLanguage(lang: Language): void;
    getLanguage(): Language;
    t(key: string): string;
    tArray(key: string): string[];
}
export declare const i18n: I18n;
export declare const t: (key: string) => string;
export declare const tArray: (key: string) => string[];
export {};
