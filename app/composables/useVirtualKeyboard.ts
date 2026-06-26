import type { KbLayout } from "~/utils/keyboardInput";

import { isTextField, layoutForInput } from "~/utils/keyboardInput";

// On-screen keyboard for the touchscreen kiosk: it appears whenever a native
// text field is focused or tapped, app-wide (dialogs, settings, forms, popups).
//
// State is module-level singletons (NOT useState): the keyboard is client-only
// — mounted once in app.vue's <ClientOnly> — and a single shared ref guarantees
// the component's v-if and the show/hide logic act on the exact same value,
// regardless of how many times the composable is called.
//
// No route exclusions: it only shows for a focused native field, so the login
// PIN pad (pure buttons) never triggers it, while the first-run setup wizard's
// name fields DO get it (a kiosk has no real keyboard). Put `data-no-keyboard`
// on a field to opt it out.

const target = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const visible = ref(false);
const layout = ref<KbLayout>("qwerty");
let wired = false;

function hide() {
  visible.value = false;
  target.value = null;
}

export function useVirtualKeyboard() {
  if (import.meta.client && !wired) {
    wired = true;
    const { preferences } = useClientPreferences();

    function eligible(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
      return (
        preferences.value?.virtualKeyboardEnabled !== false
        && isTextField(el as Element)
        && !(el as HTMLElement).hasAttribute("data-no-keyboard")
        && !(el as HTMLInputElement).readOnly
        && !(el as HTMLInputElement).disabled
      );
    }
    function show(el: HTMLInputElement | HTMLTextAreaElement) {
      target.value = el;
      layout.value = layoutForInput({ type: el.type, inputMode: el.getAttribute("inputmode") });
      visible.value = true;
    }

    // Focusing a field shows it; focus leaving to a non-field hides it.
    document.addEventListener("focusin", (e) => {
      if (eligible(e.target))
        show(e.target);
      else
        hide();
    });
    document.addEventListener("focusout", (e) => {
      // Tapping keys uses pointerdown.prevent, so the field never blurs then.
      // A real blur to a non-field closes the keyboard.
      if (!isTextField((e as FocusEvent).relatedTarget as Element | null))
        hide();
    });
    // Touch is the source of truth on the kiosk: tapping a field shows/keeps the
    // keyboard (covers re-tap after Close and a field autofocused before these
    // listeners attached); tapping anything else that ISN'T the keyboard closes
    // it. Keys/Close carry data-no-keyboard, so tapping them never closes.
    document.addEventListener("pointerdown", (e) => {
      const el = e.target as Element | null;
      const field = el?.closest?.("input, textarea") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (field) {
        if (eligible(field))
          show(field);
        return;
      }
      if (visible.value && !el?.closest?.("[data-no-keyboard]"))
        hide();
    }, true);

    // A field already autofocused at wire-up time.
    if (eligible(document.activeElement))
      show(document.activeElement);
  }

  return { visible, target, layout, hide };
}
