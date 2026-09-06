/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On a self-hosted VPS, Google/X through the Grok broker will not work
 * (that client is bound to grok-sandbox / the published Grok URL). Email +
 * password is the operator login for that case.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;
