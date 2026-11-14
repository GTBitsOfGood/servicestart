/* global process, module */

// Seeded development tenants must hydrate without per-developer env setup.
// localhost belongs to no organization, so ServiceStart's own org is on its
// tenant host too.
const allowedDevOrigins = [
  "servicestart.lvh.me",
  "volunteerstart.lvh.me",
  "applicationstart.lvh.me",
  ...(process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? []),
];

module.exports = {
  env: {
    NEXT_PUBLIC_TENANT_ROOT_DOMAIN:
      process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ||
      process.env.E2E_TENANT_DOMAIN ||
      "servicestart.com",
  },
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
};
