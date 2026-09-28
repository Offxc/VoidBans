import { prisma } from "@/lib/prisma";

const SITE_ICON_KEY = "site.icon_url";

// The only accepted host for the site icon — deliberately not "any https
// URL": this value gets embedded as an <img src> on every public and
// staff page, so accepting an arbitrary URL would mean any owner-level
// mistake (or a compromised owner account) could point every page at an
// attacker-controlled image host. i.postimg.cc is also the only host
// allow-listed in the CSP's img-src for this purpose — keep both in sync.
const ALLOWED_HOST = "i.postimg.cc";

export function isValidPostimagesUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname === ALLOWED_HOST;
}

export async function getSiteIconUrl(): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: SITE_ICON_KEY } });
  const value = setting?.value;
  return typeof value === "string" && isValidPostimagesUrl(value) ? value : null;
}

export async function setSiteIconUrl(url: string | null): Promise<void> {
  if (url === null) {
    await prisma.siteSetting.deleteMany({ where: { key: SITE_ICON_KEY } });
    return;
  }
  if (!isValidPostimagesUrl(url)) {
    throw new Error(`Site icon URL must be a https://${ALLOWED_HOST}/... link`);
  }
  await prisma.siteSetting.upsert({
    where: { key: SITE_ICON_KEY },
    create: { key: SITE_ICON_KEY, value: url },
    update: { value: url },
  });
}
