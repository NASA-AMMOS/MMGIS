/**
 * Unit tests for mission-filtered websocket broadcasts.
 * Source: API/websocket.js (wss.broadcast)
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const { EventEmitter } = require('events');

const { websocket } = require(path.resolve(__dirname, '../../API/websocket.js'));
const missions = require(path.resolve(__dirname, '../../API/permissions/missions.js'));
const policy = require(path.resolve(__dirname, '../../API/permissions/policy.js'));

const OPEN = 1;
const CLOSED = 3;
const flush = () => new Promise((r) => setTimeout(r, 20));

test.describe('websocket broadcasts', () => {
  let saved;
  let wss;
  test.beforeAll(() => {
    saved = { uuidForName: missions.uuidForName, can: policy.can };
    missions.uuidForName = async (name) => ({ A: 'uuid-a', B: 'uuid-b' })[name] || null;
    // A viewer here is just the list of mission uuids it may view
    policy.can = (p, cap, ctx) => cap === 'mission.view' && p.views.includes(ctx.mission);
    wss = websocket.init(new EventEmitter(), null);
    wss = wss || websocket.wss;
  });
  test.afterAll(() => {
    missions.uuidForName = saved.uuidForName;
    policy.can = saved.can;
    if (websocket.wss) websocket.wss.close();
  });

  const client = (views, readyState = OPEN) => {
    const c = { readyState, sent: [], send: (d) => c.sent.push(d), mmgisViewer: async () => ({ views }) };
    return c;
  };
  const withClients = (clients) => {
    websocket.wss.clients.clear();
    clients.forEach((c) => websocket.wss.clients.add(c));
  };

  test("only clients that can view the update's mission receive it", async () => {
    const a = client(['uuid-a']);
    const b = client(['uuid-b']);
    const both = client(['uuid-a', 'uuid-b']);
    const closed = client(['uuid-a'], CLOSED);
    const unresolved = { readyState: OPEN, sent: [], send() { this.sent.push(1); } };
    withClients([a, b, both, closed, unresolved]);
    websocket.wss.broadcast(JSON.stringify({ body: { mission: 'A' } }));
    await flush();
    expect(a.sent).toHaveLength(1);
    expect(both.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0);
    expect(closed.sent).toHaveLength(0);
    expect(unresolved.sent).toHaveLength(0);
  });

  test('updates for unknown missions, without a mission, or not JSON go to no one', async () => {
    const all = client(['uuid-a', 'uuid-b']);
    withClients([all]);
    for (const data of [JSON.stringify({ body: { mission: 'Nope' } }), JSON.stringify({ body: {} }), 'not json', undefined])
      websocket.wss.broadcast(data);
    await flush();
    expect(all.sent).toHaveLength(0);
  });

  test("a viewer that can't be resolved, or loses access, gets nothing", async () => {
    const failing = { readyState: OPEN, sent: [], send() { this.sent.push(1); }, mmgisViewer: async () => { throw new Error('store down'); } };
    const revoked = client([]);
    withClients([failing, revoked]);
    websocket.wss.broadcast(JSON.stringify({ body: { mission: 'A' } }));
    await flush();
    expect(failing.sent).toHaveLength(0);
    expect(revoked.sent).toHaveLength(0);
  });
});
