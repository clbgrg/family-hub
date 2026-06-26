// Pure + DOM helpers for the on-screen virtual keyboard. The pure functions
// hold the editing logic (unit-tested); the DOM wrappers apply them to a real
// <input>/<textarea> and dispatch the `input` event Nuxt UI's v-model needs.

export type KbLayout = "qwerty" | "numeric";

export type InputDescriptor = { type?: string | null; inputMode?: string | null };

/** Numeric pad for numeric/tel inputs (incl. the Settings PIN field), else QWERTY. */
export function layoutForInput(d: InputDescriptor): KbLayout {
  const type = (d.type ?? "").toLowerCase();
  const mode = (d.inputMode ?? "").toLowerCase();
  if (mode === "numeric" || mode === "decimal" || mode === "tel")
    return "numeric";
  if (type === "number" || type === "tel")
    return "numeric";
  return "qwerty";
}

/** Letter case from Shift (one-shot) XOR Caps (lock); non-letters pass through. */
export function applyCase(char: string, opts: { shift: boolean; caps: boolean }): string {
  if (!/[a-z]/i.test(char))
    return char;
  return opts.shift !== opts.caps ? char.toUpperCase() : char.toLowerCase();
}

function clampRange(len: number, start: number, end: number): [number, number] {
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(s, Math.min(end, len));
  return [s, e];
}

export function computeInsert(value: string, start: number, end: number, text: string): { value: string; caret: number } {
  const [s, e] = clampRange(value.length, start, end);
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}

export function computeBackspace(value: string, start: number, end: number): { value: string; caret: number } {
  const [s, e] = clampRange(value.length, start, end);
  if (s !== e)
    return { value: value.slice(0, s) + value.slice(e), caret: s };
  if (s === 0)
    return { value, caret: 0 };
  return { value: value.slice(0, s - 1) + value.slice(s), caret: s - 1 };
}

// ----- DOM application -----

type TextEl = HTMLInputElement | HTMLTextAreaElement;

// Some input types (number/email) don't support selection — selectionStart is
// null and setSelectionRange throws; in that case we edit at the end.
function readSelection(el: TextEl): [number, number] {
  const start = el.selectionStart;
  if (start == null)
    return [el.value.length, el.value.length];
  return [start, el.selectionEnd ?? start];
}

function applyResult(el: TextEl, result: { value: string; caret: number }) {
  el.value = result.value;
  try {
    el.setSelectionRange(result.caret, result.caret);
  }
  catch {
    // selection unsupported for this input type — value is still updated.
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function insertIntoElement(el: TextEl, text: string) {
  const [s, e] = readSelection(el);
  applyResult(el, computeInsert(el.value, s, e, text));
}

export function backspaceElement(el: TextEl) {
  const [s, e] = readSelection(el);
  applyResult(el, computeBackspace(el.value, s, e));
}

/**
 * Enter: a <textarea> gets a newline; an <input> gets synthetic keydown/keyup
 * Enter events so existing `@keyup.enter`/`@keydown.enter` handlers fire
 * (meal/message/etc.). Returns whether the keyboard should close.
 */
export function pressEnter(el: TextEl): { close: boolean } {
  if (el.tagName === "TEXTAREA") {
    insertIntoElement(el, "\n");
    return { close: false };
  }
  for (const type of ["keydown", "keyup"] as const) {
    el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true }));
  }
  return { close: true };
}

export function isTextField(el: Element | null | undefined): el is TextEl {
  if (!el)
    return false;
  if (el.tagName === "TEXTAREA")
    return true;
  if (el.tagName !== "INPUT")
    return false;
  const type = ((el as HTMLInputElement).type || "text").toLowerCase();
  // Everything text-ish; exclude non-text input types that have their own UI.
  return !["checkbox", "radio", "range", "color", "file", "button", "submit", "reset", "image", "hidden"].includes(type);
}

function findFixedOverlay(el: Element): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const cs = getComputedStyle(node);
    if (cs.position === "fixed") {
      const r = node.getBoundingClientRect();
      if (r.top <= 1 && r.height >= window.innerHeight - 2)
        return node; // a full-screen fixed overlay (a dialog)
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Keep `el` above the keyboard. Scrolls it into view (leaving room via
 * scroll-padding) and, when it lives in a full-screen fixed dialog overlay,
 * pads that overlay's bottom so its centered panel floats above the keyboard.
 * Returns a cleanup to undo everything on hide.
 */
export function liftIntoView(el: TextEl, keyboardHeight: number): () => void {
  const cleanups: Array<() => void> = [];

  const root = document.documentElement;
  const prevPad = root.style.scrollPaddingBottom;
  root.style.scrollPaddingBottom = `${keyboardHeight}px`;
  cleanups.push(() => {
    root.style.scrollPaddingBottom = prevPad;
  });

  const overlay = findFixedOverlay(el);
  if (overlay) {
    const prev = overlay.style.paddingBottom;
    overlay.style.paddingBottom = `${keyboardHeight}px`;
    cleanups.push(() => {
      overlay.style.paddingBottom = prev;
    });
  }

  try {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  catch {
    // older engines: ignore
  }

  return () => cleanups.forEach(fn => fn());
}
