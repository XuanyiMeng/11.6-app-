'use client';
import { useEffect, useState } from 'react';
import { FILTERS, SCENE, applyFilm, canvasBlob, composeStrip, drawVanity } from '../../lib/photo-effects';
export default function QA() {
  const [status, setStatus] = useState('Running canvas checks…');
  useEffect(() => { void (async () => {
    const check = (value: boolean, label: string) => { if (!value) throw new Error(label); };
    const image = new Image(); image.src = '/vanity-scene.jpg'; await image.decode();
    const fixture = document.createElement('canvas'); fixture.width = 900; fixture.height = 900;
    const fc = fixture.getContext('2d')!;
    fc.fillStyle = '#e04a72'; fc.fillRect(0, 0, 900, 900);
    fc.fillStyle = '#48a5e0'; fc.fillRect(0, 0, 450, 900);
    const summaries: string[] = [];
    for (const filter of FILTERS) {
      const frame = document.createElement('canvas');
      frame.width = filter.id === 'vanity' ? SCENE.width : 900;
      frame.height = filter.id === 'vanity' ? SCENE.height : filter.id === 'polaroid' ? 900 : 675;
      const ctx = frame.getContext('2d')!;
      if (filter.id === 'vanity') {
        drawVanity(ctx, image, fixture, 900, 900);
        const screen = ctx.getImageData(700, 800, 1, 1).data;
        check(screen[0] === 224 && screen[1] === 74 && screen[2] === 114, 'Phone screen was not replaced');
        const original = document.createElement('canvas'); original.width = SCENE.width; original.height = SCENE.height;
        original.getContext('2d')!.drawImage(image, 0, 0);
        for (const [x,y] of [[50,50],[650,610],[700,525],[480,900]]) {
          const a = ctx.getImageData(x,y,1,1).data;
          const b = original.getContext('2d')!.getImageData(x,y,1,1).data;
          check(a.every((v,i) => v === b[i]), `Foreground or background changed at ${x},${y}`);
        }
      } else {
        ctx.drawImage(fixture,0,0,frame.width,frame.height);
        applyFilm(frame,filter.id,123);
        const pixel = ctx.getImageData(700,300,1,1).data;
        if (filter.id === 'vintage') check(Math.abs(pixel[0]-pixel[2]) < 16 && Math.abs(pixel[0]-pixel[1]) < 8, 'Vintage not monochrome');
        if (filter.id === 'polaroid') check(pixel[0] !== 224 && pixel[2] !== 114, 'Polaroid not baked in');
        if (filter.id === 'original') check(pixel[0] === 224 && pixel[1] === 74, 'Original changed');
      }
      const strip = composeStrip([frame,frame,frame,frame],filter.id);
      check(strip.height > frame.height * 4, 'Four shots do not fit');
      check(strip.width * strip.height < 16777216, 'Exceeds mobile canvas budget');
      const blob = await canvasBlob(strip);
      check(blob.type === 'image/png' && blob.size > 10000, 'PNG export failed');
      summaries.push(`${filter.name}: PASS (${strip.width}×${strip.height}, PNG ${blob.size} bytes)`);
    }
    setStatus(summaries.join('\n')+'\nALL CHECKS PASSED');
  })().catch((error) => setStatus(`FAILED: ${error.message}`)); },[]);
  return <pre style={{whiteSpace:'pre-wrap',padding:30}}>{status}</pre>;
}
