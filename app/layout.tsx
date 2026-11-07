import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  title: "Premium Compact Lifestyle Edition | Cash on Delivery",
  description: "Compact design, trendy look, and premium build quality. Order now with 100% Cash on Delivery across Bangladesh.",
  keywords: "lifestyle, portable accessories, compact edition, bangladesh, cash on delivery",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Premium Compact Lifestyle Edition | Cash on Delivery",
    description: "Compact design, trendy look, and premium build quality. Order now with 100% Cash on Delivery across Bangladesh.",
    type: "website",
    locale: "bn_BD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
