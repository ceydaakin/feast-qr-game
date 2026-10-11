// Anonymous contest: the first 3 players to finish the 45 s round win
// (rules: sartname.html). Codes are made in the browser and only ever live in
// memory and on screen: never logged, stored (local/sessionStorage, cookies,
// IndexedDB), put in a URL, or sent to analytics. Pure (fetch/clock injected)
// → unit-tested in Node.

export const CONTEST = Object.freeze({
  submitUrl: 'https://games-feast-tr-results.cloud.run/verify',
  // ponytail: ships inside the page, so anyone can read it; it is not a real
  // secret. Abuse protection (rate limits, a 45 s timing check) must be server-side.
  appSecret: 'ASKSMC0Q3N01NDAIASDNOQ',
  networkRetries: 3, // network error / 5xx / 408 / 429: same codes again
  conflictRetries: 5, // 409: new participant code
  retryBaseMs: 600,
});

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_SPACE = 36 ** 6;

// Current millisecond in base 36 (6 chars). Two players only collide when they
// finish in the same ms (or a multiple of ~25 days apart) → 409 → new code.
export function participantCode(nowMs = Date.now()) {
  return (Math.floor(nowMs) % CODE_SPACE).toString(36).toUpperCase().padStart(6, '0');
}

// 4 chars from crypto.getRandomValues; bytes ≥ 252 are dropped so every
// character is equally likely (252 = 7 × 36).
export function secretCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  let out = '';
  while (out.length < 4) {
    for (const b of randomBytes(8)) if (b < 252 && out.length < 4) out += ALPHABET[b % 36];
  }
  return out;
}

export const newCodes = (now = Date.now) => ({ code: participantCode(now()), secret: secretCode() });

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const retryable = (status) => status >= 500 || status === 408 || status === 429;

// Resolves { status: 'ok' | 'closed' | 'error', codes }. Every 2xx is the same
// 'ok' (the player can't tell whether they won). `codes` is what was last sent,
// so a manual retry resends the same pair.
export async function submitCodes(codes, { fetchImpl = fetch, now = Date.now, sleep = wait } = {}) {
  let { code } = codes;
  const { secret } = codes;
  let failures = 0;
  let conflicts = 0;
  for (;;) {
    let res = null;
    let body = null;
    try {
      res = await fetchImpl(CONTEST.submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ 'anonym-code': code, 'secret-code': secret, 'app-secret': CONTEST.appSecret }),
      });
      body = await res.json().catch(() => null);
    } catch {
      res = null; // network failure
    }
    if (body?.open === false) return { status: 'closed', codes: { code, secret } };
    if (res?.ok) return { status: 'ok', codes: { code, secret } };
    if (res?.status === 409 && conflicts < CONTEST.conflictRetries) {
      conflicts += 1;
      code = participantCode(now() + conflicts); // + conflicts: differs even on a frozen clock
      continue;
    }
    if ((res && !retryable(res.status)) || failures >= CONTEST.networkRetries) {
      return { status: 'error', codes: { code, secret } };
    }
    failures += 1;
    await sleep(CONTEST.retryBaseMs * 2 ** (failures - 1));
  }
}
