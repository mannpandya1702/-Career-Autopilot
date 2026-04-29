import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Career Autopilot',
  description: 'Personal job-application automation system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
