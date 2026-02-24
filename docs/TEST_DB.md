# Databases in Tests

See [tests/unit/setup.ts](tests/unit/setup.ts) for the code being discussed here.

Our tests are connected to a Postgres database so we can verify our queries work. However, this raises a problem: if we run multiple tests simultaneously, the DB interactions from the two need to be isolated. To solve, each test suite gets its own database. Tests within a single suite do not run in parallel, so simply wiping the database before each test is sufficient to isolate tests within a suite.

All test databases are created within the same Postgres instance. Reusing a single instance gives us the speed of pre-creating a Docker container, but the isolation of separate databases. The `pnpm run test` command starts this container, runs the tests, and then stops the container.

`setup.ts` uses a `beforeAll` hook to create a new database for the test suite, run migrations, and seed the database. The database is dropped in an `afterAll` hook. However, we must connect to the Postgres instance to create and drop databases, so we override the database name in `DB_URL` with `postgres` for these operations. This approach does lead to importing the database functions in an odd manner and order to ensure we use the `DB_URL` for each operation.

Test database names are random right now, raising the edge case of them overlapping. Future work should generate database names in such a way that they cannot overlap.
