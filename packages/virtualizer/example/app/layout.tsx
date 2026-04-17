import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtualizer Test App",
  description: "Performance test harness for @zenbu/virtualizer",
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
