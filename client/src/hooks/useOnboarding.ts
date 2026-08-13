import { useState, useEffect, useCallback } from "react";

const THEME_KEY = "studyos_theme";

function storageKeys(userId?: number) {
  const suffix = userId ? `_${userId}` : "";
  return {
    name: `studyos_user_name${suffix}`,
    complete: `studyos_onboarding_complete${suffix}`,
  };
}

export type Theme = "light" | "dark";

export function useOnboarding(userId?: number, serverName?: string | null) {
  const [name, setNameState] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const keys = storageKeys(userId);
    const stored = localStorage.getItem(keys.name);
    const onboardingComplete = localStorage.getItem(keys.complete);
    if (stored && onboardingComplete) {
      setNameState(stored);
    } else if (serverName?.trim()) {
      const normalized = serverName.trim().replace(/\s+/g, " ").slice(0, 80);
      localStorage.setItem(keys.name, normalized);
      localStorage.setItem(keys.complete, "true");
      setNameState(normalized);
      setIsNewUser(false);
    } else {
      setIsNewUser(true);
      setStep(0);
    }
    setIsLoading(false);
  }, [userId, serverName]);

  const setName = useCallback(async (newName: string) => {
    const trimmed = newName.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!trimmed) return;

    const keys = storageKeys(userId);
    localStorage.setItem(keys.name, trimmed);
    setNameState(trimmed);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Could not save your name");
      }
      window.dispatchEvent(new CustomEvent("studyos-profile-updated"));
    } catch (error) {
      // The local copy remains available so the UI still feels personal in offline/dev mode.
      console.warn("[Onboarding] Could not sync name to server:", error);
    }

    setStep(1);
  }, [userId]);

  const setTheme = useCallback((theme: Theme) => {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(storageKeys(userId).complete, "true");
    localStorage.setItem("theme", theme);
    setStep(2);
    setIsNewUser(false);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [userId]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(storageKeys(userId).complete, "true");
    setIsNewUser(false);
    setStep(2);
  }, [userId]);

  const clearName = useCallback(() => {
    const keys = storageKeys(userId);
    localStorage.removeItem(keys.name);
    localStorage.removeItem(keys.complete);
    setNameState(null);
    setIsNewUser(true);
    setStep(0);
  }, [userId]);

  return { name, setName, clearName, isNewUser, isLoading, step, setTheme, completeOnboarding };
}
