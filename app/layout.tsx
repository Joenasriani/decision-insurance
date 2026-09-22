import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Insurance",
  description: "Inspect the evidence structure behind a recommendation before action."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
