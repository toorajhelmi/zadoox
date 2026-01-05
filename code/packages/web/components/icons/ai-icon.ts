export function createAiIconEl(opts?: { title?: string; sizePx?: number }): HTMLDivElement {
  const title = opts?.title ?? 'AI';
  const sizePx = opts?.sizePx ?? 28;

  const el = document.createElement('div');
  el.title = title;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.style.borderRadius = '6px';
  el.style.border = '1px solid rgba(59,130,246,0.35)';
  el.style.background = 'rgba(59,130,246,0.10)';
  el.style.color = '#60a5fa';
  el.style.flexShrink = '0';
  el.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 2l1.2 4.2L17.4 7.4l-4.2 1.2L12 12l-1.2-3.4L6.6 7.4l4.2-1.2L12 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M19 11l.8 2.8L22.6 15l-2.8.8L19 18.6l-.8-2.8L15.4 15l2.8-.8L19 11z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '</svg>';
  return el;
}


