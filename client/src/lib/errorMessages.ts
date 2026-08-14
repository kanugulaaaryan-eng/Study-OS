// A 502/504 from the platform's edge (Render/Netlify) arrives as an HTML
// error page, not tRPC JSON. The tRPC client correctly surfaces that as a
// parse error rather than crashing — but "Unexpected token '<' ... is not
// valid JSON" is meaningless to a user. Map that specific failure mode to
// plain language; everything else keeps using the server's own message.
export function friendlyMutationErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const looksLikeNonJsonGatewayError =
    /unexpected token/i.test(message) && /doctype|<!doctype|is not valid json|json\.parse/i.test(message);

  if (looksLikeNonJsonGatewayError) {
    return "StudyOS is taking too long to respond right now. Please try again in a moment.";
  }

  return message || fallback;
}
