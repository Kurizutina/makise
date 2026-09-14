const { test, after } = require('node:test');
const assert = require('node:assert/strict');

// Exercise the HTTP boundary without requiring a developer's MySQL instance.
let role = 'admin';
let lookupCount = 0;
require.cache[require.resolve('./database/connection')] = { exports: {
  execute: async () => {
    lookupCount += 1;
    return [[{ id: 7, name: 'Seven' }, { id: 8, name: 'Eight' }]];
  }
} };
require.cache[require.resolve('./auth')] = { exports: {
  verifyToken: () => ({ sub: 1 }),
  findUserById: async () => ({ UserID: 1, Role: role })
} };
const app = require('./server');
const server = app.listen(0, '127.0.0.1');
after(() => new Promise((resolve) => server.close(resolve)));
test('rider directory requires authentication and admin role', async () => {
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/riders`;
  assert.equal((await fetch(url)).status, 401);
  role = 'driver';
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer test' } })).status, 403);
  assert.equal(lookupCount, 0);
  role = 'admin';
  const response = await fetch(url, { headers: { Authorization: 'Bearer test' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { riders: [{ id: 7, name: 'Seven' }, { id: 8, name: 'Eight' }] });
});
