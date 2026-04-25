export function shouldRenderPublicBookingEntry(search: string) {
  const params = new URLSearchParams(search);
  const hasLinkToken = Boolean(params.get("link"));
  const hasCompanyProjectPair = Boolean(params.get("company") && params.get("project"));

  return hasLinkToken || hasCompanyProjectPair;
}
