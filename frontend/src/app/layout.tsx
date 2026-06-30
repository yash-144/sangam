import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const GeistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const GeistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sangam-stellar.vercel.app'),
  title: {
    default: 'sangam. — Rotating Savings on Stellar',
    template: '%s — sangam.',
  },
  description: 'Sangam — rotating savings on Stellar. A smart contract holds the pot, not a person.',
  openGraph: {
    title: 'sangam.',
    description: 'Rotating savings on Stellar. A smart contract holds the pot, not a person.',
    siteName: 'sangam.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
