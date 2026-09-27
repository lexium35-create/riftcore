import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Riftcore",
  description: "MLBB tournament operations and competitive infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
