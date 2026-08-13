import { useEffect } from "react";
import { useLocation } from "wouter";

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const MOD_KEY = isMac ? "metaKey" : "ctrlKey";

interface UseGlobalShortcutsOptions {
  onOpenChat?: () => void;
  onOpenCommandPalette?: () => void;
}

export function useGlobalShortcuts({ onOpenChat, onOpenCommandPalette }: UseGlobalShortcutsOptions) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierPressed = e[MOD_KEY];

      if (!isModifierPressed) return;

      const target = e.target as HTMLElement;
      const isEditing = target.isContentEditable || 
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.tagName === "SELECT";

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        
        if (isEditing) {
          return;
        }

        if (onOpenChat) {
          onOpenChat();
        } else {
          navigate("/chat");
        }
        return;
      }

      if (e.key === "/") {
        if (isEditing) return;
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, onOpenChat, onOpenCommandPalette]);
}