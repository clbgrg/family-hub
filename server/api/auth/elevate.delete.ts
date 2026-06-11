/**
 * "Lock now": drop parent-unlock elevation without ending the session.
 */
export default defineEventHandler(async (event) => {
  // /api/auth/* bypasses the global auth middleware — guard explicitly.
  await requireUserSession(event);
  await setUserSession(event, { elevatedUntil: 0 });
  return { elevatedUntil: 0 };
});
