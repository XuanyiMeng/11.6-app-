import { glitterFill } from './glitter-fill';
export type FilterId = 'original' | 'vintage' | 'polaroid' | 'vanity' | 'friend' | 'pixel';
export const FILTERS: { id: FilterId; name: string; subtitle: string }[] = [
  { id: 'original', name: 'Original', subtitle: 'ORIGINAL' },
  { id: 'vintage', name: 'Vintage Mono', subtitle: 'MONO 01' },
  { id: 'polaroid', name: 'Polaroid', subtitle: 'INSTANT 02' },
  { id: 'vanity', name: 'Vanity', subtitle: 'VANITY 03' },
  { id: 'friend', name: 'miss u bitch', subtitle: 'TOGETHER 04' },
  { id: 'pixel', name: 'Pixel Chaos', subtitle: 'PLAY 05' },
];
export const SCENE = { width: 1179, height: 1463, x: 421, y: 315, screenWidth: 374, screenHeight: 813 };
const SCREEN = 'M 470 315 C 435 315 421 337 421 370 L 421 1075 Q 421 1128 469 1128 L 746 1128 Q 795 1128 795 1075 L 795 369 Q 795 315 747 315 Z';
// Foreground objects cross the phone screen. These paths keep the original
// mascara, hair clip and lip gloss in front of the live or captured portrait.
const FOREGROUND = [
  'M 308 475 L 650 593 Q 680 594 704 606 L 780 636 L 771 663 L 692 640 Q 663 630 645 618 L 307 501 Z',
  'M 646 540 Q 644 522 670 491 Q 701 456 746 427 L 810 376 Q 829 367 845 380 L 866 398 L 937 347 L 950 377 L 887 429 Q 849 477 805 510 Q 741 550 680 559 Q 655 559 646 540 Z',
  'M 424 913 Q 445 898 466 879 Q 496 855 515 872 Q 535 892 501 923 Q 485 940 453 951 L 437 958 L 449 975 L 419 989 Z',
];
export function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, x: number, y: number, width: number, height: number, mirror = false) {
  const scale = Math.max(width / sw, height / sh);
  const cropW = width / scale, cropH = height / scale;
  ctx.save();
  if (mirror) { ctx.translate(x + width, y); ctx.scale(-1, 1); }
  else ctx.translate(x, y);
  ctx.drawImage(source, (sw - cropW) / 2, (sh - cropH) / 2, cropW, cropH, 0, 0, width, height);
  ctx.restore();
}
export function drawVanity(ctx: CanvasRenderingContext2D, background: HTMLImageElement, source?: CanvasImageSource, sw = 0, sh = 0, mirror = false) {
  ctx.clearRect(0, 0, SCENE.width, SCENE.height);
  ctx.drawImage(background, 0, 0, SCENE.width, SCENE.height);
  ctx.save();
  ctx.clip(new Path2D(SCREEN));
  if (source && sw && sh) {
    drawCover(ctx, source, sw, sh, SCENE.x, SCENE.y, SCENE.screenWidth, SCENE.screenHeight, mirror);
  } else {
    // Never show the reference model as if it were the user's camera preview.
    ctx.fillStyle = '#dcd6cb';
    ctx.fillRect(SCENE.x, SCENE.y, SCENE.screenWidth, SCENE.screenHeight);
    ctx.fillStyle = glitterFill(ctx);
    ctx.textAlign = 'center';
    ctx.font = '800 28px Arial, Helvetica, sans-serif';
    ctx.fillText('PAPRAZZI ME', 608, 710);
  }
  // Keep the notch and objects above the inserted portrait.
  ctx.fillStyle = '#111110';
  ctx.beginPath();
  ctx.roundRect(552, 328, 113, 31, 18);
  ctx.fill();
  for (const path of FOREGROUND) {
    ctx.save();
    ctx.clip(new Path2D(path));
    ctx.drawImage(background, 0, 0, SCENE.width, SCENE.height);
    ctx.restore();
  }
  ctx.restore();
}
export function applyFilm(canvas: HTMLCanvasElement, filter: FilterId, seed: number) {
  if (filter !== 'vintage' && filter !== 'polaroid') return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not process the photo.');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  let random = seed >>> 0;
  const noise = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296 - .5; };
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = .299 * r + .587 * g + .114 * b;
      const distance = ((x / canvas.width - .5) ** 2 + (y / canvas.height - .5) ** 2) * 2;
      const grain = noise() * (filter === 'vintage' ? 19 : 11);
      if (filter === 'vintage') {
        const tone = 23 + 220 / (1 + Math.exp(-((lum / 255 - .48) * 6.4)));
        const shade = 1 - .30 * distance;
        data[i] = tone * shade * 1.025 + grain;
        data[i + 1] = tone * shade + grain;
        data[i + 2] = tone * shade * .96 + grain;
      } else {
        const shade = 1 - .13 * distance;
        data[i] = (29 + (.80 * r + .20 * lum) * .87) * shade + grain + 6;
        data[i + 1] = (25 + (.78 * g + .22 * lum) * .86) * shade + grain + 2;
        data[i + 2] = (29 + (.72 * b + .28 * lum) * .77) * shade + grain;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}
export function composeStrip(frames: HTMLCanvasElement[], filter: FilterId) {
  const canvas = document.createElement('canvas');
  const vintage = filter === 'vintage';
  const polaroid = filter === 'polaroid';
  const scene = filter === 'vanity';
  const frameW = scene ? SCENE.width : 900;
  const frameH = scene ? SCENE.height : polaroid ? 900 : 675;
  const border = vintage ? 25 : 48;
  const gap = vintage ? 42 : polaroid ? 135 : 24;
  const footer = vintage ? 90 : 140;
  canvas.width = frameW + border * 2;
  canvas.height = border * 2 + frameH * 4 + gap * 3 + footer;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create your strip.');
  ctx.fillStyle = filter === 'friend' ? '#0d080d' : vintage ? '#201c1a' : polaroid ? '#f6f1e7' : '#fffefb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  frames.forEach((frame, index) => {
    const y = border + index * (frameH + gap);
    ctx.drawImage(frame, border, y, frameW, frameH);
    if (vintage) {
      ctx.fillStyle = glitterFill(ctx);
      ctx.font = '800 23px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAPRAZZI ME', canvas.width / 2, y + frameH + 29);
    }
    if (polaroid) {
      ctx.strokeStyle = '#bfb4a24d';
      ctx.lineWidth = 2;
      ctx.strokeRect(border, y, frameW, frameH);
      ctx.fillStyle = glitterFill(ctx);
      ctx.font = '700 25px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`moment ${String(index + 1).padStart(2, '0')}`, canvas.width - border, y + frameH + 60);
    }
  });
  ctx.fillStyle = glitterFill(ctx);
  ctx.textAlign = 'center';
  ctx.font = '900 40px Arial, Helvetica, sans-serif';
  if (!vintage) ctx.fillText('PAPRAZZI ME', canvas.width / 2, canvas.height - 93);
  ctx.font = '800 18px Arial, Helvetica, sans-serif';
  ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(), canvas.width / 2, canvas.height - 43);
  return canvas;
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not save your photo. Please try again.')), 'image/png'));
}
