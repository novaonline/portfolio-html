import { defineCollection, z } from "astro:content";

const experiences = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    resumeId: z.string().optional(),
    projectId: z.string().optional(),
    siteOnly: z.boolean().default(false),
    unlisted: z.boolean().default(false),
    noindex: z.boolean().default(false),
    rss: z.boolean().default(true),
  }),
});

export const collections = { experiences };
