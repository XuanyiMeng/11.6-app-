'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import VanityPreview from './vanity-preview';
import FriendStudio from './friend-studio';
import PixelStudio from './pixel-studio';
import { createPixelRenderer, emptyPixelState, type PixelState } from '../lib/pixel-play';
import { DEFAULT_CAPTION, type PhotoCaption } from '../lib/photo-caption';
import { DEFAULT_PLACEMENT, drawFriendPhoto, type FriendCutout, type FriendPlacement } from '../lib/friend-composite';
import { FILTERS, SCENE, applyFilm, canvasBlob, composeStrip, drawVanity, type FilterId } from '../lib/photo-effects';

type CameraState = 'loading' | 'ready' | 'denied' | 'missing' | 'error';
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function Icon({ name, size = 22 }: { name: 'camera' | 'arrow' | 'share' | 'spark' | 'close'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'camera' && <><path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>}
    {name === 'arrow' && <><path d="m10 5-7 7 7 7M3 12h18"/></>}
    {name === 'share' && <><path d="M12 16V2m-5 5 5-5 5 5M5 11H3v10h18V11h-2"/></>}
    {name === 'spark' && <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>}
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6"/>}
  </svg>;
}

export default function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const capturing = useRef(false);
  const fileRef = useRef<File | null>(null);
  const resultUrl = useRef<string | null>(null);
  const [pixel, setPixel] = useState<PixelState>(emptyPixelState);
  const [caption, setCaption] = useState<PhotoCaption>({...DEFAULT_CAPTION});
  const [friend, setFriend] = useState<FriendCutout | null>(null);
  const [friendPlacement, setFriendPlacement] = useState<FriendPlacement>({...DEFAULT_PLACEMENT});
  const [friendProcessing, setFriendProcessing] = useState(false);
  const [filter, setFilter] = useState<FilterId>('original');
  const [scenePhotos, setScenePhotos] = useState<{ url: string; file: File }[]>([]);
  const sceneUrls = useRef<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [camera, setCamera] = useState<CameraState>('loading');
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [strip, setStrip] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const request = ++generation.current;
    stopCamera();
    setCamera('loading');
    setNotice('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setNotice(window.isSecureContext ? 'This browser does not support the camera. Try Safari or Chrome.' : 'The camera needs a secure connection. Open this app over HTTPS, or use localhost on this computer.');
        setCamera('error');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1920 } },
      });
      if (!mounted.current || request !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (streamRef.current === stream && mounted.current) setCamera('error');
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (request === generation.current && mounted.current) setCamera('ready');
      }
    } catch (error) {
      if (!mounted.current || request !== generation.current) return;
      stopCamera();
      const name = error instanceof DOMException ? error.name : '';
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'missing' : 'error');
    }
  }, [stopCamera]);

  useEffect(() => {
    mounted.current = true;
    void startCamera();
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      mounted.current = false;
      generation.current++;
      stopCamera();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      sceneUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [startCamera, stopCamera]);

  async function takePhotos() {
    if (capturing.current || camera !== 'ready' || !videoRef.current || (filter === 'friend' && (!friend || friendProcessing))) return;
    capturing.current = true;
    setBusy(true);
    setNotice('');
    const token = generation.current;
    const active = () => mounted.current && token === generation.current && document.visibilityState !== 'hidden';
    const pixelRenderer = filter === 'pixel' ? createPixelRenderer(900,675) : null;
    try {
      const frames: HTMLCanvasElement[] = [];
      let scene: HTMLImageElement | undefined;
      if (filter === 'vanity') {
        scene = new Image();
        scene.src = '/vanity-scene.jpg';
        await scene.decode();
      }
      for (let i = 0; i < 4; i++) {
        setShot(i);
        for (let number = 3; number > 0; number--) {
          if (!active()) throw new Error('Capture paused. Keep the app open and try again.');
          setCountdown(number);
          await pause(800);
        }
        setCountdown(null);
        if (!active()) throw new Error('Capture paused. Keep the app open and try again.');
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth || !streamRef.current?.active) {
          throw new Error('The camera was interrupted. Please try again.');
        }
        const frame = document.createElement('canvas');
        frame.width = filter === 'vanity' ? SCENE.width : 900;
        frame.height = filter === 'vanity' ? SCENE.height : filter === 'polaroid' ? 900 : 675;
        const context = frame.getContext('2d');
        if (!context) throw new Error('Could not create your photo. Please try again.');
        if (pixelRenderer) {
          pixelRenderer.render(context, video, video.videoWidth, video.videoHeight, pixel);
        } else if (filter === 'friend' && friend) {
          drawFriendPhoto(context, video, video.videoWidth, video.videoHeight, friend, friendPlacement, caption);
        } else if (scene) {
          drawVanity(context, scene, video, video.videoWidth, video.videoHeight, true);
        } else {
          const bounds = video.getBoundingClientRect();
          const guide = guideRef.current?.getBoundingClientRect();
          if (!guide) throw new Error('Please try the camera again.');
          const ratio = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
          const sourceWidth = guide.width / ratio;
          const sourceHeight = guide.height / ratio;
          const sourceX = video.videoWidth - (guide.left - bounds.left + (video.videoWidth * ratio - bounds.width) / 2) / ratio - sourceWidth;
          const sourceY = (guide.top - bounds.top + (video.videoHeight * ratio - bounds.height) / 2) / ratio;
          context.save();
          context.translate(frame.width, 0);
          context.scale(-1, 1);
          context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, frame.width, frame.height);
          context.restore();
          applyFilm(frame, filter, Date.now() + i);
        }
        frames.push(frame);
        setFlash(true);
        setShot(i + 1);
        await pause(130);
        setFlash(false);
        await pause(400);
      }
      if (!active()) throw new Error('Capture paused. Please try again.');
      const canvas = composeStrip(frames, filter);
      const blob = await canvasBlob(canvas);
      const photos = filter === 'vanity' || filter === 'friend' || filter === 'pixel' ? await Promise.all(frames.map(async (frame, index) => {
        const photo = await canvasBlob(frame);
        return { url: URL.createObjectURL(photo), file: new File([photo], `paprazzi-me-${filter}-${Date.now()}-${index + 1}.png`, { type: 'image/png' }) };
      })) : [];
      if (!mounted.current) { photos.forEach((photo) => URL.revokeObjectURL(photo.url)); return; }
      sceneUrls.current.forEach((url) => URL.revokeObjectURL(url));
      sceneUrls.current = photos.map((photo) => photo.url);
      setScenePhotos(photos);
      setActivePhoto(0);
      fileRef.current = new File([blob], `paprazzi-me-${Date.now()}.png`, { type: 'image/png' });
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = URL.createObjectURL(blob);
      setStrip(resultUrl.current);
      stopCamera();
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      pixelRenderer?.dispose();
      capturing.current = false;
      if (mounted.current) { setBusy(false); setCountdown(null); setFlash(false); }
    }
  }

  async function saveStrip(all = false) {
    const photo = !all ? scenePhotos[activePhoto] : undefined;
    const file = photo?.file ?? fileRef.current;
    const downloadUrl = photo?.url ?? strip;
    if (!file || !strip || saving) return;
    setSaving(true);
    setNotice('');
    try {
      const isPhone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isPhone && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PAPRAZZI ME' });
      } else {
        const link = document.createElement('a');
        link.href = downloadUrl!;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setNotice(photo ? 'Your scene photo is downloading.' : 'Your photo strip is downloading.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setNotice('Sharing could not open. Try again, or touch and hold the strip to save it.');
      }
    } finally { setSaving(false); }
  }

  function retake() {
    setStrip(null);
    setScenePhotos([]);
    sceneUrls.current.forEach((url) => URL.revokeObjectURL(url));
    sceneUrls.current = [];
    fileRef.current = null;
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setShot(0);
    void startCamera();
  }

  return <main className={`booth filter-${filter} ${strip ? 'results' : ''} ${filter === 'vanity' ? 'scene-mode' : ''}`}>
    {!strip && <video className="live-camera" ref={videoRef} autoPlay playsInline muted aria-label="Live front camera preview" />}
    {!strip && <div className="camera-shade" />}
    <header className="topbar">
      <a className="wordmark" href="/" aria-label="PAPRAZZI ME home"><span className="brand-icon"><Icon name="camera" size={18}/></span><span className="glitter-text">PAPRAZZI </span><span className="brand-me"><span className="glitter-text">ME</span></span><span className="wordmark-dot"><span className="glitter-text">★</span></span></a>
      <button className="help-button" aria-label="How it works" onClick={() => setHelp(true)}><span className="glitter-text">?</span></button>
    </header>

    {strip ? <>
      <section className="result-content">
        <div className="eyebrow"><Icon name="spark" size={14}/><span className="glitter-text"> YOU ARE THE MOMENT</span></div>
        <h1><span className="glitter-text">MAIN CHARACTER.</span></h1>
        <p><span className="glitter-text">{scenePhotos.length ? filter === 'pixel' ? 'WARPED FACE. BLOCKY BESTIES.' : filter === 'friend' ? 'MILES APART. IN THE SAME FRAME.' : 'YOUR PHOTO. HER PHONE. YOUR MOMENT.' : filter === 'vintage' ? 'VINTAGE MONO · FILM GRAIN · SOFT VIGNETTE' : filter === 'polaroid' ? 'WARM TONES · FADED COLOR · INSTANT FRAMES' : '4 SHOTS. ZERO APOLOGIES.'}</span></p>
        <div className={`strip-wrap ${scenePhotos.length ? 'scene-result-wrap' : ''}`}><img className="photo-strip" src={scenePhotos[activePhoto]?.url ?? strip} alt={scenePhotos.length ? filter === 'pixel' ? `Pixel Chaos photo ${activePhoto + 1} with your face warp and pixel pals` : filter === 'friend' ? `Photo ${activePhoto + 1} with your friend` : `Photo ${activePhoto + 1} inside the vanity phone screen` : 'Your four photos in a photo strip'} /></div>
        {scenePhotos.length > 0 && <div className="photo-picker" role="group" aria-label="Choose a photo">{scenePhotos.map((photo, index) => <button key={photo.url} aria-label={`View photo ${index + 1}`} aria-pressed={index === activePhoto} disabled={saving} onClick={() => { setActivePhoto(index); setNotice(''); }}><img src={photo.url} alt=""/><span><span className="glitter-text">{String(index + 1).padStart(2, '0')}</span></span></button>)}</div>}
      </section>
      <footer className="result-controls">
        <p className="save-hint"><span className="glitter-text">TOO GOOD TO STAY IN DRAFTS.</span></p>
        <div className="result-actions"><button className="secondary-button" onClick={retake} disabled={saving}><Icon name="arrow" size={18}/><span className="glitter-text"> Retake</span></button><button className="primary-button" onClick={() => void saveStrip()} disabled={saving}><Icon name="share" size={18}/> <span className="glitter-text">{saving ? 'Opening…' : scenePhotos.length ? 'Save photo' : 'Save strip'}</span></button></div>
        {scenePhotos.length > 0 && <button className="save-all-button" disabled={saving} onClick={() => void saveStrip(true)}><span className="glitter-text">Save all four as a strip ↗</span></button>}
        <p className="result-note"><span className="glitter-text">On iPhone, choose “Save Image” in the share sheet.</span></p>
        {notice && <p className="notice" role="status"><span className="glitter-text">{notice}</span></p>}
      </footer>
    </> : <>
      <section className="viewfinder" aria-label="Photo booth">
        {filter === 'pixel' && <PixelStudio video={videoRef} ready={camera === 'ready'} busy={busy} state={pixel} onChange={setPixel}/>}
        {filter === 'friend' && <FriendStudio video={videoRef} ready={camera === 'ready'} busy={busy} person={friend} placement={friendPlacement} onPerson={setFriend} onPlacement={setFriendPlacement} onProcessing={setFriendProcessing} caption={caption} onCaption={setCaption}/>}
        {filter === 'vanity' && <VanityPreview video={videoRef} ready={camera === 'ready'}/> }
        {camera === 'ready' ? <>
          <div className="camera-status"><span className="live-dot"/> <span className="glitter-text">{busy ? `CAPTURING ${Math.min(shot + 1, 4)} OF 4` : 'LIVE · FRONT CAMERA'}</span></div>
          <div ref={guideRef} className="crop-guide"><i/><i/><i/><i/><span className="frame-label"><span className="glitter-text">YOUR PHOTO FRAME</span></span></div>
          {!busy && filter !== 'vanity' && filter !== 'friend' && filter !== 'pixel' && <div className="camera-caption"><span><span className="glitter-text">MAKE IT ICONIC.</span></span><p><span className="glitter-text">YOUR LIFE. YOUR COVER SHOT.</span></p></div>}
        </> : <div className="camera-message">
          <span className="permission-icon"><Icon name="camera" size={30}/></span>
          <div className="eyebrow"><span className="glitter-text">YOUR POCKET PAPARAZZI</span></div>
          <h1><span className="glitter-text">{camera === 'loading' ? 'HEY, SUPERSTAR.' : camera === 'denied' ? 'Let’s see that smile.' : camera === 'missing' ? 'A camera, please.' : 'A little camera trouble.'}</span></h1>
          <p><span className="glitter-text">{camera === 'loading' ? 'Allow your camera. You are the main character.' : camera === 'denied' ? 'Your camera is turned off for this site. Your photos stay on your device, always.' : camera === 'missing' ? 'We couldn’t find a camera. Connect one, then try again.' : notice || 'Your camera may be in use by another app. Close it there, then try again.'}</span></p>
          {camera === 'denied' && <div className="permission-help"><strong><span className="glitter-text">To turn your camera on</span></strong><p><span className="glitter-text">In Safari, open the page menu beside the address bar → Website Settings → Camera → Allow. In Chrome, open the site controls beside the address → Permissions → Camera → Allow.</span></p><p><span className="glitter-text">Then tap Try again. If it’s still blocked, reload the page.</span></p></div>}
          {camera === 'loading' ? <span className="loading-dots" aria-label="Waiting for camera"><i/><i/><i/></span> : <button className="small-button" onClick={() => void startCamera()}><span className="glitter-text">Try again </span><span><span className="glitter-text">↗</span></span></button>}
        </div>}
        {countdown !== null && <div className="countdown" key={`${shot}-${countdown}`} aria-hidden="true"><span className="glitter-text">{countdown}</span></div>}
      </section>
      <footer className="camera-controls">
        <div className="session-label"><span className="session-line"/><span className="glitter-text">FOUR PHOTOS. ONE LITTLE MOMENT.</span><span className="session-line"/></div>
        <div className="shutter-row"><div className="shot-indicator" aria-label={`${shot} of 4 photos captured`}>{[0,1,2,3].map((index) => <span key={index} className={index < shot ? 'filled' : ''}/>)}</div><button className={`shutter ${busy ? 'shooting' : ''}`} onClick={() => void takePhotos()} disabled={camera !== 'ready' || busy || (filter === 'friend' && (!friend || friendProcessing))} aria-label={busy ? 'Taking four photos' : 'Take four photos'}><span>{busy && <span className="shutter-square"/>}</span></button><div className="shot-count"><span><span className="glitter-text">{busy ? String(shot).padStart(2,'0') : '04'}</span></span><small><span className="glitter-text">FRAMES</span></small></div></div>
        <div className="filter-carousel" role="group" aria-label="Photo filters">{FILTERS.map((item) => <button key={item.id} className={`filter-option ${filter === item.id ? 'selected' : ''}`} aria-pressed={filter === item.id} disabled={busy} onClick={(event) => { setFilter(item.id); setNotice(''); event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}><span className={`filter-swatch swatch-${item.id}`}>{item.id === 'pixel' ? <span className="pixel-swatch"><span className="glitter-text">▦</span></span> : item.id === 'friend' ? <span className="friend-swatch-heart"><span className="glitter-text">♡</span></span> : item.id === 'vanity' ? <img src="/vanity-scene.jpg" alt=""/> : <span/>}</span><span className="filter-name"><span className="glitter-text">{item.name}</span></span><span className="filter-subtitle"><span className="glitter-text">{item.subtitle}</span></span></button>)}</div>
        <p className="shutter-hint"><span className="glitter-text">{busy ? 'A new pose in 3, 2, 1…' : camera === 'ready' ? filter === 'pixel' ? 'WARP IT. ADD PALS. GET WEIRD.' : filter === 'friend' ? friend ? 'CLOSER, EVEN FROM FAR AWAY.' : 'ADD YOUR PERSON. MAKE A MEMORY.' : 'PRESS. POSE. REPEAT.' : 'NO RULES. JUST YOU.'}</span></p>
        <div className="privacy-line"><span className="tiny-lock"><span className="glitter-text">⌑</span></span><span className="glitter-text"> Just you and your camera. Nothing uploaded.</span></div>
        {notice && camera === 'ready' && <p className="notice" role="status"><span className="glitter-text">{notice}</span></p>}
      </footer>
    </>}
    <div className="sr-only" aria-live="polite"><span className="glitter-text">{countdown ? `Photo ${shot + 1} of 4. ${countdown}` : strip ? 'Your photo strip is ready.' : ''}</span></div>
    {flash && <div className="flash"/>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') setHelp(false); }}><button autoFocus className="sheet-close" aria-label="Close instructions" onClick={() => setHelp(false)}><Icon name="close"/></button><Icon name="spark" size={28}/><h2 id="help-title"><span className="glitter-text">PAPRAZZI ME.</span></h2><ol><li><span className="glitter-text">Allow your front camera.</span></li><li><span className="glitter-text">Tap the shutter. You get a 3–2–1 before each of four photos.</span></li><li><span className="glitter-text">Save your strip, or retake for another cover shot.</span></li></ol><p><span className="glitter-text">To install on iPhone: open in Safari, tap Share, then Add to Home Screen.</span></p><button className="primary-button" onClick={() => setHelp(false)}><span className="glitter-text">Got it</span></button></section></div>}
  </main>;
}
