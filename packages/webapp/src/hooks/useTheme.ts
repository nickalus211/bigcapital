import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

// Keep in sync with the pre-paint script in `index.html`.
const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemePreference = 'dark';
const DARK_CLASS = 'bp4-dark';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

/**
 * Reads the saved theme preference, falling back to the default when the
 * storage is unavailable (private mode, blocked site data).
 */
export const getThemePreference = (): ThemePreference => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

const prefersDark = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(DARK_MEDIA_QUERY).matches;

/**
 * Resolves the preference to the theme that should be displayed.
 */
export const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

/**
 * Toggles the Blueprint dark class on the html and body elements.
 * The payment portal pages are always light.
 */
export const applyTheme = (preference: ThemePreference) => {
  const isDark =
    resolveTheme(preference) === 'dark' &&
    !window.location.pathname.startsWith('/payment');

  document.documentElement.classList.toggle(DARK_CLASS, isDark);
  document.body.classList.toggle(DARK_CLASS, isDark);
};

/**
 * Saves and applies the given theme preference.
 */
export const setThemePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable; the choice applies to this page load only.
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
};

/**
 * Switches between light and dark, leaving the system mode.
 */
export const toggleTheme = () => {
  const current = resolveTheme(getThemePreference());
  setThemePreference(current === 'dark' ? 'light' : 'dark');
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Theme preference state shared across components.
 */
export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    getThemePreference,
    () => DEFAULT_THEME,
  );

  // Follow the operating system while the preference is `system`.
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = () => applyTheme('system');

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = useCallback(
    (value: ThemePreference) => setThemePreference(value),
    [],
  );

  return {
    preference,
    theme: resolveTheme(preference),
    setPreference,
    toggleTheme,
  };
}
