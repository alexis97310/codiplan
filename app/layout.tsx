import type { Metadata } from "next";

import { t } from "@/lib/i18n/fr";

import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nom"),
  description: t("app.description"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
