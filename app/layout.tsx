import './globals.css';
import type { Metadata } from 'next';
import { Poppins, Lora } from 'next/font/google';

/**
 * Type pairing taken from the Roll A Page portfolio: a rounded geometric
 * sans carries everything, heavy and tight for display, light and airy
 * for body. A serif is kept only for family stories set in quotation.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const poppinsDisplay = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif-body',
});

export const metadata: Metadata = {
  title: 'LegacyChain — Sovereign History Vault',
  description:
    'LegacyChain preserves original family records and their provenance, so AI can understand history without being able to silently rewrite it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${poppinsDisplay.variable} ${lora.variable}`}
    >
      <body className="font-sans font-light antialiased">{children}</body>
    </html>
  );
}
