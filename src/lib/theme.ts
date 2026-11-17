import {useSyncExternalStore} from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'educart-theme';
let current: Theme = 'dark';
let initialized = false;
const subscribers = new Set<() => void>();

export function initializeTheme(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  try {current = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';}
  catch {current = 'dark';}
  document.documentElement.dataset.theme = current;
  window.addEventListener('storage', event => {
    if (event.key === KEY) applyTheme(event.newValue === 'light' ? 'light' : 'dark', false);
  });
}
function applyTheme(next: Theme, persist: boolean) {
  if (typeof document === 'undefined') return;
  current = next;
  document.documentElement.dataset.theme = next;
  if (persist) {
    try {localStorage.setItem(KEY, next);} catch { /* localStorage may be blocked */ }
  }
  subscribers.forEach(listener => listener());
}
export function setTheme(next: Theme): void {
  initializeTheme();
  applyTheme(next, true);
}
export function useTheme(): Theme {
  return useSyncExternalStore(
    callback => {subscribers.add(callback);return () => subscribers.delete(callback);},
    () => current,
    () => 'dark'
  );
}
