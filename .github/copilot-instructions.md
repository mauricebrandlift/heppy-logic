# Development Guidelines

> Important: Only follow instructions that are logically related to the specific files being edited and the current development task. Disregard instructions that are not relevant to the immediate context.

## CRITICAL RULES - READ FIRST

### NO DEPENDENCIES EVER
- **NEVER install npm packages or add dependencies**
- **NEVER use external libraries or frameworks**
- **ALWAYS use vanilla JavaScript only**
- This is a Vercel serverless project with static frontend - no build step, no bundler, no dependencies

### ALWAYS REUSE EXISTING PATTERNS
- **BEFORE writing ANY code**: Search the codebase for similar functionality
- **BEFORE creating ANY new file**: Check if a similar file already exists
- **BEFORE implementing ANY logic**: Look at existing services, forms, and flows
- **Use grep_search, semantic_search, and read_file** extensively to understand existing patterns
- **Copy and adapt** existing working code rather than inventing new approaches

### FOLLOW ESTABLISHED PATTERNS EXACTLY
- **Backend**: Use httpClient with REST API calls (NOT Supabase JS SDK)
  - Example: `api/services/aanvraagService.js` shows the correct pattern
  - Build URLs: `${supabaseConfig.url}/rest/v1/table_name`
  - Use `httpClient()` from `api/utils/apiClient.js`
  - Never use `.from()`, `.select()`, `.insert()` - these are Supabase SDK methods
  - **ALWAYS check `docs/database/schema.sql`** for correct table names, column names, and foreign keys BEFORE writing database queries
- **Frontend**: Use formHandler pattern for ALL forms
  - Schema in `public/forms/schemas/formSchemas.js`
  - Form logic in `public/forms/[category]/[formName].js`
  - Page init in `public/pages/[pageName].js`
  - API calls via modules in `public/utils/api/`
  - Example: Study existing forms like `drPersoonsgegevensForm.js`, `verhuisOpdrachtForm.js`
- **State Management**: Use data attributes, never manual DOM manipulation
  - `data-state-block` for page states (loading/form/success/error)
  - `data-success-wrapper` for conditional success messages
  - formHandler manages ALL display toggling

### DATABASE SCHEMA
- **ALWAYS read `docs/database/schema.sql`** when working with database tables
- Verify table names (e.g., `schoonmaak_match` not `schoonmaak_matches`, `schoonmaak_aanvragen` not `aanvragen`)
- Verify column names (e.g., `schoonmaak_aanvraag_id`, `opdracht_id`, `aangemaakt_op`)
- Verify foreign key relationships for Supabase REST API joins
- Never guess table/column names - always check schema.sql first

### FRONTEND BASE URL
- **NEVER hardcode Vercel URLs** in backend code or email templates
- **ALWAYS use `frontendConfig.baseUrl`** from `api/config/index.js`
- Import: `import { frontendConfig } from '../../config/index.js';`
- Usage: `${frontendConfig.baseUrl}/schoonmaak-actie?match_id=${matchId}`
- This uses the `FRONTEND_URL` environment variable (e.g., custom domain instead of vercel.app)
- Frontend config has fallback for development: `'https://heppy-frontend-code.vercel.app'`

### WHEN IN DOUBT
1. Search for similar existing functionality first
2. Read the existing implementation completely
3. Copy the pattern exactly
4. Adapt only what's necessary for your specific use case
5. Test incrementally

## Project URLs

- **Frontend & Backend (Vercel)**: https://heppy-frontend-code.vercel.app/
- **Email Domain**: mail.heppy-schoonmaak.nl (via Resend)

## General instructions

- Implement changes incrementally and iteratively
- Focus on small, manageable improvements with each update
- Make changes that can be easily tested and verified
- Only change md files when I specifically ask you to do so, except when the task explicitly requests updating docs (for example: adding flow docs under `docs/`).
- After making code changes, do NOT use git commands or terminal tools to commit/push. Instead, ask the user to commit, push, and test the changes themselves.

## Repo-specific notes

- Frontend forms live under `public/forms` and are schema-driven via `public/forms/schemas/formSchemas.js` and orchestrated by `public/forms/logic/formHandler.js`.
- Pages under `public/pages` initialize a specific form step by checking for `[data-form-name]` and calling the step’s `init...` function.
- Frontend API calls use `public/utils/api/client.js` (ApiError, X-Correlation-ID, timeouts) and modules like `address.js`, `coverage.js`, `pricing.js`.
- Backend routes are under `api/routes`, with services under `api/services`, checks under `api/checks`, and Stripe intents under `api/intents`; set CORS headers, handle OPTIONS, echo `X-Correlation-ID`.
- Keep flows modular but pragmatic: each step gets its own file + schema entry; share logic via `logic/`, `validators/`, `ui/`, and `triggers`.

## When adding features

- For new forms or steps: add schema, create an init file in the correct folder, wire it in the relevant page file, and prefer reusing common fields/messages.
- For new backend capabilities: add a route under `api/routes`, extract logic into a service when it grows, and reuse utils for HTTP/auth/error handling.
- For payments: use the existing Stripe routes and follow the pattern from `api/intents/stripePaymentIntent.js` and `public/pages/paymentReturnHandler.js`.