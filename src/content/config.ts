import { defineCollection, z } from "astro:content";

const experiences = defineCollection({
  type: "content",
  schema: z.object({
    type: z.literal("article"),
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    concepts: z.array(z.string()).default([]),
    status: z.enum(["draft", "stable", "deprecated"]).optional(),
    tags: z.array(z.string()).default([]),
    resumeId: z.string().optional(),
    projectId: z.string().optional(),
    siteOnly: z.boolean().default(false),
    unlisted: z.boolean().default(false),
    noindex: z.boolean().default(false),
    rss: z.boolean().default(true),
  }),
});

const concepts = defineCollection({
  type: "content",
  schema: z.object({
    type: z.literal("concept"),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    concepts: z.array(z.string()).default([]),
    status: z.enum(["draft", "stable", "deprecated"]).optional(),
    unlisted: z.boolean().default(false),
    noindex: z.boolean().default(false),
    rss: z.boolean().default(false),
  }),
});

export const collections = { experiences, concepts };
