"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface UiContextType {
  glassMode: boolean;
  setGlassMode: (value: boolean) => void;
}

const UiContext = createContext<UiContextType>({
  glassMode: true,
  setGlassMode: () => {},
});

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [glassMode, setGlassMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("jobmatch_glass_mode");
    if (saved !== null) {
      setGlassMode(saved === "true");
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("jobmatch_glass_mode", String(glassMode));
      if (glassMode) {
        document.documentElement.classList.add("glass-mode");
      } else {
        document.documentElement.classList.remove("glass-mode");
      }
    }
  }, [glassMode, mounted]);

  return (
    <UiContext.Provider value={{ glassMode: mounted ? glassMode : true, setGlassMode }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUi() {
  return useContext(UiContext);
}
