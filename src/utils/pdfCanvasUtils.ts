import html2canvas from 'html2canvas';

const UNSUPPORTED_COLOR_FN_RE = /\b(oklch|oklab|color-mix|lch|lab|color)\(/i;

const COLOR_PROPERTIES = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'boxShadow',
  'textShadow',
  'fill',
  'stroke',
] as const;

let sharedCtx: CanvasRenderingContext2D | null = null;

function getColorCanvasContext(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  sharedCtx = canvas.getContext('2d', { willReadFrequently: true });
  return sharedCtx;
}

function resolveSingleCssColor(colorExpr: string): string {
  const ctx = getColorCanvasContext();
  if (!ctx) return 'rgba(0, 0, 0, 0)';
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = colorExpr;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 255) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return 'rgba(0, 0, 0, 0)';
  }
}

/**
 * Remplace chaque expression CSS `oklch(...)`, `oklab(...)`, `color-mix(...)`, etc.
 * en prenant en compte les parenthèses imbriquées.
 */
function normalizeCssColorFunctions(input: string): string {
  if (!input || !UNSUPPORTED_COLOR_FN_RE.test(input)) return input;

  let result = '';
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);
    const match = rest.match(/^(oklch|oklab|color-mix|lch|lab|color)\(/i);
    if (match) {
      const start = i;
      let depth = 0;
      let j = i + match[0].length - 1;
      for (; j < input.length; j++) {
        if (input[j] === '(') depth++;
        else if (input[j] === ')') {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }
      const expr = input.slice(start, j);
      result += resolveSingleCssColor(expr);
      i = j;
    } else {
      result += input[i];
      i++;
    }
  }

  return result;
}

function sanitizeClonedTreeForHtml2Canvas(
  clonedDoc: Document,
  sourceRoot: HTMLElement,
  clonedRoot: HTMLElement
): void {
  // 1. Nettoyer les feuilles de style <style> du document cloné pour supprimer les fonctions oklch/oklab/color-mix
  const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
  for (const styleTag of styleTags) {
    const css = styleTag.textContent;
    if (css && UNSUPPORTED_COLOR_FN_RE.test(css)) {
      styleTag.textContent = normalizeCssColorFunctions(css);
    }
  }

  // 2. Nettoyer les styles calculés sur la racine et tous les descendants clonés
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))];
  const clonedElements = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))];
  const view = sourceRoot.ownerDocument.defaultView || window;

  const count = Math.min(sourceElements.length, clonedElements.length);
  for (let idx = 0; idx < count; idx++) {
    const srcEl = sourceElements[idx];
    const dstEl = clonedElements[idx];
    const computed = view.getComputedStyle(srcEl);

    for (const prop of COLOR_PROPERTIES) {
      const val = computed[prop];
      if (val && UNSUPPORTED_COLOR_FN_RE.test(val)) {
        (dstEl.style as any)[prop] = normalizeCssColorFunctions(val);
      }
    }
  }

  // 3. Neutraliser aussi les variables CSS Tailwind v4 sur <html> et <body> clonés si besoin
  for (const rootEl of [clonedDoc.documentElement, clonedDoc.body]) {
    if (!rootEl) continue;
    const inlineCss = rootEl.getAttribute('style');
    if (inlineCss && UNSUPPORTED_COLOR_FN_RE.test(inlineCss)) {
      rootEl.setAttribute('style', normalizeCssColorFunctions(inlineCss));
    }
  }
}

export async function captureElementToCanvas(
  element: HTMLElement,
  options: Parameters<typeof html2canvas>[1] = {}
): Promise<HTMLCanvasElement> {
  const userOnClone = options?.onclone;
  return html2canvas(element, {
    ...options,
    onclone: (clonedDoc, clonedEl) => {
      sanitizeClonedTreeForHtml2Canvas(clonedDoc, element, clonedEl);
      userOnClone?.(clonedDoc, clonedEl);
    },
  });
}
