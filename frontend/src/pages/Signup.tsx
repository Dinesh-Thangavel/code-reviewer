import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'

export function Signup() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel flex w-full max-w-md items-center gap-4 rounded-[1.75rem] border border-border/60 p-6 shadow-lg">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Redirecting to sign in</p>
          <p className="text-sm text-muted-foreground">Account creation is handled through your Git provider.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  )
}
