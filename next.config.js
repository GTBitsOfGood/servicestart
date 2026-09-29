/* global process, module */

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
  : [];

module.exports = {
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
};
