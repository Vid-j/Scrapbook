import { z } from "zod";

// Shape of a hand-written conversation fixture (fixtures/*.json).
export const FixtureSchema = z.object({
  book: z.object({
    id: z.string(),
    title: z.string(),
    start_date: z.string(),
    consent_mode: z.enum(["full", "my_messages_only"]),
    partner_consent: z.boolean(),
  }),
  participants: z
    .array(
      z.object({
        id: z.string(),
        display_name: z.string(),
        side: z.enum(["me", "them"]),
        initials: z.string().min(1).max(3),
      }),
    )
    .length(2),
  messages: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      at: z.string(),
      text: z.string(),
      reactions: z.array(z.string()).default([]),
    }),
  ),
});

export type Fixture = z.infer<typeof FixtureSchema>;
