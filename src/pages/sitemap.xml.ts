import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET({ site }: APIContext) {
  const paths =
    import.meta.env.SITE_PREVIEW === "1"
      ? []
      : [
          "/",
          "/experiences/",
          "/concepts/",
          ...(
            await getCollection(
              "experiences",
              (entry) => !entry.data.unlisted && !entry.data.noindex,
            )
          ).map((entry) => `/experiences/${entry.slug}/`),
          ...(
            await getCollection(
              "concepts",
              (entry) => !entry.data.unlisted && !entry.data.noindex,
            )
          ).map((entry) => `/concepts/${entry.slug}/`),
        ];
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escape(new URL(p, site).href)}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
