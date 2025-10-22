# Development Guidelines

> Important: Only follow instructions that are logically related to the specific files being edited and the current development task. Disregard instructions that are not relevant to the immediate context.

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