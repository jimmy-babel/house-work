# Repository Guidelines

## Project Structure & Module Organization

This is a UniApp application built with Vue 3 and Vite. Application code lives in `src/`: `pages/` contains route views, `components/` shared UI, `services/` backend access, `composables/` reusable state, `constants/` shared values, and `utils/` helpers. Static assets are in `src/static/`. The database schema and policies are in `supabase/schema.sql`. `scripts/import-source-xlsx.mjs` imports the root `源数据.xlsx` workbook into Supabase; update the workbook before running the importer.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run dev:h5` starts the H5 development server.
- `npm run dev:mp-weixin` starts the WeChat Mini Program development build.
- `npm run build:h5` builds H5 output; `npm run build:mp-weixin` builds the WeChat Mini Program.
- `npm run sync:source` imports the workbook data into Supabase.

There is no configured test, lint, or format script. Do not run build commands by default; run `npm run build:*` only when the user explicitly asks for a build or build verification.

## Coding Style & Naming Conventions

Follow the existing Vue single-file component and JavaScript patterns. Use PascalCase for component filenames (for example, `AppShell.vue`), lower-case route directories, and camelCase for JavaScript functions and variables. Keep changes focused and consistent with nearby code; no formatter or linter is configured.

## Testing Guidelines

Automated tests and coverage requirements are not currently defined. For UI changes, check the affected H5 or Mini Program flow. For database or import changes, review the corresponding SQL or script and verify against a development Supabase project when available.

## Supabase Schema Changes

When a change requires updating Supabase tables, policies, constraints, or other database structure, update the repository SQL source as needed and include the complete, change-specific SQL in the final response for the user to copy into Supabase. Clearly state where and in what order to run it, and do not apply database changes to Supabase on the user's behalf.

## Commit & Pull Request Guidelines

Recent commit subjects (`update`, `house-work`) do not establish a consistent convention. Use a short, imperative summary that explains the change. PRs should describe behavior and affected targets, link related issues when applicable, and include screenshots for visible UI changes. Call out schema, environment, or source-workbook changes.

## Security & Configuration

Copy `.env.example` to `.env.local` and configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the app. `SUPABASE_SERVICE_ROLE_KEY` is only for the local import script; never expose it in client code or commit populated environment files.
