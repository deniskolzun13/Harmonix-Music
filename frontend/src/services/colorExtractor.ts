export interface ExtractedPalette {
  primary: string;
  secondary: string;
  glow: string;
}

const DEFAULT_PALETTE: ExtractedPalette = {
  primary: 'rgba(30, 58, 138, 0.45)',
  secondary: 'rgba(88, 28, 135, 0.35)',
  glow: '#3b82f6',
};

const paletteCache = new Map<string, ExtractedPalette>();

export function extractCoverPalette(imageUrl?: string): Promise<ExtractedPalette> {
  if (!imageUrl) return Promise.resolve(DEFAULT_PALETTE);
  if (paletteCache.has(imageUrl)) return Promise.resolve(paletteCache.get(imageUrl)!);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;

        let rSumTop = 0, gSumTop = 0, bSumTop = 0, countTop = 0;
        let rSumBottom = 0, gSumBottom = 0, bSumBottom = 0, countBottom = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;

          // Игнорируем слишком темные и слишком светлые пиксели
          if (brightness > 25 && brightness < 235) {
            const pixelIdx = i / 4;
            if (pixelIdx < 512) {
              rSumTop += r;
              gSumTop += g;
              bSumTop += b;
              countTop++;
            } else {
              rSumBottom += r;
              gSumBottom += g;
              bSumBottom += b;
              countBottom++;
            }
          }
        }

        const r1 = countTop ? Math.round(rSumTop / countTop) : 37;
        const g1 = countTop ? Math.round(gSumTop / countTop) : 99;
        const b1 = countTop ? Math.round(bSumTop / countTop) : 235;

        const r2 = countBottom ? Math.round(rSumBottom / countBottom) : 124;
        const g2 = countBottom ? Math.round(gSumBottom / countBottom) : 58;
        const b2 = countBottom ? Math.round(bSumBottom / countBottom) : 237;

        const res: ExtractedPalette = {
          primary: `rgba(${r1}, ${g1}, ${b1}, 0.50)`,
          secondary: `rgba(${r2}, ${g2}, ${b2}, 0.35)`,
          glow: `rgb(${r1}, ${g1}, ${b1})`,
        };

        paletteCache.set(imageUrl, res);
        resolve(res);
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => resolve(DEFAULT_PALETTE);
    setTimeout(() => resolve(DEFAULT_PALETTE), 1200);
  });
}
