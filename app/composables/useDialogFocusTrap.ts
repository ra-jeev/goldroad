import {
  nextTick,
  onBeforeUnmount,
  watch,
  type Ref,
  type WatchSource,
} from 'vue';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Shared modal focus contract: focus enters the dialog, Tab stays inside it,
 * and focus returns to the opener after close. Escape remains owned by each
 * dialog because dismissal behavior differs by surface.
 */
export function useDialogFocusTrap(
  isOpen: WatchSource<boolean>,
  dialog: Ref<HTMLElement | null>,
) {
  let opener: HTMLElement | null = null;

  function focusableElements(): HTMLElement[] {
    return dialog.value
      ? Array.from(
          dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((element) => !element.hasAttribute('disabled'))
      : [];
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !dialog.value) return;

    const focusable = focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.value.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !dialog.value.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && (active === last || !dialog.value.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  watch(
    isOpen,
    async (open) => {
      if (!import.meta.client) return;

      if (open) {
        opener =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        document.addEventListener('keydown', onKeydown);
        await nextTick();
        const initial =
          dialog.value?.querySelector<HTMLElement>('[data-dialog-initial-focus]') ??
          focusableElements()[0] ??
          dialog.value;
        initial?.focus();
        return;
      }

      document.removeEventListener('keydown', onKeydown);
      await nextTick();
      if (!document.querySelector('[role="dialog"][aria-modal="true"]')) {
        opener?.focus();
      }
      opener = null;
    },
    { flush: 'post' },
  );

  onBeforeUnmount(() => {
    if (import.meta.client) {
      document.removeEventListener('keydown', onKeydown);
    }
  });
}
