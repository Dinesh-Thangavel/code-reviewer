import { Card } from '@/components/ui/card'

interface PRCardProps {
  title: string
  status: string
  author: string
}

export function PRCard({ title, status, author }: PRCardProps) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">By {author}</p>
      <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-secondary">
        {status}
      </span>
    </Card>
  )
}
