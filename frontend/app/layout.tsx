import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import PropertyTypeNav from "../components/PropertyTypeNav";
import FooterAdminParserLink from "../components/FooterAdminParserLink";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Недвижимость Батуми",
  description: "Объявления о недвижимости из Telegram-каналов Батуми"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru-RU">
      <body className={`page-shell ${manrope.className}`}>
        <header className="w-full border-b bg-blue-50/80 backdrop-blur">
          <div className="container flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <Link href="/" className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold">
                  BA
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    Недвижимость Батуми
                  </h1>
                  <p className="text-xs text-slate-500">
                    Объявления из Telegram
                  </p>
                </div>
              </Link>
            </div>
            <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
              <Suspense fallback={<div className="h-11 w-full md:w-[520px]" />}>
                <PropertyTypeNav />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="page-main w-full">
          <div className="container py-5 md:py-8">{children}</div>
        </main>
        <footer className="w-full border-t bg-white/70">
          <div className="container py-4 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
            <span>Агрегатор недвижимости Батуми</span>
            <span className="flex flex-wrap items-center gap-3">
              <span>Данные из публичных Telegram-каналов</span>
              <FooterAdminParserLink />
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
