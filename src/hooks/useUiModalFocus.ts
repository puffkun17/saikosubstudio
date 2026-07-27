'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * REL-2：`.ui-modal` 焦点契约 — 开锁内 / Tab 循环 / Esc 关闭 / 关回触发源。
 */
export function useUiModalFocus(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement;
    triggerRef.current =
      previous instanceof HTMLElement ? previous : null;

    const container = containerRef.current;
    if (!container) return;

    const focusFirst = () => {
      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      const target = nodes[0] ?? container;
      target.focus();
    };

    // 等 Portal / AnimatePresence 挂载后再聚焦
    const frame = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

      if (nodes.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
      triggerRef.current = null;
    };
  }, [open, containerRef]);
}
