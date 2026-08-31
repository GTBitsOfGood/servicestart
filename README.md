# ServiceStart

**HEY! Are you the incoming Fall EM? If so, read [the architecture documentation](./docs/ARCHITECTURE.md) - Renato, Spring '26 EM**

ServiceStart is a total rebuild of [Voluntrack](https://github.com/GTBitsOfGood/VolunTrack) - a volunteer and event management platform for nonprofits. See the [Notion](https://www.notion.so/gtbitsofgood/ServiceStart-2efbd5d1ba1580568e70f31b65a81f28).

[![Netlify Status](https://api.netlify.com/api/v1/badges/4c02de3a-8a0a-45e0-8282-349cc70f0705/deploy-status)](https://app.netlify.com/projects/servicestart/deploys)

## Stack

- React: Frontend framework
- Next.js: Backend framework and server-side rendering
- Tailwind CSS: Styling
- Netlify: Hosting and deployment
- PNPM: Package management
- ESLint: Linting
- Prettier: Code formatting
- [Vitest](https://vitest.dev/): Testing
- Unit tests: \_.test.ts files; E2E tests: \_.spec.ts files
- [Playwright](https://playwright.dev/): E2E testing
- [Drizzle ORM](https://orm.drizzle.team/): Database ORM
- PostgreSQL: Database
- [BetterAuth](https://www.better-auth.com/): Authentication
- [BoG Design System](https://github.com/GTBitsOfGood/design-system): UI components
- [Zod](https://zod.dev/): Schema validation
- [Hono](https://hono.dev/): API and RPC framework

## Getting Started

0. Make sure [Docker](https://www.docker.com/products/docker-desktop/) is installed and running. The database and Juno setup steps below both depend on it.

1. Install PNPM if you haven't already:

   ```bash
   npm install -g pnpm
   ```

2. Clone the repository:

   ```bash
   git clone https://github.com/GTBitsOfGood/servicestart.git
   cd servicestart
   ```

3. Create the database:

   ```bash
   pnpm run db:create
   pnpm run db:test:create
   ```

4. Install dependencies

   ```bash
   pnpm install
   ```

5. Set up environment variables:
   - Copy `.env.template` to `.env` and fill in the required values.
   - Generate your `BETTER_AUTH_SECRET` using the following command:

     ```bash
     openssl rand -base64 32
     ```

6. Set up Juno:
   - Run `git submodule update --init --recursive` to initialize the Juno submodule.
   - Run `pnpm run juno:setup` to seed Juno and add an API key to your `.env` file.

7. Start the server:

   ```bash
   pnpm run dev
   ```

## Other Tools

- Dependabot is enabled and will submit PRs to update dependencies.
- PRs automatically create preview deployments on Netlify for easy UX testing.
- There's a pre-commit hook for Prettier. If you get an error when committing, click "Show command output" in the popup to see the issue.
- Use `pnpm run db:view` to open Drizzle Studio and view the database schema and contents.
- Use the `createTestUser` function in `tests/unit/testUtils.ts` to get a user that you can use for API endpoints in tests.
- Use `pnpx bog-cli design edit` to configure the BoG design system.
- Run scripts in the `scripts` folder with `pnpx tsx <script-name>`.
- Run `pnpm run email:setup` to connect SendGrid and register the email domain with Juno.
- Set the `DB_URL` environment variable on GitHub. For the preview environment, leave out the `/database-name` part so that the workflow can create databases for each PR.

## Docs & Writeups

Various parts of ServiceStart's architecture and design decisions are documented in the `docs` folder. Check it out for details about our design decisions and infrastructure.

## Debugging

- The db docker containers run on `5432` and `5433`, so if there is a program already using those ports, then it will fail to start these containers.
- If juno set up is hanging, it could just mean the juno containers are hanging, so just stop it and retry the set up.
