import type { Metadata, Viewport } from 'next'
import './globals.css'
export const metadata: Metadata = {
 metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
 icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' }], apple: '/apple-icon.png' },
 title: 'Tuaha Shaikh',
 description: 'Tuaha Shaikh. Software engineering, full-stack development, and artificial intelligence. An interactive exploration.',
 appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
 other: { 'mobile-web-app-capable': 'yes' },
 openGraph: { title: 'Tuaha Shaikh — Software Engineer', description: 'Building thoughtful software. Full Stack / AI / Experiments.', type: 'website', images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Tuaha Shaikh — Software Engineer' }] },
 twitter: { card: 'summary_large_image', title: 'Tuaha Shaikh — Software Engineer', images: ['/opengraph-image'] },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#a0a5b1' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="en" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem('portfolio-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}history.scrollRestoration='manual';window.scrollTo(0,0);window.addEventListener('pageshow',function(){window.scrollTo({top:0,left:0,behavior:'instant'})},{once:true});` }} /></head><body>{children}</body></html>
}
