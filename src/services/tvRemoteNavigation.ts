/**
 * Android TV & Smart TV D-Pad Remote Navigation System
 * ai petros / Petros Cinema (Aipetros-stream)
 * 
 * Provides full spatial navigation, remote control key handling,
 * and high-contrast TV focus management for 10-foot UI viewing on Android TV,
 * Fire TV, Apple TV, and Smart TV browsers.
 */

export interface TvNavigationOptions {
  enabled?: boolean;
  focusClassName?: string;
  autoDetectTv?: boolean;
}

const STORAGE_TV_MODE_KEY = 'aipetros_tv_mode_enabled_v1';

class TvRemoteNavigationService {
  private isTvMode = false;
  private focusClassName = 'tv-focus-active';
  private currentFocusedElement: HTMLElement | null = null;
  private isListening = false;
  private backHandlers: Array<() => boolean> = []; // returns true if consumed

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_TV_MODE_KEY);
      if (stored !== null) {
        this.isTvMode = stored === 'true';
      } else {
        // Auto detect Android TV or Smart TV user agents
        this.isTvMode = this.detectTvEnvironment();
      }

      this.initKeyListeners();
    }
  }

  public detectTvEnvironment(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
    const isTvUserAgent = (
      ua.includes('android tv') ||
      ua.includes('googletv') ||
      ua.includes('smarttv') ||
      ua.includes('smart-tv') ||
      ua.includes('tizen') ||
      ua.includes('webos') ||
      ua.includes('apple tv') ||
      ua.includes('aftb') ||
      ua.includes('aftt') ||
      ua.includes('crkey') ||
      ua.includes('leanback')
    );
    return isTvUserAgent;
  }

  public isTvModeEnabled(): boolean {
    return this.isTvMode;
  }

  public setTvModeEnabled(enabled: boolean) {
    this.isTvMode = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_TV_MODE_KEY, String(enabled));
      if (enabled) {
        document.body.classList.add('tv-mode-active');
        this.focusFirstAvailable();
      } else {
        document.body.classList.remove('tv-mode-active');
        this.clearCurrentFocus();
      }
    }
  }

  public registerBackHandler(handler: () => boolean): () => void {
    this.backHandlers.push(handler);
    return () => {
      this.backHandlers = this.backHandlers.filter(h => h !== handler);
    };
  }

  private initKeyListeners() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Remote control key mappings
      const key = e.key;
      const code = e.keyCode;

      // Android TV / Remote Back Button (Keycode 27 = Escape, 4 = Android Back, 10009 = Tizen Back, 461 = WebOS Back)
      if (key === 'Escape' || key === 'Backspace' || code === 4 || code === 10009 || code === 461) {
        // If an input is focused, let backspace work normally
        if (key === 'Backspace' && (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')) {
          return;
        }

        // Try consuming by registered back handlers (e.g. close player, close modal)
        for (let i = this.backHandlers.length - 1; i >= 0; i--) {
          if (this.backHandlers[i]()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      // If TV mode is not active, but user is pressing remote arrow keys repeatedly, auto-suggest or activate
      if (!this.isTvMode && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
        // Activate TV mode on D-Pad navigation
        this.setTvModeEnabled(true);
      }

      if (!this.isTvMode) return;

      switch (key) {
        case 'ArrowUp':
          e.preventDefault();
          this.moveFocus('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.moveFocus('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.moveFocus('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.moveFocus('right');
          break;
        case 'Enter':
        case 'Select':
        case 'Ok':
          if (this.currentFocusedElement) {
            e.preventDefault();
            this.currentFocusedElement.click();
          }
          break;
      }
    }, { capture: true });
  }

  private getFocusableElements(): HTMLElement[] {
    if (typeof document === 'undefined') return [];
    const selector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[data-tv-focus="true"]'
    ].join(', ');

    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    // Filter visible elements
    return elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    });
  }

  public focusFirstAvailable() {
    const list = this.getFocusableElements();
    if (list.length > 0) {
      this.applyFocus(list[0]);
    }
  }

  private clearCurrentFocus() {
    if (this.currentFocusedElement) {
      this.currentFocusedElement.classList.remove(this.focusClassName);
      this.currentFocusedElement = null;
    }
  }

  private applyFocus(el: HTMLElement) {
    this.clearCurrentFocus();
    this.currentFocusedElement = el;
    el.classList.add(this.focusClassName);
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  private moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
    const focusables = this.getFocusableElements();
    if (focusables.length === 0) return;

    if (!this.currentFocusedElement || !focusables.includes(this.currentFocusedElement)) {
      this.applyFocus(focusables[0]);
      return;
    }

    const currentRect = this.currentFocusedElement.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestElement: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const el of focusables) {
      if (el === this.currentFocusedElement) continue;

      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isInDirection = false;
      let primaryDiff = 0;
      let secondaryDiff = 0;

      switch (direction) {
        case 'up':
          isInDirection = dy < -8;
          primaryDiff = Math.abs(dy);
          secondaryDiff = Math.abs(dx);
          break;
        case 'down':
          isInDirection = dy > 8;
          primaryDiff = Math.abs(dy);
          secondaryDiff = Math.abs(dx);
          break;
        case 'left':
          isInDirection = dx < -8;
          primaryDiff = Math.abs(dx);
          secondaryDiff = Math.abs(dy);
          break;
        case 'right':
          isInDirection = dx > 8;
          primaryDiff = Math.abs(dx);
          secondaryDiff = Math.abs(dy);
          break;
      }

      if (isInDirection) {
        // Weighted Manhattan + Euclidean distance prioritizing the target axis
        const score = primaryDiff + secondaryDiff * 1.8;
        if (score < minDistance) {
          minDistance = score;
          bestElement = el;
        }
      }
    }

    if (bestElement) {
      this.applyFocus(bestElement);
    }
  }
}

export const tvRemote = new TvRemoteNavigationService();
