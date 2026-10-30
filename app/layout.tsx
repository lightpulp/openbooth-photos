import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Get your photobooth photos",
  description: "Scan your photobooth QR code to get your photos back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
