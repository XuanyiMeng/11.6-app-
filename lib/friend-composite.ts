import { drawPhotoCaption, type PhotoCaption } from './photo-caption';
import { drawCover } from './photo-effects';

export type LightSample = { rgb: number[]; brightness: number; spread: number };
export type FriendCutout = { canvas: HTMLCanvasElement; light: LightSample; name: string };
export type FriendPlacement = { x: number; y: number; scale: number; flip: boolean; match: number };
export const DEFAULT_PLACEMENT: FriendPlacement = { x: .73, y: .54, scale: .86, flip: false, match: .75 };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function sampleLight(source: CanvasImageSource, width: number, height: number): LightSample {
  const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 36;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, width, height, 0, 0, 48, 36);
  const pixels = ctx.getImageData(0, 0, 48, 36).data;
  const neutral = [0,0,0], all = [0,0,0];
  let count = 0, total = 0, left = 0, right = 0, lc = 0, rc = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 180) continue;
    const color = [pixels[i],pixels[i+1],pixels[i+2]];
    const lum = color[0]*.2126 + color[1]*.7152 + color[2]*.0722;
    if (lum < 28 || lum > 240) continue;
    color.forEach((value, channel) => all[channel] += value); total++;
    if ((i / 4) % 48 < 24) { left += lum; lc++; } else { right += lum; rc++; }
    // Estimate the illuminant from low-chroma surfaces rather than matching
    // the friend's skin color to the user's complexion.
    if (Math.max(...color) - Math.min(...color) < 38 && lum > 65) {
      color.forEach((value, channel) => neutral[channel] += value); count++;
    }
  }
  const rgb = count > 20 ? neutral.map((v) => v / count) : all.map((v) => v / Math.max(total, 1));
  return { rgb: total ? rgb : [128,128,128], brightness: total ? (all[0]*.2126 + all[1]*.7152 + all[2]*.0722)/total : 128, spread: lc && rc ? clamp((right/rc-left/lc)/255, -.22, .22) : 0 };
}

export function harmonizeFriend(friend: FriendCutout, target: LightSample, strength: number) {
  const canvas = document.createElement('canvas');
  canvas.width = friend.canvas.width; canvas.height = friend.canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(friend.canvas, 0, 0);
  if (!strength) return canvas;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sourceMean = Math.max(1, friend.light.rgb.reduce((a,b) => a+b,0)/3);
  const targetMean = Math.max(1, target.rgb.reduce((a,b) => a+b,0)/3);
  const exposure = clamp(Math.pow(Math.max(1,target.brightness)/Math.max(1,friend.light.brightness), .4), .76, 1.24);
  const gains = target.rgb.map((value, i) => 1 + (clamp((value/targetMean) / Math.max(.2,friend.light.rgb[i]/sourceMean), .83, 1.17) * exposure - 1) * strength);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (!pixels.data[i+3]) continue;
    const x = (i/4)%canvas.width / canvas.width;
    const light = 1 + (x-.5) * (target.spread-friend.light.spread) * strength * .65;
    for (let c = 0; c < 3; c++) pixels.data[i+c] = clamp(pixels.data[i+c] * gains[c] * light, 0, 255);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
export function friendBounds(person: FriendCutout, placement: FriendPlacement, width: number, height: number) {
  const h = height * placement.scale;
  const w = h * person.canvas.width / person.canvas.height;
  return { x: width * placement.x - w/2, y: height * placement.y - h/2, width: w, height: h };
}
export function drawFriend(ctx: CanvasRenderingContext2D, person: FriendCutout, placement: FriendPlacement, image: CanvasImageSource = person.canvas) {
  const bounds = friendBounds(person, placement, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(bounds.x + (placement.flip ? bounds.width : 0), bounds.y);
  if (placement.flip) ctx.scale(-1,1);
  // Subpixel feathering prevents a hard sticker edge without painting a fake
  // drop shadow that could contradict the camera's lighting direction.
  ctx.filter = 'blur(0.35px)';
  ctx.drawImage(image, 0, 0, bounds.width, bounds.height);
  ctx.restore();
}
export function drawFriendPhoto(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, person: FriendCutout, placement: FriendPlacement, caption?: PhotoCaption) {
  drawCover(ctx, source, sw, sh, 0, 0, ctx.canvas.width, ctx.canvas.height, true);
  const light = sampleLight(ctx.canvas, ctx.canvas.width, ctx.canvas.height);
  drawFriend(ctx, person, placement, harmonizeFriend(person, light, placement.match));
  if (caption) drawPhotoCaption(ctx, caption);
}
