import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";

export const ALLOWED_NAVBAR_VARIANTS = [
  "vertical-sidebar",
  "vertical-icon",
  "horizontal-left",
  "horizontal-center",
  "horizontal-right",
] as const;

type AllowedNavbarVariant = (typeof ALLOWED_NAVBAR_VARIANTS)[number];

async function getDesc(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.Description),
      ),
    )
    .limit(1);

  return row?.value ?? "No description has been set";
}

async function setDesc(organizationId: string, desc: string) {
  const htmlRegex = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
  // sanitization?
  // desc = desc.replace(htmlRegex, "");

  if (desc.length > 300) {
    throw new Error("Description must be no longer than 300 characters");
  }

  if (desc.match(htmlRegex)) {
    throw new Error("Description must not contain HTML tags");
  }
  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.Description),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: desc })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.Description),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.Description,
      value: desc,
    });
  }
}

async function getPrimaryColor(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.PrimaryColor),
      ),
    )
    .limit(1);

  return row?.value ?? "#FD8033";
}

async function setPrimaryColor(organizationId: string, color: string) {
  const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
  if (!color.match(hexColorRegex)) {
    throw new Error("Color must be a valid hex code");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.PrimaryColor),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: color })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.PrimaryColor),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.PrimaryColor,
      value: color,
    });
  }
}

async function getSecondaryColor(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.SecondaryColor),
      ),
    )
    .limit(1);

  return row?.value ?? "#FB3552";
}

async function setSecondaryColor(organizationId: string, color: string) {
  const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
  if (!color.match(hexColorRegex)) {
    throw new Error("Color must be a valid hex code");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.SecondaryColor),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: color })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.SecondaryColor),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.SecondaryColor,
      value: color,
    });
  }
}

async function getTagline(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.Tagline),
      ),
    )
    .limit(1);

  return row?.value ?? "";
}

async function setTagline(organizationId: string, tagline: string) {
  const htmlRegex = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
  // sanitization?
  // desc = desc.replace(htmlRegex, "");

  if (tagline.length > 100) {
    throw new Error("Tagline must be no longer than 100 characters");
  }

  if (tagline.match(htmlRegex)) {
    throw new Error("Tagline must not contain HTML tags");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.Tagline),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: tagline })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.Tagline),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.Tagline,
      value: tagline,
    });
  }
}

async function getMembersPageEnabled(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.MembersPageEnabled),
      ),
    )
    .limit(1);

  return (row?.value ?? "true") === "true";
}

async function setMembersPageEnabled(organizationId: string, value: string) {
  if (value !== "true" && value !== "false") {
    throw new Error("Value must be 'true' or 'false'");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.MembersPageEnabled),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.MembersPageEnabled),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.MembersPageEnabled,
      value,
    });
  }
}

async function getNavbarVariant(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.NavbarVariant),
      ),
    )
    .limit(1);

  const value = row?.value;
  if (
    value &&
    ALLOWED_NAVBAR_VARIANTS.includes(value as AllowedNavbarVariant)
  ) {
    return value;
  }
  return "vertical-sidebar";
}

async function setNavbarVariant(organizationId: string, variant: string) {
  if (!variant || typeof variant !== "string") {
    throw new Error("Navbar variant must be a non-empty string");
  }
  if (!ALLOWED_NAVBAR_VARIANTS.includes(variant as AllowedNavbarVariant)) {
    throw new Error(`Invalid navbar variant: ${variant}`);
  }
  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.NavbarVariant),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: variant })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.NavbarVariant),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.NavbarVariant,
      value: variant,
    });
  }
}

async function getNavbarColor(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.NavbarColor),
      ),
    )
    .limit(1);

  const value = row?.value;
  return value === "white" ? "white" : "red";
}

async function setNavbarColor(organizationId: string, color: string) {
  if (color !== "red" && color !== "white") {
    throw new Error("Navbar color must be either 'red' or 'white'");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.NavbarColor),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: color })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.NavbarColor),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.NavbarColor,
      value: color,
    });
  }
}

async function getLogoUrl(organizationId: string) {
  const [row] = await db
    .select({
      value: organizationConfig.value,
    })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.LogoUrl),
      ),
    )
    .limit(1);

  // If no logo URL is configured, return null so callers can
  // fall back to their own default logo rendering.
  return row?.value ?? null;
}

async function setLogoUrl(organizationId: string, logoUrl: string) {
  if (!logoUrl || typeof logoUrl !== "string") {
    throw new Error("Logo URL must be a non-empty string");
  }

  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, OrganizationConfigKey.LogoUrl),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value: logoUrl })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, OrganizationConfigKey.LogoUrl),
        ),
      );
  } else {
    const id = randomUUID();
    await db.insert(organizationConfig).values({
      id,
      organizationId,
      key: OrganizationConfigKey.LogoUrl,
      value: logoUrl,
    });
  }
}

const keyMap = {
  [OrganizationConfigKey.Description]: { get: getDesc, set: setDesc },
  [OrganizationConfigKey.PrimaryColor]: {
    get: getPrimaryColor,
    set: setPrimaryColor,
  },
  [OrganizationConfigKey.SecondaryColor]: {
    get: getSecondaryColor,
    set: setSecondaryColor,
  },
  [OrganizationConfigKey.Tagline]: {
    get: getTagline,
    set: setTagline,
  },
  [OrganizationConfigKey.NavbarVariant]: {
    get: getNavbarVariant,
    set: setNavbarVariant,
  },
  [OrganizationConfigKey.NavbarColor]: {
    get: getNavbarColor,
    set: setNavbarColor,
  },
  [OrganizationConfigKey.MembersPageEnabled]: {
    get: getMembersPageEnabled,
    set: setMembersPageEnabled,
  },
  [OrganizationConfigKey.LogoUrl]: {
    get: getLogoUrl,
    set: setLogoUrl,
  },
};

async function getConfig(
  organizationId: string,
  keys: OrganizationConfigKey[],
) {
  const entries = await Promise.all(
    keys
      .filter((key) => keyMap[key])
      .map(async (key) => [key, await keyMap[key].get(organizationId)]),
  );

  return Object.fromEntries(entries);
}

async function setConfig(
  organizationId: string,
  key: OrganizationConfigKey,
  value: string,
) {
  if (!keyMap[key]) {
    throw new Error("Invalid key");
  }

  await keyMap[key].set(organizationId, value);
}

export const OrganizationConfigService = {
  getConfig,
  setConfig,
};

export default OrganizationConfigService;
