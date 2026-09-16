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

Use Node.js compatible with the installed Next.js version and pnpm 10.17.1 (`npm install -g pnpm@10.17.1`). Install Git, OpenSSL, and Docker Desktop with Docker Compose v2 supporting `watch` and optional `env_file` entries. Keep Docker running. Existing scripts require a POSIX shell; on Windows, use WSL2 with Docker Desktop integration.

1. Clone and install dependencies:

   ```bash
   git clone https://github.com/GTBitsOfGood/servicestart.git
   cd servicestart
   pnpm install
   ```

2. Configure the environment:

   ```bash
   cp .env.template .env
   openssl rand -base64 32
   ```

   Put the generated value in `BETTER_AUTH_SECRET`. The other template defaults support local PostgreSQL, local file storage, and **simulated email**. `JUNO_API_KEY` is generated below. Each variable's comment explains when it is required; Azure/file-provider credentials are unnecessary for local storage.

   For simulated email, use `SENDGRID_KEY=SG.test-sendgrid-key`. Juno's SDK requires the `SG` prefix even in simulation. If you already have a `.env`, replace a blank value or the old `test-key` placeholder manually; updating `.env.template` does not update `.env`.

3. Create PostgreSQL and wait until it accepts connections:

   ```bash
   pnpm run db:create
   docker exec servicestart-db pg_isready -U dev -d postgres
   ```

   Repeat the readiness check until it reports “accepting connections.” For an existing container, use `pnpm run db:start` instead of creating it again.

4. Initialize and seed Juno:

   ```bash
   git submodule update --init --recursive
   RUN_MODE=reseed pnpm --dir juno start:dev:live-all
   ```

   Keep this command running in its own terminal. It installs Juno dependencies, starts its services, resets Juno's
   separate internal database, and creates the test superadmin and seed project used by `juno:setup`.

   On Windows, run the equivalent commands in WSL2, or use PowerShell:

   ```powershell
   $env:RUN_MODE = "reseed"
   pnpm.cmd --dir juno start:dev:live-all
   ```

   In a second terminal, provision the Juno API key:

   ```bash
   pnpm run juno:setup
   ```

   This writes the generated API key to your local `.env`.

5. Apply the schema and create development data:

   ```bash
   pnpm run db:migrate
   pnpm run db:seed
   ```

   Seeding creates the default ServiceStart organization, sample data, and accounts. Sign in with `owner@example.com` or `admin@example.com`, password `password123`. These credentials are for local development only.

6. Start the application:

   ```bash
   pnpm run dev
   ```

   Keep this terminal open. In another terminal, once Juno is ready, provision email:

   ```bash
   pnpm run email:setup
   ```

   Open http://localhost:3000 and sign in. Invite a test address or send a member email to exercise the local flow. Default Juno uses `NODE_ENV=test`: it simulates domain registration and accepts emails without delivering them. Its DNS records are fake and must not be published. A successful request here does **not** prove inbox delivery.

For the Visionaries tenant, see [Visionaries development setup](docs/VISIONARIES_DEVELOPMENT.md)
for local URLs, branding defaults, and student/admin test accounts.

### Real email (team-assisted)

Ask an infrastructure maintainer for an approved SendGrid key and sender domain. Set `SENDGRID_KEY` and `EMAIL_SENDER_DOMAIN` in your local `.env`; the domain is the base domain, such as `example.org`, without a URL scheme or the `mail.` prefix. The app sends as `<org-slug>@mail.<domain>`.

Stop the running `dev` process, then run:

```bash
pnpm run juno:stop
pnpm run juno:start:email-live
```

Keep that terminal open. In a second terminal run `pnpm run email:setup`. Have the maintainer publish the returned DNS records and confirm domain authentication in SendGrid before sending. Do not repeatedly register a shared domain without consulting its maintainer. Actual staging DNS records and delivery results are tracked under [#256](https://github.com/GTBitsOfGood/servicestart/issues/256).

Start only the application and database, without restarting Juno in simulation mode:

```bash
pnpm run db:start
pnpm exec next dev
```

Invite an address you control from the seeded organization and confirm receipt, sender address, and a working invitation link. Real mode sends real messages: use only intended recipients. To restore simulation, stop these processes, run `pnpm run juno:stop`, restore the template's simulated email values, start `pnpm run dev`, and rerun `pnpm run email:setup`.

The preview workflow also needs `EMAIL_SENDER_DOMAIN` configured as a GitHub Preview environment variable before deploying these changes. SendGrid credentials remain secrets. `setupOrg` retains combined email and optional organization file-bucket provisioning for that workflow; local email uses `email:setup`.

### Testing

Run `pnpm run test:config` for configuration and email regression checks without Docker or credentials. These checks also run as part of `pnpm test`.

Install PostgreSQL's `psql` client on your PATH. Unit tests use the checked-in `.env.test`, create isolated databases, and apply migrations automatically:

```bash
pnpm run db:test:create
docker exec servicestart-test-db pg_isready -U test -d postgres
pnpm test
```

Wait for readiness before testing. On subsequent runs, the test command starts the existing container. For browser tests, apply the test database schema first:

```bash
pnpm run db:test:migrate
pnpm run test:e2e
```

### Onboarding acceptance walkthrough

Have a contributor unfamiliar with the project follow these instructions on a clean clone. Record their OS/tool versions, any obstacles, successful migration and seeding, login, and simulated email behavior. Separately complete the team-assisted real-inbox check above. Remove a required value (for example `EMAIL_SENDER_DOMAIN`) and confirm the setup/send operation reports the variable name and how to configure it. Restore the value afterward.

Include a recording of the working setup and configuration error in the PR, excluding credentials and private inbox content. Automated checks do not replace this walkthrough.

## Other Tools

- Dependabot is enabled and will submit PRs to update dependencies.
- PRs automatically create preview deployments on Netlify for easy UX testing.
- There's a pre-commit hook for Prettier. If you get an error when committing, click "Show command output" in the popup to see the issue.
- Use `pnpm run db:view` to open Drizzle Studio and view the database schema and contents.
- Use the `buildTestUser` function in `tests/unit/testUtils.ts` to get a user that you can use for API endpoints in tests.
- Use `pnpx bog-cli design edit` to configure the BoG design system.
- Run scripts in the `scripts` folder with `pnpx tsx <script-name>`.
- Set the `DB_URL` environment variable on GitHub. For the preview environment, leave out the `/database-name` part so that the workflow can create databases for each PR.

## Docs & Writeups

Various parts of ServiceStart's architecture and design decisions are documented in the `docs` folder. Check it out for details about our design decisions and infrastructure.

## Debugging

- The db docker containers run on `5432` and `5433`, so if there is a program already using those ports, then it will fail to start these containers.
- If juno set up is hanging, it could just mean the juno containers are hanging, so just stop it and retry the set up.
