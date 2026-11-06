# Third-party components

- `@mediapipe/tasks-vision` (Apache-2.0), from Google MediaPipe. Its version-matched WebAssembly runtime is copied into `public/mediapipe/`. When updating this dependency, copy the matching contents of `node_modules/@mediapipe/tasks-vision/wasm/` again.
- The MediaPipe SelfieMulticlass 256×256 float32 model is bundled at `public/models/selfie-multiclass.tflite`. Source: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite . Model information: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter . MediaPipe models and code are provided under Apache-2.0; see https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE .

The development segmentation check uses Google's public `portrait.jpg` test image at https://storage.googleapis.com/mediapipe-assets/portrait.jpg . It is not included in the app's shipped assets.
