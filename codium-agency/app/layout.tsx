import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codium — Gestão da Agência",
  description: "Sistema interno de gestão da Codium Marketing Agency",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
