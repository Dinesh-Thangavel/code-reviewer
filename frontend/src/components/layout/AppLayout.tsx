import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="app-grid flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
        <Header onMenuToggle={toggleSidebar} />

        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-auto max-w-6xl space-y-6 pb-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
