import { test } from 'node:test';
import assert from 'node:assert/strict';
import { participantCode, secretCode, newCodes, submitCodes, CONTEST } from '../js/contest.js';

const FORMAT6 = /^[A-Z0-9]{6}$/;
const FORMAT4 = /^[A-Z0-9]{4}$/;

test('participant code: 6 chars A–Z0–9, different every millisecond', () => {
  const t = Date.UTC(2026, 9, 12);
  const codes = new Set();
  for (let i = 0; i < 5000; i++) {
    const c = participantCode(t + i);
    assert.match(c, FORMAT6);
    codes.add(c);
  }
  assert.equal(codes.size, 5000);
  assert.match(participantCode(0), FORMAT6); // padded
});

test('secret code: 4 chars A–Z0–9, biased bytes skipped', () => {
  for (let i = 0; i < 500; i++) assert.match(secretCode(), FORMAT4);
  let calls = 0;
  const bytes = () => (calls++ ? new Uint8Array([0, 35, 0, 35, 0, 0, 0, 0]) : new Uint8Array(8).fill(255));
  assert.equal(secretCode(bytes), 'A9A9');
  assert.match(newCodes().code, FORMAT6);
});

const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const noSleep = async () => {};
function fakeFetch(replies) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, ...JSON.parse(init.body) });
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { sent, fetchImpl };
}

test('200 → ok; body uses the backend field names and the /verify URL', async () => {
  const { sent, fetchImpl } = fakeFetch([reply(200, { anything: 'winner?' })]);
  const r = await submitCodes({ code: 'ABC123', secret: 'Z9Z9' }, { fetchImpl, sleep: noSleep });
  assert.deepEqual(r, { status: 'ok', codes: { code: 'ABC123', secret: 'Z9Z9' } });
  assert.deepEqual(sent, [{ url: 'https://games-feast-tr-results.cloud.run/verify', 'anonym-code': 'ABC123', 'secret-code': 'Z9Z9', 'app-secret': CONTEST.appSecret }]);
});

test('409 → new participant code, same secret', async () => {
  const { sent, fetchImpl } = fakeFetch([reply(409), reply(201)]);
  const r = await submitCodes({ code: 'ABC123', secret: 'Z9Z9' }, { fetchImpl, now: () => 1e12, sleep: noSleep });
  assert.equal(r.status, 'ok');
  assert.notEqual(sent[1]['anonym-code'], 'ABC123');
  assert.equal(sent[1]['secret-code'], 'Z9Z9');
  assert.equal(r.codes.code, sent[1]['anonym-code']);
});

test('network failure / 5xx → same codes again, then error', async () => {
  const { sent, fetchImpl } = fakeFetch([new TypeError('offline'), reply(503), reply(200)]);
  assert.equal((await submitCodes({ code: 'ABC123', secret: 'Z9Z9' }, { fetchImpl, sleep: noSleep })).status, 'ok');
  assert.ok(sent.every((s) => s['anonym-code'] === 'ABC123'));
  const down = fakeFetch(Array.from({ length: 10 }, () => new TypeError('offline')));
  assert.equal((await submitCodes({ code: 'A', secret: 'B' }, { fetchImpl: down.fetchImpl, sleep: noSleep })).status, 'error');
  assert.equal(down.sent.length, CONTEST.networkRetries + 1);
});

test('{"open": false} → closed; other 4xx → error, no retry', async () => {
  const closed = fakeFetch([reply(200, { open: false })]);
  assert.equal((await submitCodes({ code: 'A', secret: 'B' }, { fetchImpl: closed.fetchImpl, sleep: noSleep })).status, 'closed');
  const bad = fakeFetch([reply(403)]);
  assert.equal((await submitCodes({ code: 'A', secret: 'B' }, { fetchImpl: bad.fetchImpl, sleep: noSleep })).status, 'error');
  assert.equal(bad.sent.length, 1);
});
