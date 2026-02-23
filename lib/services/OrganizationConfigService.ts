import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";

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
