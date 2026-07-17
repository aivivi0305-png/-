import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Taste Engine — 好みをAIに教えるハブ";
const description = "保存する、答える、解釈を直す。その繰り返しで、自分でも言葉にできない好みをAIに学習してもらう個人用ハブ。";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1200, height: 630, alt: "Taste Engine — 整った構造に、少しの揺らぎ。" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
