import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/shared/toast-provider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocuMind AI — Intelligent Document Workspace",
  description:
    "Next-Gen Document Intelligence platform powered by Google Gemini frontier models. Universal format analysis, multi-sheet spreadsheets, citation-grounded chat, and instant artifact generation.",
  keywords: [
    "DocuMind",
    "AI Document Workspace",
    "Document Analysis",
    "Google Gemini",
    "Gemini 1.5 Pro",
    "Spreadsheet AI",
    "PDF AI Chat",
    "Artifact Generation",
  ],
  authors: [{ name: "DocuMind AI Team" }],
  creator: "DocuMind AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://documind.ai",
    siteName: "DocuMind AI",
    title: "DocuMind AI — Intelligent Document Workspace",
    description:
      "Transform static documents into conversational intelligence. Ingest PDFs, spreadsheets, and Word documents with enterprise privacy and frontier AI reasoning.",
    images: [
      {
        url: "/og-preview.png",
        width: 1200,
        height: 630,
        alt: "DocuMind AI Workspace Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DocuMind AI — Intelligent Document Workspace",
    description:
      "Enterprise-grade document intelligence workspace powered by Google Gemini frontier reasoning.",
    images: ["/og-preview.png"],
    creator: "@documind_ai",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Anti-FOUC theme detector script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storage = localStorage.getItem('documind-ui');
                  var theme = 'system';
                  if (storage) {
                    var parsed = JSON.parse(storage);
                    if (parsed.state && parsed.state.theme) {
                      theme = parsed.state.theme;
                    }
                  }
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary"
      >
        <TooltipProvider delay={200}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
