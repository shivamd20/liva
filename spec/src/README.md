# Liva UI

React frontend for the Liva collaborative workspace application.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **tRPC** - Type-safe API client

## Project Structure

```
ui/
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # App-specific styles
│   ├── main.tsx         # Application entry point
│   ├── index.css        # Global styles with Tailwind
│   └── vite-env.d.ts    # Vite type definitions
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── postcss.config.js    # PostCSS configuration
```

## Development

The UI is configured to work with the Cloudflare Worker backend:

- **Dev Server**: `yarn dev:ui` (runs on port 5173)
- **Build**: `yarn build:ui` (outputs to `../public`)
- **API Proxy**: `/api/v1` routes are proxied to `http://127.0.0.1:8787`

## Path Aliases

- `@/*` - Maps to `./src/*`
- `@root/*` - Maps to `../src/*` (worker code)

## Features

- Hot Module Replacement (HMR)
- TypeScript support with strict mode
- Tailwind CSS with dark mode support
- Modern glassmorphism design
- Responsive layout

## API Configuration

The application supports both local storage and remote API backends:

### Local Storage (Default)
By default, boards are stored in browser localStorage. No additional setup required.

### Remote API
To use the remote tRPC API:

1. Copy `ui/.env.example` to `ui/.env`
2. Set `VITE_USE_REMOTE_API=true`
3. Optionally configure `VITE_API_URL` (defaults to `http://localhost:8787/api/v1`)
4. Restart the dev server

The implementation automatically switches based on the `VITE_USE_REMOTE_API` environment variable.
