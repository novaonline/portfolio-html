import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
  const items = (
    await getCollection(
      "experiences",
      (entry) => !entry.data.unlisted && entry.data.rss !== false
    )
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: "Manny — Experiences",
    description: "How/why notes on architecture, data, and ops.",
    site: context.site?.toString() ?? "https://example.com",
    items: items.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: `/experiences/${entry.slug}/`,
    })),
  });
}
