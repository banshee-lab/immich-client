# Repository instructions

## Commands

Use pnpm (the repository has a `pnpm-lock.yaml`).

- `pnpm dev` — start the Next.js development server.
- `pnpm build` — create the production build.
- `pnpm start` — serve the production build.
- `pnpm lint` — run the configured Next.js ESLint checks.
- `pnpm exec tsc --noEmit` — run the TypeScript check.

There is currently no test script or test runner configured, so there is no single-test command.

## Architecture

- This is a Next.js 15 App Router application. Routes and layouts live under `src/app`; `src/app/(dashboard)` is a route group for the authenticated album and people pages. `src/middleware.ts` delegates route authorization to NextAuth in `src/auth.ts`.
- The root route redirects to `/album`. The dashboard layout provides the shared menu and NextAuth session context; interactive pages/components opt into client rendering with `'use client'`.
- Immich API access is centralized in `src/server/api.ts`. It reads the current NextAuth access token for requests and exposes server actions for albums, people, and thumbnails. Keep API credentials and calls on the server.
- PostgreSQL access is centralized in `src/server/repository.ts`. It stores album/person associations in `albums_persons`; `personId` holds Immich's `personGroupId`, paired with the owning Immich `userId`. Adding a person also invokes the database function that inserts that person's assets into the linked album.
- `doc/persons.sql` defines the association table, asset insertion function, and trigger against Immich's `album`, `album_asset`, and `asset_face` tables. The README says scripts in `doc` must be run manually against the Immich database; changes to this schema/behavior may therefore need matching SQL changes and explicit database setup.
- The `@/*` import alias maps to `src/*`. Reuse the existing `src/server` modules for backend access rather than adding database/API calls to UI components.

## Repository-specific conventions

- Keep the distinction between server components and client components: data-loading galleries are async server components, while interactive album/person management uses client components and calls server actions.
- Environment defaults and names are defined in `src/env/environment.ts`. Check this file when changing deployment configuration: it currently reads `SESSION_SECRET` (the README lists `NEXTAUTH_SECRET`) and appends `/api` to `IMMICH_URL` (the README example includes `/api`).
- Production builds use Next.js standalone output, which the `Dockerfile` copies into a distroless Node image. The publish workflow builds and pushes that image from `master`.
