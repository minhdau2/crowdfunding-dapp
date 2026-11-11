import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { Wallet } from 'ethers'
import { installAuth } from '../auth.js'

test('wallet login rejects cross-origin, replay, wrong signature and expiry; logout revokes cookie', async () => {
  let clock = Date.now()
  const app = express()
  app.use(express.json())
  installAuth(app, { now: () => clock })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/auth`
  const wallet = Wallet.createRandom()
  const post = (path, body, cookie = '', origin = 'http://localhost:5173') => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body),
  })
  const challenge = async () => (await post('/nonce', { account: wallet.address })).json()
  try {
    assert.equal((await post('/nonce', { account: wallet.address }, '', 'https://attacker.example')).status, 403)
    const first = await challenge()
    assert.match(first.message, /URI: http:\/\/localhost:5173/)
    assert.match(first.message, /Chain ID: 11155111/)
    const signature = await wallet.signMessage(first.message)
    const response = await post('/verify', { nonce: first.nonce, signature })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
    const cookie = response.headers.get('set-cookie').split(';')[0]
    const current = await (await fetch(base + '/session', { headers: { Cookie: cookie } })).json()
    assert.equal(current.account, wallet.address.toLowerCase())
    assert.equal(current.isAdmin, false)
    assert.equal((await post('/verify', { nonce: first.nonce, signature })).status, 401)
    const wrong = await challenge()
    assert.equal((await post('/verify', { nonce: wrong.nonce, signature: await Wallet.createRandom().signMessage(wrong.message) })).status, 401)
    const expired = await challenge()
    clock += 300001
    assert.equal((await post('/verify', { nonce: expired.nonce, signature: await wallet.signMessage(expired.message) })).status, 401)
    await post('/logout', {}, cookie)
    assert.equal((await (await fetch(base + '/session', { headers: { Cookie: cookie } })).json()).authenticated, false)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
