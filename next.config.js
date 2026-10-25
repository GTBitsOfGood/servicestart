/* global process, module */

// Seeded development tenants must hydrate without per-developer env setup.
const allowedDevOrigins = [
  "volunteerstart.lvh.me",
  "applicationstart.lvh.me",
  ...(process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? []),
];

module.exports = {
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
};
