import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Insurance",
  description: "Check whether the available sources actually support a recommendation before you act."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
