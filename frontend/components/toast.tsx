"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

type ToastOptions = {
  actionLabel?: string;
  onAction?: () => void;
};

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const ICON: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  error: <XCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
  error: "",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info", options?: ToastOptions) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, variant, ...options }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="pointer-events-none fixed top-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <Alert
            key={t.id}
            variant={t.variant === "error" ? "destructive" : "default"}
            className={cn(
              "pointer-events-auto animate-in fade-in-0 slide-in-from-right-5 shadow-lg",
              VARIANT_STYLES[t.variant],
            )}
          >
            {ICON[t.variant]}
            <AlertDescription className={cn(
              t.variant === "success" && "text-green-800 dark:text-green-200",
              t.variant === "info" && "text-blue-800 dark:text-blue-200",
            )}>
              {t.message}
            </AlertDescription>
            {t.actionLabel && t.onAction && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={t.onAction}
              >
                {t.actionLabel}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-1.5 right-1.5 opacity-60 hover:opacity-100"
              onClick={() => remove(t.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
