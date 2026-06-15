"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { en, Translations } from "@/locales/en";
import { vi } from "@/locales/vi";

type Locale = "en" | "vi";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries = {
  en,
  vi,
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en"); // Default to English
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("preferred_locale") as Locale;
    if (saved === "en" || saved === "vi") {
      setLocale(saved);
    }
    setMounted(true);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("preferred_locale", newLocale);
  };

  const t = (key: keyof Translations): string => {
    const dict = dictionaries[locale];
    return dict[key] || en[key] || key;
  };

  if (!mounted) {
    // Prevent hydration mismatch by not rendering anything that depends on locale until mounted
    // Or just render with default 'vi' but it might blink if stored is 'en'
    // To be safe and simple, we'll just render it anyway, but hydration might mismatch text. 
    // We can return a hidden wrapper if needed.
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
