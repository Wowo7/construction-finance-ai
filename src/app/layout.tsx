import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Construction Finance AI Assistant",
  description:
    "Ask questions about your construction project budgets in plain English",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white min-h-screen">{children}</body>
    </html>
  );
}
