import { ToastProvider, ToastViewport } from "@/components/ui/toast"
import { ToastImplementation } from "@/components/ui/toast-implementation"

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
      <ToastImplementation />
    </ToastProvider>
  )
}
