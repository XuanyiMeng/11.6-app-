import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PAPRAZZI ME Photo Booth', short_name: 'PAPRAZZI ME',
    description: 'Your pocket paparazzi. Make it iconic.', start_url: '/', scope: '/',
    display: 'standalone', background_color: '#080608', theme_color: '#080608',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
