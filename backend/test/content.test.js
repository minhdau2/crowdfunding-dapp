import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import sharp from 'sharp'
import { MongoClient } from 'mongodb'
import { Wallet } from 'ethers'
import { randomUUID } from 'node:crypto'
import { installAuth } from '../auth.js'
import { installContent, normalizeImage, campaignKey } from '../content.js'

test('image validation rejects forged MIME, SVG and invalid files; strips metadata and resizes', async () => {
  await assert.rejects(normalizeImage(Buffer.from('<svg/>'), 'image/png'), /File ảnh/)
  await assert.rejects(normalizeImage(Buffer.from('<svg/>'), 'image/svg+xml'), /Ảnh phải/)
  const png = await sharp({ create: { width: 1800, height: 2, channels: 3, background: 'red' } }).png().toBuffer()
  await assert.rejects(normalizeImage(png, 'image/jpeg'), /File ảnh/)
  const output = await normalizeImage(png, 'image/png')
  const meta = await sharp(output).metadata()
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 1600); assert.equal(meta.exif, undefined)
})

test('content APIs enforce sessions, ownership, admin revocation, duplicate reports, images and audit transactions', { skip: !process.env.RUN_MONGO_TESTS }, async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const prefix = `codex_test_${randomUUID().replaceAll('-', '')}_`
  const names = new Set()
  let server
  try {
    await client.connect()
    const realDb = client.db(process.env.MONGODB_DB || 'crowdfunding')
    let rejectAudit = false
    const db = { collection(name) {
      names.add(prefix + name)
      const collection = realDb.collection(prefix + name)
      if (name !== 'audit') return collection
      return new Proxy(collection, { get(target, prop) {
        if (prop === 'insertOne') return (...args) => { if (rejectAudit) throw new Error('Injected audit failure'); return target.insertOne(...args) }
        const value = target[prop]
        return typeof value === 'function' ? value.bind(target) : value
      } })
    } }
    const owner = Wallet.createRandom(), other = Wallet.createRandom(), admin = Wallet.createRandom()
    let adminEnabled = true
    const app = express()
    app.use(express.json({ limit: '16kb' }))
    installAuth(app, { isAdmin: async account => adminEnabled && account === admin.address.toLowerCase() })
    const readCampaign = async id => {
      if (!['1', '2'].includes(id)) throw Object.assign(new Error('Không tìm thấy chiến dịch.'), { status: 404 })
      return { campaignId: id, owner: owner.address.toLowerCase(), title: `Campaign ${id}`, description: 'Original story', approvalStatus: 'approved', totalRaisedWei: '100' }
    }
    const service = await installContent(app, { db, client, readCampaign, listCampaigns: async () => [await readCampaign('1'), await readCampaign('2')] })
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal test error' }))
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}/api`
    const request = (path, { cookie = '', body, mime = 'application/json', origin = 'http://localhost:5173' } = {}) => fetch(base + path, {
      headers: { Cookie: cookie, Origin: origin, ...(body === undefined ? {} : { 'Content-Type': mime }) },
      ...(body === undefined ? {} : { method: 'POST', body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    })
    const login = async wallet => {
      const challenge = await (await request('/auth/nonce', { body: { account: wallet.address } })).json()
      const result = await request('/auth/verify', { body: { nonce: challenge.nonce, signature: await wallet.signMessage(challenge.message) } })
      assert.equal(result.status, 200)
      return result.headers.get('set-cookie').split(';')[0]
    }
    const ownerCookie = await login(owner), otherCookie = await login(other), adminCookie = await login(admin)
    const expect = async (path, options, status = 200) => { const res = await request(path, options); assert.equal(res.status, status, `${path}: ${await res.clone().text()}`); return res }
    await expect('/campaigns/1/comments', { body: { text: 'Unauthorized' } }, 401)
    await expect('/campaigns/1/comments', { cookie: ownerCookie, body: { text: 'Bad origin' }, origin: 'https://attacker.example' }, 403)
    await expect('/admin/audit', { cookie: otherCookie }, 403)
    await expect('/campaigns/1/comments', { cookie: ownerCookie, body: { text: 'First comment', account: other.address } })
    const social = await (await request('/campaigns/1/social')).json()
    assert.equal(social.comments[0].account, owner.address.toLowerCase())
    const commentId = social.comments[0].id
    await expect(`/campaigns/1/comments/${commentId}/delete`, { cookie: otherCookie, body: {} }, 403)
    await expect(`/campaigns/2/comments/${commentId}/delete`, { cookie: ownerCookie, body: {} }, 404)
    await expect('/campaigns/1/favorite', { cookie: otherCookie, body: { favorite: true, account: owner.address } })
    await expect('/campaigns/1/favorite', { cookie: otherCookie, body: { favorite: true } })
    assert.equal((await (await request('/favorites', { cookie: otherCookie })).json()).campaigns.length, 1)
    assert.equal((await (await request('/favorites', { cookie: ownerCookie })).json()).campaigns.length, 0)
    await expect('/campaigns/1/reports', { cookie: otherCookie, body: { reason: 'Please review this content' } })
    await expect('/campaigns/1/reports', { cookie: otherCookie, body: { reason: 'Please review this content' } }, 409)
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer()
    await expect('/campaigns/1/image', { cookie: otherCookie, body: png, mime: 'image/png' }, 403)
    const upload = await (await expect('/campaigns/1/image', { cookie: ownerCookie, body: png, mime: 'image/png' })).json()
    await expect('/campaigns/2/metadata', { cookie: ownerCookie, body: { category: 'Giáo dục', image: upload.image } }, 403)
    await expect('/campaigns/1/metadata', { cookie: otherCookie, body: { category: 'Giáo dục' } }, 403)
    await expect('/campaigns/1/metadata', { cookie: ownerCookie, body: { category: 'Giáo dục', image: 'https://attacker.example/a.png' } }, 400)
    await expect('/campaigns/1/metadata', { cookie: ownerCookie, body: { category: 'Giáo dục', image: upload.image } })
    const image = await expect(upload.image.replace('/api', ''), {})
    assert.equal(image.headers.get('content-type'), 'image/webp')
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await service.decorate(await readCampaign('1'))).category, 'Giáo dục')
    const moderate = (action, section, id, reason = 'Content review completed') => expect('/admin/moderate', { cookie: adminCookie, body: { action, section, id, reason } })
    await moderate('hideCampaign', 'campaigns', '1')
    const hidden = await service.decorate(await readCampaign('1'))
    assert.equal(hidden.contentHidden, true); assert.equal(hidden.totalRaisedWei, '100')
    await expect('/campaigns/1/social', {}, 404)
    await expect(upload.image.replace('/api', ''), {}, 404)
    await moderate('restoreCampaign', 'campaigns', '1')
    await moderate('deleteComment', 'comments', commentId)
    assert.equal((await (await request('/campaigns/1/social')).json()).comments.length, 0)
    const reportRows = await (await request('/admin/reports', { cookie: adminCookie })).json()
    await moderate('resolveReport', 'reports', reportRows.items[0].id)
    const auditRows = await (await request('/admin/audit', { cookie: adminCookie })).json()
    for (const action of ['hideCampaign', 'restoreCampaign', 'deleteComment', 'resolveReport', 'saveMetadata']) assert.ok(auditRows.items.some(x => x.title.startsWith(action)))
    // A failing audit insert must roll back the state mutation in the same transaction.
    rejectAudit = true
    await expect('/admin/moderate', { cookie: adminCookie, body: { action: 'hideCampaign', section: 'campaigns', id: '1', reason: 'Audit failure rollback test' } }, 500)
    assert.equal((await db.collection('campaign_content').findOne({ _id: campaignKey('1') })).hidden, false)
    adminEnabled = false
    await expect('/admin/audit', { cookie: adminCookie }, 403)
    assert.equal((await (await request('/auth/session', { cookie: adminCookie })).json()).isAdmin, false)
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    // Only collections created under this test's exact random prefix are removed.
    for (const name of names) { try { await client.db(process.env.MONGODB_DB || 'crowdfunding').collection(name).drop() } catch (error) { if (error.code !== 26) throw error } }
    await client.close()
  }
})
