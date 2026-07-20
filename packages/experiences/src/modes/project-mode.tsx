import { Card, Checkbox, Progress } from '@bingoo.ai/ui-web'
import { useState } from 'react'
import { EmptyState } from '../shared'
import type { ExperienceLabels, LearnProjectData } from '../types'

/** Project workspace: brief + checklist nhiệm vụ (tick thật, tiến độ) + khu làm việc. */
export function ProjectMode({ project, labels }: { project?: LearnProjectData; labels: ExperienceLabels }) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  if (!project) return <EmptyState>{labels.empty}</EmptyState>
  const total = project.tasks.length
  const doneCount = project.tasks.filter((tk) => done[tk.id]).length
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-4 lg:grid-cols-[1fr_1.3fr]">
      <Card className="flex h-fit flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{project.title}</h2>
        <p className="text-sm text-foreground-muted">{project.brief}</p>
        <Progress value={total > 0 ? (doneCount / total) * 100 : 0} />
        <ul className="flex flex-col gap-2">
          {project.tasks.map((tk) => (
            <li key={tk.id}>
              <Checkbox
                checked={Boolean(done[tk.id])}
                onChange={(e) => setDone((d) => ({ ...d, [tk.id]: e.target.checked }))}
              >
                {tk.label}
              </Checkbox>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="grid min-h-64 place-items-center rounded-2xl border-2 border-dashed border-border bg-surface-muted p-6 text-center text-sm text-foreground-muted">
        {project.workspaceLabel}
      </Card>
    </div>
  )
}
