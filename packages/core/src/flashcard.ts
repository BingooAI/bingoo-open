/**
 * Flashcard + deck content schema (Zod, LLM-authorable). The review scheduling
 * lives in `./srs`. One source of truth: schema → types → component → validator.
 */

import { z } from 'zod'

export const Flashcard = z.object({
  id: z.string().min(1),
  front: z.string().min(1).describe('Front of the card — the prompt (a word, term, or question).'),
  back: z.string().min(1).describe('Back of the card — the answer or definition.'),
  hint: z.string().optional().describe('Optional hint shown before flipping.'),
  example: z.string().optional().describe('Optional example sentence or usage.'),
})

export const FlashcardDeck = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).describe('Deck title.'),
    cards: z.array(Flashcard).min(1).describe('The cards in study order. Card ids must be unique.'),
  })
  .superRefine((deck, ctx) => {
    const seen = new Set<string>()
    for (const c of deck.cards) {
      if (seen.has(c.id))
        ctx.addIssue({
          code: 'custom',
          path: ['cards'],
          message: `duplicate card id "${c.id}" — ids must be unique`,
        })
      seen.add(c.id)
    }
  })

export type Flashcard = z.infer<typeof Flashcard>
export type FlashcardDeck = z.infer<typeof FlashcardDeck>

export function safeParseDeck(data: unknown) {
  return FlashcardDeck.safeParse(data)
}

export function flashcardDeckJsonSchema(): unknown {
  return z.toJSONSchema(FlashcardDeck)
}
