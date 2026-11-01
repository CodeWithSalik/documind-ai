import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Background Gradient Mesh */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-1/3 -right-32 h-[450px] w-[450px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-purple-500/10 blur-[110px]" />
      </div>

      {/* Top Header with Brand Logo */}
      <header className="w-full py-6 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <Sparkles className="size-5" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">
              DocuMind<span className="text-primary font-extrabold">.AI</span>
            </span>
          </Link>

          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Homepage
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Auth Footer */}
      <footer className="w-full py-6 px-4 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 DocuMind AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="#" className="hover:text-foreground transition-colors">
              Security Notice
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
