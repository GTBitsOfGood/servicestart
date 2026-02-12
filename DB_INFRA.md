# Database Infrastructure

We use PostgreSQL as our database, and Drizzle ORM as our ORM. The Postgres instance is hosted with Azure Postgres. Our Azure
Postgres setup is fairly standard, so there's not much to say about it.

## Migrations

Drizzle generates migrations from the schema defined in `lib/schema.ts`. Whenever you push, the `generate_migrations.yml`
workflow generates and commits any new migrations to the `migrations` folder. If no new migrations are generated, no commit is made.

On commits to main or to a branch with an open PR, the `cd.yml` workflow's `migrate-db` job migrates the corresponding database
with any new migrations.

### Migration Troubleshooting

There's two main fixes for errors with migrations. First, the target database might not exist; this will only happen with
a PR's preview database. Fix this error by closing the PR and reopening it, which will recreate the preview DB. Note that this
error will only be noticeable by the first command in a migration failing. There won't be a nice clean error message pointing out
that the database doesn't exist.

The second issue is that Drizzle might generate a faulty migration. This error tends to occur when merging migrations for a PR.
To fix this, delete and regenerate any migrations files created for the PR.

## Preview Databases

Netlify provides preivew deployments for PRs, but these do not with a preview database out of the box. When a PR is opened, a preview database is created, migrated, and seeded by the `setup_preview.yml` workflow. The database is named `pr<pr #>` and is hosted on the same Postgres instance as the main database.

We've configured Drizzle to replace `<branch>` in the `DB_URL` with `NEXT_PUBLIC_BRANCH_NAME`, so that the preview deployment for a PR automatically connects to the correct preview database. There's some additional work to get the correct DB name, so take a look at `getDbUrl` in `lib/db.ts` for details.

In Netlify's build process, we embed the branch name as `NEXT_PUBLIC_BRANCH_NAME`. The variable must be public so it is present in the server files and not just during the build process.

Once a PR is closed, its preview database is dropped by the `teardown_preview.yml` workflow.
