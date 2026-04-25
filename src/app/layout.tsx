import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writing Buddy",
  description: "AI-powered creative planning for fiction writers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
