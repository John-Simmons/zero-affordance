import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { SurveyResults } from '@/features/surveys/survey-results'
import { useSubmitSurveyResponse, useSurveyAggregate } from '@/lib/data/hooks'
import type { AnswerValue, Survey } from '@/lib/data/types'
import { getVisitorId } from '@/lib/visitor'

type FormValues = Record<string, AnswerValue>

function buildDefaults(survey: Survey): FormValues {
  const defaults: FormValues = {}
  for (const q of survey.questions) {
    if (q.type === 'multiple_choice') defaults[q.id] = []
    else if (q.type === 'scale') defaults[q.id] = q.min ?? 1
    else defaults[q.id] = ''
  }
  return defaults
}

export function SurveyRunner({ survey }: { survey: Survey }) {
  const [submitted, setSubmitted] = useState(false)
  const form = useForm<FormValues>({ defaultValues: buildDefaults(survey) })
  const submit = useSubmitSurveyResponse()
  const aggregate = useSurveyAggregate(submitted ? survey.id : undefined)

  const onSubmit = (values: FormValues) => {
    submit.mutate(
      { surveyId: survey.id, visitorId: getVisitorId(), answers: values },
      {
        onSuccess: () => {
          setSubmitted(true)
          toast.success('Thanks! Your response is in the results below.')
        },
        onError: () =>
          toast.error('Something went wrong submitting your response.'),
      },
    )
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live results</CardTitle>
        </CardHeader>
        <CardContent>
          <SurveyResults
            survey={survey}
            aggregate={aggregate.data}
            isLoading={aggregate.isLoading}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {survey.questions.map((q) => (
          <FormField
            key={q.id}
            control={form.control}
            name={q.id}
            rules={
              q.required ? { required: 'Please answer this question.' } : {}
            }
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">{q.prompt}</FormLabel>
                {q.helpText && <FormDescription>{q.helpText}</FormDescription>}
                <FormControl>
                  <div>
                    {q.type === 'single_choice' && (
                      <RadioGroup
                        value={(field.value as string) || ''}
                        onValueChange={field.onChange}
                        className="gap-2"
                      >
                        {q.options?.map((opt) => (
                          <Label
                            key={opt.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal hover:bg-muted/50"
                          >
                            <RadioGroupItem value={opt.id} />
                            {opt.label}
                          </Label>
                        ))}
                      </RadioGroup>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="grid gap-2">
                        {q.options?.map((opt) => {
                          const selected = (field.value as string[]) ?? []
                          const checked = selected.includes(opt.id)
                          return (
                            <Label
                              key={opt.id}
                              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  field.onChange(
                                    value
                                      ? [...selected, opt.id]
                                      : selected.filter((id) => id !== opt.id),
                                  )
                                }
                              />
                              {opt.label}
                            </Label>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'scale' && (
                      <div className="space-y-3 pt-2">
                        <Slider
                          min={q.min ?? 1}
                          max={q.max ?? 5}
                          step={1}
                          value={[Number(field.value ?? q.min ?? 1)]}
                          onValueChange={([v]) => field.onChange(v)}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{q.minLabel ?? q.min ?? 1}</span>
                          <span className="font-medium text-foreground">
                            {String(field.value ?? q.min ?? 1)}
                          </span>
                          <span>{q.maxLabel ?? q.max ?? 5}</span>
                        </div>
                      </div>
                    )}

                    {q.type === 'text' && (
                      <Textarea
                        placeholder="Type your answer…"
                        value={(field.value as string) ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit & see results'}
        </Button>
      </form>
    </Form>
  )
}
