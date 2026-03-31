import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RxSordle \u2014 Daily Pharmacology Sorting Game',
  description: 'Sort pharmacology drugs and categories \u2014 a daily NBEO prep game for optometry students.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>{children}</body>
    </html>
  );
}
