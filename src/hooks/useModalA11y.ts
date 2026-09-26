import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Elements that can receive keyboard focus inside a modal. Kept in sync with
 * the native tab order; elements are queried live on every keydown so that
 * dynamically rendered content is respected.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseModalA11yOptions {
  /** True while the modal is open. */
  active: boolean;
  /** Called when the user presses Escape. */
  onClose: () => void;
  /** Element that should receive focus when the modal opens. Falls back to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export interface UseModalA11yResult<T extends HTMLElement> {
  /** Attach to the dialog panel that should trap focus. */
  containerRef: RefObject<T | null>;
}

function isVisible(element: HTMLElement): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Dependency-free modal accessibility helper: traps Tab / Shift+Tab inside the
 * dialog, closes on Escape, moves initial focus, and restores focus to the
 * trigger when the modal closes or unmounts.
 *
 * Works both for conditionally mounted modals (`active` true for their whole
 * lifetime) and always-mounted modals that toggle an `active` / `isOpen` prop.
 */
export function useModalA11y<T extends HTMLElement>({
  active,
  onClose,
  initialFocusRef,
}: UseModalA11yOptions): UseModalA11yResult<T> {
  const containerRef = useRef<T | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Keep mutable callbacks in refs so the main effect only re-runs on `active`.
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initialFocusRefRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useEffect(() => {
    if (!active) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isVisible);
    };

    // Defer until the modal is painted so refs are attached.
    const frame = requestAnimationFrame(() => {
      const explicit = initialFocusRefRef.current?.current;
      if (explicit && explicit.isConnected) {
        explicit.focus();
        return;
      }
      const focusable = getFocusable();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        containerRef.current?.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey) {
        if (current === first || !containerRef.current?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !containerRef.current?.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, [active]);

  return { containerRef };
}
