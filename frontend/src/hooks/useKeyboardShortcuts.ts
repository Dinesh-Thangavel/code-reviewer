/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const shortcuts: Shortcut[] = [
      {
        key: 'k',
        ctrl: true,
        action: () => {
          // Open command palette (to be implemented)
          toast({
            title: 'Command Palette',
            description: 'Press Ctrl+K to open command palette (coming soon)',
          })
        },
        description: 'Open command palette',
      },
      {
        key: 'd',
        ctrl: true,
        action: () => navigate('/dashboard'),
        description: 'Go to Dashboard',
      },
      {
        key: 'p',
        ctrl: true,
        action: () => navigate('/pull-requests'),
        description: 'Go to Pull Requests',
      },
      {
        key: 'r',
        ctrl: true,
        action: () => navigate('/repositories'),
        description: 'Go to Repositories',
      },
      {
        key: 'i',
        ctrl: true,
        action: () => navigate('/insights'),
        description: 'Go to Insights',
      },
      {
        key: 's',
        ctrl: true,
        action: () => navigate('/settings'),
        description: 'Go to Settings',
      },
      {
        key: '/',
        action: () => {
          // Focus search (to be implemented)
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
        },
        description: 'Focus search',
      },
    ]

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      const shortcut = shortcuts.find((s) => {
        const keyMatch = s.key.toLowerCase() === e.key.toLowerCase()
        const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey

        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (shortcut) {
        e.preventDefault()
        shortcut.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate, toast])
}
