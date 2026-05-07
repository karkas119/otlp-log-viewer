import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "OTLP Log Viewer",
  description:
    "Browse OpenTelemetry log records: severity, time, body, and attributes.",
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
