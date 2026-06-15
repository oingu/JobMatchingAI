"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent hover:text-accent-foreground outline-none">
        <Globe className="h-[1.2rem] w-[1.2rem] transition-all" />
        <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-muted px-1 rounded-sm border">
          {locale.toUpperCase()}
        </span>
        <span className="sr-only">{t("ui.language")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("vi")}>
          Tiếng Việt {locale === "vi" && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("en")}>
          English {locale === "en" && "✓"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
