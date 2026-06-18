import prisma from "~/lib/prisma";

/** Read a single household setting value, or null if it's never been set. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Read a boolean household setting ("true" = on); anything else is off. */
export async function getBoolSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}
