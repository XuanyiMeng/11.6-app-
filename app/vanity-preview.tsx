'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { drawVanity, SCENE } from '../lib/photo-effects';

export default function VanityPreview({ video, ready }: { video: RefObject<HTMLVideoElement | null>; ready: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const image = new Image();
    let animation = 0;
    let cancelled = false;
    let last = 0;
    const paint = (time: number) => {
      if (cancelled) return;
      const ctx = canvas.current?.getContext('2d');
      const source = video.current;
      if (ctx && time - last > 45) {
        drawVanity(ctx, image, ready && source && source.readyState >= 2 ? source : undefined, source?.videoWidth, source?.videoHeight, true);
        last = time;
      }
      animation = requestAnimationFrame(paint);
    };
    image.onload = () => { if (!cancelled) animation = requestAnimationFrame(paint); };
    image.onerror = () => { if (!cancelled) setFailed(true); };
    image.src = '/vanity-scene.jpg';
    return () => { cancelled = true; cancelAnimationFrame(animation); };
  }, [video, ready]);
  return <div className="vanity-preview"><canvas ref={canvas} width={SCENE.width} height={SCENE.height} aria-label="Vanity scene preview. Your photo appears inside the phone screen."/>{failed && <p role="alert"><span className="glitter-text">The scene could not load. Please reload and try again.</span></p>}</div>;
}
