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
  title: "Inhaliq | Premium Official Cash on Delivery Store",
  description: "Official online store for genuine products. Order now with 100% Cash on Delivery across Bangladesh.",
  keywords: "inhaliq, official store, lifestyle, accessories, bangladesh, cash on delivery",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Inhaliq | Premium Official Cash on Delivery Store",
    description: "Official online store for genuine products. Order now with 100% Cash on Delivery across Bangladesh.",
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
