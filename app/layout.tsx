import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarPet Açaí",
  description: "O joguinho de açaí de Macapá. Jogue, ganhe cupom e concorra a 1 litro de açaí.",
};

export const viewport: Viewport = {
  themeColor: "#3a1052",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
