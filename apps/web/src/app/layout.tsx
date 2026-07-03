import type { Metadata, Viewport } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Career Autopilot',
    template: '%s · Career Autopilot',
  },
  description: 'Personal job-application automation. Discover, tailor, verify, submit.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0FDFA' },
    { media: '(prefers-color-scheme: dark)', color: '#042F2E' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
