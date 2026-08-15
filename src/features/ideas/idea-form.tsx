import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateVideoIdea } from '@/lib/data/hooks'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  ideaSchema,
  type IdeaFormValues,
} from '@/lib/data/ideas'

/**
 * Submitting an idea, behind a dialog so `/ideas` stays list-first — browsing
 * is what most visitors come for, and a permanent two-field form above the
 * board would push it down for everyone.
 *
 * The first place in the codebase to use zod: `zod` and `@hookform/resolvers`
 * were already dependencies but imported nowhere, so real validation costs no
 * new package. The schema is shared with both data adapters, so the form and
 * the database agree on the limits rather than each keeping its own copy.
 */
export function IdeaForm({ visitorId }: { visitorId: string }) {
  const [open, setOpen] = useState(false)
  const create = useCreateVideoIdea(visitorId)

  const form = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaSchema),
    defaultValues: { title: '', description: '' },
  })

  const description = form.watch('description')

  const onSubmit = (values: IdeaFormValues) => {
    create.mutate(values, {
      onSuccess: () => {
        // Reset before closing so reopening is a blank form rather than the
        // last submission — there is no edit path, so a stale value would
        // invite an accidental duplicate.
        form.reset()
        setOpen(false)
        toast.success('Thanks! Your idea is on the board.')
      },
      onError: () =>
        toast.error('Could not post that idea. Try again in a moment.'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          Share an idea <Plus aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share a video idea</DialogTitle>
          <DialogDescription>
            Anyone can vote on it. Posted anonymously — nothing here is tied
            back to you.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Why dark patterns work"
                      maxLength={TITLE_MAX}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What would it cover?</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="A teardown of the consent flows everyone has learned to click through."
                      maxLength={DESCRIPTION_MAX}
                      {...field}
                    />
                  </FormControl>
                  {/* Counting up to the cap rather than warning after it: the
                      textarea is capped anyway, so the number explains why
                      typing stops instead of the input silently going dead. */}
                  <FormDescription className="text-right tabular-nums">
                    {description.length} / {DESCRIPTION_MAX}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Posting…' : 'Post idea'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
