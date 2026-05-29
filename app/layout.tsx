import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joseki Atelier",
  description: "An elegant Go joseki study board for modeling opening patterns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
