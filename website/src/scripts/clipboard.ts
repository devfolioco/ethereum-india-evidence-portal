// Clipboard with a legacy fallback, plus the brief "Copied" flash the portal used.
export async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

export function flash(el: HTMLElement, message: string, ms = 1600) {
  const original = el.textContent;
  el.textContent = message;
  setTimeout(() => (el.textContent = original), ms);
}
