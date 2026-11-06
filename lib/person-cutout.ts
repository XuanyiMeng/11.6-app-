import type { FriendCutout } from './friend-composite';
import { initializeMediaPipe, withMediaPipeDiagnostics } from './mediapipe-diagnostics';
import { sampleLight } from './friend-composite';

// One model initialization at a time; reset on failure so Retry really retries.
let segmenterPromise: Promise<import('@mediapipe/tasks-vision').ImageSegmenter> | null = null;
async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = initializeMediaPipe(async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('/mediapipe');
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/selfie-multiclass.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
      });
    }).catch((error) => { segmenterPromise = null; throw error; });
  }
  return segmenterPromise;
}
export async function cutOutPerson(file: File, progress: (message: string) => void): Promise<FriendCutout> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Please choose an image smaller than 25 MB.');
  if (!file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP photo.');
  progress('Reading your photo…');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try { image.src = url; await image.decode(); }
  catch { throw new Error('This image could not be read. Try a JPG or PNG.'); }
  finally { URL.revokeObjectURL(url); }
  const source = document.createElement('canvas');
  const scale = Math.min(1, 1400/Math.max(image.naturalWidth,image.naturalHeight));
  source.width = Math.max(1,Math.round(image.naturalWidth*scale));
  source.height = Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Image processing is unavailable here. Try Safari or Chrome.');
  ctx.drawImage(image,0,0,source.width,source.height);
  const light = sampleLight(source,source.width,source.height);
  progress('Preparing your cutout. The first run takes a moment…');
  const segmenter = await getSegmenter().catch(() => { throw new Error('Person detection could not start. Reload or try Safari or Chrome.'); });
  progress('Finding your person and refining the edges…');
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const result = withMediaPipeDiagnostics(() => segmenter.segment(source));
  try {
    const mask = result.confidenceMasks?.[0];
    if (!mask) throw new Error('We could not find a person. Try a clearer portrait.');
    const background = mask.getAsFloat32Array();
    const matte = document.createElement('canvas'); matte.width = mask.width; matte.height = mask.height;
    const mc = matte.getContext('2d')!;
    const alpha = mc.createImageData(mask.width,mask.height);
    let foreground = 0;
    for (let i=0;i<background.length;i++) {
      // Class 0 is background. Smooth the confidence transition, preserving
      // soft hair edges while suppressing uncertain background speckles.
      const confidence = Math.max(0,Math.min(1,((1-background[i])-.12)/.76));
      const a = confidence*confidence*(3-2*confidence);
      alpha.data[i*4]=255; alpha.data[i*4+1]=255; alpha.data[i*4+2]=255; alpha.data[i*4+3]=Math.round(a*255);
      if (a>.6) foreground++;
    }
    if (foreground/background.length < .012 || foreground/background.length > .99) throw new Error('Try a clear portrait with a simple background.');
    mc.putImageData(alpha,0,0);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(matte,0,0,source.width,source.height);
    ctx.globalCompositeOperation='source-over';
    const pixels=ctx.getImageData(0,0,source.width,source.height).data;
    let left=source.width,top=source.height,right=0,bottom=0;
    for(let y=0;y<source.height;y++) for(let x=0;x<source.width;x++) {
      if(pixels[(y*source.width+x)*4+3]>32) { left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x); bottom=Math.max(bottom,y); }
    }
    if(right<=left||bottom<=top) throw new Error('No person found. Please try another photo.');
    left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(source.width-1,right+3);bottom=Math.min(source.height-1,bottom+3);
    const cutout=document.createElement('canvas');cutout.width=right-left+1;cutout.height=bottom-top+1;
    cutout.getContext('2d')!.drawImage(source,left,top,cutout.width,cutout.height,0,0,cutout.width,cutout.height);
    return {canvas:cutout,light,name:file.name};
  } finally { result.close(); }
}
