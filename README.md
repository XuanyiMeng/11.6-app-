# PAPRAZZI ME

A phone-first Next.js photo booth. Photos are processed locally in canvas and never uploaded.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Allow the camera, then tap the shutter. A 3–2–1 countdown runs before each of four mirrored photos. The corner guides show the exact 4:3 crop. Save shares a PNG file on compatible phones and downloads it on desktop. Retake starts a new session.

## iPhone and installation

Camera access and file sharing require a secure context. `localhost` works on the computer running the server; a phone visiting a laptop's HTTP LAN address will need HTTPS instead. Deploy with HTTPS or use a trusted HTTPS development tunnel to test on a physical iPhone.

In Safari, tap Share → Add to Home Screen → Open as Web App. The manifest, PNG icons, Apple standalone metadata, safe-area spacing, and production-only service worker are included. The app caches its shell after the first production visit.

If access is denied, open Safari's page menu → Website Settings → Camera → Allow, then retry or reload. Chrome's site controls also expose camera permissions.

## Checks

```sh
npm run typecheck
npm run build
npm start
```

For manual device QA, check allow/deny/retry, all four countdowns and flashes, the mirrored crop, Retake, Save Image on iOS, share cancellation, desktop PNG download, rotation, safe areas, backgrounding during capture, and the installed standalone app.

## Filters

Swipe the selector below the shutter. Original remains available alongside three added styles:

- **复古黑白 / MONO:** lightly warm monochrome, film grain, lifted shadows and vignette, with a dark vintage strip.
- **宝丽来 / INSTANT:** warm faded color, soft contrast and grain, square photos and generous instant-film borders.
- **梳妆时刻 / VANITY:** the provided reference scene with the live portrait and each captured photo composited into the phone screen. Original foreground cosmetics remain above the portrait. After four shots, select 01–04 and save that individual scene, or save the full four-scene strip.

Film effects are baked into exported PNG pixels. Standard film live previews use CSS approximations; the vanity preview and saved scene share the same canvas compositor. Capture locks filter selection until processing completes. Retake preserves the selected style.

The original user-provided scene asset is at `public/vanity-scene.jpg`. No generated replacement asset is used.

A browser canvas smoke-check fixture is retained at `scripts/fixtures/filter-qa.tsx`. To rerun locally, temporarily copy it to `app/filter-qa/page.tsx`, visit `/filter-qa`, and then remove that temporary route. It uses synthetic colored input, checks the phone insertion and foreground/background preservation, verifies mono/color processing, and exports all four strip formats as PNGs within a mobile-friendly canvas area.

## miss u bitch — long-distance friend filter

Select the heart filter, then add a clear, single-person JPG, PNG, or WebP photo (up to 25 MB). The local MediaPipe person model removes its background and trims the transparent edges. Both the model and its WebAssembly runtime are served by this app; no photo is sent to an external inference service.

Drag the person in the 4:3 viewfinder; pinch, drag the corner handle, or use the size slider to resize (20–180%). Flip mirrors the friend, Reset restores the initial placement, and × removes the photo. Keyboard users can focus the frame and use arrow keys and +/−. A new upload replaces the previous person only after successful extraction. Cancel and error states keep any existing cutout available.

Light matching estimates brightness, a restrained illuminant correction from neutral surfaces, and a gentle left/right brightness gradient. It preserves the original face and textures and provides an adjustable strength (0–100%). It cannot reconstruct physical shadows or change a strong original light source's direction; use similarly lit source photos for the best result. Preview and export use the same crop and compositor, with light estimates refreshed during preview and recalculated for each captured frame.

The four shots can be viewed and saved individually or saved together as a strip. Uploaded cutouts persist when switching filters or retaking and are kept only in page memory. Reloading clears them.

Every camera uses the same compact dock, with a fixed viewport and a separate flexible preview region so the vanity scene stays fully above the controls. Safe-area padding remains included.

Development fixture: `scripts/fixtures/friend-qa.tsx` verifies actual segmentation, transparency, lighting strength and alpha preservation, four positions/scales/flips, PNG export, and exposes the real interactive editor. Temporarily copy it to `app/friend-qa/page.tsx`, download the public MediaPipe portrait test image as `public/qa-portrait.jpg`, and visit `/friend-qa`. Remove the temporary route and image afterward. See `THIRD_PARTY_NOTICES.md` for model/runtime sources.

## PAPRAZZI ME identity and photo captions

The app, installed-app manifest, Apple metadata, home-screen icons, share filenames, and printed photo-strip branding use **PAPRAZZI ME**. The UI uses black and hot pink, system sans-serif fonts, small star accents, and an original procedural SVG glitter pattern (`public/pink-glitter.svg`).

In the friend filter, type up to 80 characters in the photo-text field. Drag the `✥ 文字` handle (or focus it and use arrow keys) to position the caption. The style button exposes font size and pink/white/black colors. Both preview and export use `drawPhotoCaption`, so text is baked into each saved PNG and into the full four-shot strip. Clearing the field removes the caption. Editing is locked while capturing.

MediaPipe's native startup message `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` is informational. Its WASM runtime caches the stderr logger during initialization. `lib/mediapipe-diagnostics.ts` installs a narrowly scoped adapter during initialization and synchronous inference, rerouting only that exact message to `console.info`, forwarding real errors, and restoring the logger in `finally`. This prevents Next's development overlay from treating normal model startup as an app error. Reload an already-open development page once to clear the previously cached native logger.

Regression check: `node scripts/test-mediapipe-diagnostics.mjs` covers synchronous errors, async initialization, a cached runtime stderr function, restoration on failure, and real error forwarding. The friend browser fixture additionally checks multilingual caption pixels and PNG export.

## English Barbie-glitter typography

All product UI copy, camera guidance, upload progress/errors, filter names, alt text, and accessible labels are English. Document language is `en`, and the printed date uses `en-US`. User-entered captions remain exactly as typed.

Text runs use a shared pink-glitter CSS treatment without clipping the parent button backgrounds. Typed caption text receives the same treatment, with a visible caret and readable placeholder. Forced-colors mode falls back to system text colors. Canvas captions and printed strip lettering use the deterministic procedural glitter fill in `lib/glitter-fill.ts`; pink, silver, and dark caption colors each retain their glitter texture in the exported PNG.

## Pixel Chaos — freehand face warp and pixel pals

Choose **Pixel Chaos**. In **Face warp**, keep your face in the 4:3 frame and drag any part of it to pull, stretch, or squash the image. Brush size controls the affected radius; Undo restores the last drag (20 steps), Reset face clears deformation while keeping stickers, and Reset all clears both. This is freehand liquify in frame coordinates, not automatic head tracking.

Switch to **Pixel pals** to add original block-style Piggy, Kitty, Slime, Grass block, Mushroom, and Heart sprites. Add up to 12; tap a pal to select it, drag to move, pinch or drag its corner to resize, or use the size slider. Arrow keys move the selection; Delete/Backspace or Remove deletes it. Pixel art remains crisp in saved images. Switching filters and retaking retain the warp and stickers.

The preview uses a 480×360 WebGL displacement map and the final photos render at 900×675 with the same normalized deformation and sticker coordinates. A CPU bilinear fallback supports browsers without WebGL. Four captures can be saved individually or together as a photo strip. Editor controls lock during capture, and selection handles are excluded from exports.

The development fixture `scripts/fixtures/pixel-qa.tsx` can temporarily be copied to `app/pixel-qa/page.tsx`. It checks correct orientation/cropping, non-destructive deformation, all six sticker types in PNG output, exact reset behavior, four-shot export, and CPU fallback. The same fixture exposes the real drag, undo, selection, and size controls for browser verification. Remove the temporary route after testing.
