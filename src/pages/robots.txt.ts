import type { APIContext } from "astro";
export function GET({ site }: APIContext) {
  return new Response(
    import.meta.env.SITE_PREVIEW === "1"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", site)}\n`,
    { headers: { "Content-Type": "text/plain" } },
  );
}
