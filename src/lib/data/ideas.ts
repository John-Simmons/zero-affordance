import { z } from 'zod'

import type { VideoIdeaInput } from '@/lib/data/types'

/**
 * Shape and limits for a submitted idea.
 *
 * Backend-agnostic and shared by every writer (non-negotiable #3): the form
 * validates with it, and BOTH adapters normalise through it before storing. So
 * the mock rejects exactly what the Postgres `check` constraints reject, rather
 * than the two drifting apart and the mock accepting rows Supabase would spit
 * back.
 *
 * The limits are not arbitrary. 80 characters keeps a title to one line in the
 * list; 500 keeps a description skimmable and bounds what a single submission
 * can dump onto a public page.
 */
export const TITLE_MAX = 80
export const DESCRIPTION_MAX = 500

export const ideaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the idea a title.')
    .max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`),
  description: z
    .string()
    .trim()
    .min(1, 'Say a little about the idea.')
    .max(
      DESCRIPTION_MAX,
      `Keep the description under ${DESCRIPTION_MAX} characters.`,
    ),
})

export type IdeaFormValues = z.infer<typeof ideaSchema>

/**
 * Validate and trim, or throw.
 *
 * Called inside both adapters rather than trusted from the form, because the
 * form is not the only possible caller and a stored row is forever — there is
 * no UPDATE path to fix one later.
 */
export function normalizeIdea(input: VideoIdeaInput): VideoIdeaInput {
  return ideaSchema.parse(input)
}
