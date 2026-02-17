import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import PropertyTypeNav from "../components/PropertyTypeNav";
import FooterAdminParserLink from "../components/FooterAdminParserLink";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Batumi Real Estate",
  description: "Real estate listings aggregated from Telegram channels in Batumi"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`page-shell ${manrope.className}`}>
        <header className="border-b bg-blue-50/80 backdrop-blur">
          <div className="container flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-semibold">
                  BA
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    Batumi Real Estate
                  </h1>
                  <p className="text-xs text-slate-500">
                    Aggregated listings from Telegram
                  </p>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
              <PropertyTypeNav />
            </div>
          </div>
        </header>
        <main className="page-main">
          <div className="container py-5 md:py-8">{children}</div>
        </main>
        <footer className="border-t bg-white/70">
          <div className="container py-4 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
            <span>Batumi real estate aggregator MVP</span>
            <span className="flex items-center gap-3">
              <span>Data from public Telegram channels</span>
              <FooterAdminParserLink />
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
