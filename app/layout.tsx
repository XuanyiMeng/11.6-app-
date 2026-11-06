import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PAPRAZZI ME — Photo Booth',
  description: 'Your pocket paparazzi. Black, pink, and main-character energy.',
  applicationName: 'PAPRAZZI ME',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PAPRAZZI ME' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#080608',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
