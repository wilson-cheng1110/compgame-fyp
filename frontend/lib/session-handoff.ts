import Cookies from "js-cookie"
import type { SessionUser } from "@/lib/api"

// There are TWO doors into the app now — sign in and sign up — and both have to hand
// the session over to the rest of the app identically. This module is the only writer
// of the `user` cookie on the way in, because the codebase has already paid once for
// two places writing one cookie with slightly different shapes (see below).

export function storeSession(data: SessionUser) {
  Cookies.set(
    "user",
    JSON.stringify({
      sid: data.sid,
      username: data.username,
      avatarId: data.avatarId,
      // MUST be written, and it was not until 2026-08-21. The onboarding gate reads
      // this key off the cookie; the old signup flow used to set it and retiring
      // signup left nothing writing it. Undefined here sent a brand new student:
      // login -> avatar page (reads !undefined -> true, bounces to dashboard) ->
      // dashboard (no username/avatarId, DELETES the cookie) -> login. An unbreakable
      // loop, and on day one every one of the 300 accounts is in exactly that state.
      needsOnboarding: data.needsOnboarding,
    }),
    { expires: 120 },
  )
}

export function nextStep(
  needsConsent: boolean,
  needsOnboarding: boolean,
  needsBaseline?: boolean,
) {
  if (needsConsent) return "/consent"
  if (needsOnboarding) return "/onboarding/avatar"
  // The baseline is the last onboarding step, and it is a GATE: it measures prior
  // knowledge, so it has to be sat before the student sees any topic content.
  if (needsBaseline) return "/onboarding/baseline"
  return "/dashboard"
}
