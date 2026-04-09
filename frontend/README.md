# AI Code Review Dashboard

A modern React dashboard application built with Vite, TypeScript, and TailwindCSS.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Component library
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Recharts** - Chart library
- **Lucide React** - Icon library

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── layout/         # Layout components (Header, Layout)
│   ├── ui/             # shadcn/ui components
│   ├── dashboard/      # Dashboard-specific components
│   └── pr/             # PR-related components
├── pages/              # Page components
├── data/               # Mock data and data utilities
└── lib/                # Utility functions and helpers
```

## Features

- ✅ Modern React with TypeScript
- ✅ TailwindCSS configured with CSS variables
- ✅ shadcn/ui components ready to use
- ✅ React Router for navigation
- ✅ React Query for data management
- ✅ Recharts for data visualization
- ✅ Lucide React icons
- ✅ Path aliases configured (@/ for src/)

## Path Aliases

The project uses path aliases for cleaner imports:

- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/pages` → `src/pages`
- `@/data` → `src/data`
