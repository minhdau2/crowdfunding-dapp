import express from 'express'
import sharp from 'sharp'
import { randomUUID, createHash } from 'node:crypto'
import { CONTRACT_ADDRESS } from '../frontend/src/lib/chainReader.js'
import { calculateMetadataHash, EMPTY_IMAGE_HASH } from './metadataHash.js'

const namespace = { chainId: 11155111, contractAddress: CONTRACT_ADDRESS.toLowerCase() }
export const campaignKey = id => `11155111:${namespace.contractAddress}:${id}`
export function httpError(status, message) { return Object.assign(new Error(message), { status }) }
function text(value, min = 1, max = 1000) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw httpError(400, `Nội dung cần từ ${min} đến ${max} ký tự.`)
  return value.trim()
}
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)
export const requireSession = (req, _res, next) => req.user ? next() : next(httpError(401, 'Hãy ký đăng nhập trước khi thực hiện.'))
export const requireAdmin = (req, _res, next) => req.user?.isAdmin ? next() : next(httpError(req.user ? 403 : 401, 'Cần quyền quản trị nội dung.'))

export async function normalizeImage(buffer, mime) {
  const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
  if (!Buffer.isBuffer(buffer) || !formats[mime] || !buffer.length || buffer.length > 5 * 1024 * 1024) throw httpError(400, 'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB.')
  try {
    const image = sharp(buffer, { limitInputPixels: 20000000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== formats[mime] || (metadata.pages || 1) !== 1) throw new Error('format')
    return await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  } catch { throw httpError(400, 'File ảnh lỗi, sai định dạng hoặc vượt giới hạn kích thước. Không hỗ trợ SVG/ảnh động.') }
}

export async function installContent(app, { db, client, readCampaign, listCampaigns }) {
  const content = db.collection('campaign_content'), comments = db.collection('comments')
  const favorites = db.collection('favorites'), reports = db.collection('reports')
  const images = db.collection('images'), audit = db.collection('audit')
  // TTL only cleans abandoned uploads; attached images have no expiresAt.
  await images.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await comments.createIndex({ scopeKey: 1, createdAt: 1 })
  await favorites.createIndex({ account: 1 })
  await reports.createIndex({ scopeKey: 1, resolved: 1 })
  const rates = new Map()
  const limit = (req, kind, maximum) => {
    const now = Date.now()
    for (const [key, value] of rates) if (value.until < now) rates.delete(key)
    const key = `${req.user.account}:${kind}`
    const rate = rates.get(key) || { count: 0, until: now + 60000 }
    if (++rate.count > maximum) throw httpError(429, 'Thao tác quá nhanh. Hãy chờ một phút rồi thử lại.')
    rates.set(key, rate)
  }
  async function campaign(id, user, { owner = false, publicContent = true } = {}) {
    const record = await readCampaign(id, user?.account || '')
    const metadata = await content.findOne({ _id: campaignKey(id) })
    const own = record.owner === user?.account
    if (owner && !own) throw httpError(403, 'Chỉ chủ chiến dịch được cập nhật ảnh/chủ đề.')
    if (publicContent && !own && !user?.isAdmin && (record.approvalStatus !== 'approved' || metadata?.hidden)) throw httpError(404, 'Nội dung chiến dịch chưa công khai hoặc đã ẩn.')
    return { record, metadata, own, scopeKey: campaignKey(id) }
  }
  async function decorate(record) {
    const meta = await content.findOne({ _id: campaignKey(record.campaignId) })
    return { ...record,
      ...(meta?.hidden ? { title: 'Nội dung chiến dịch đã được ẩn', description: 'Nội dung đang được quản trị viên xem xét. Quyền thanh toán trên blockchain không thay đổi.' } : {}),
      category: meta?.category || 'Cộng đồng', image: meta?.hidden ? '' : meta?.image || '', contentHidden: meta?.hidden === true }
  }
  const auditEntry = (req, action, target, reason, scopeKey) => ({ _id: randomUUID(), ...namespace,
    actor: req.user.account, action, target, reason, scopeKey, createdAt: new Date().toISOString() })
  async function transaction(work) {
    const session = client.startSession()
    try { return await session.withTransaction(() => work(session)) } finally { await session.endSession() }
  }
  app.get('/api/campaigns/:id/social', async (req, res) => {
    const { scopeKey } = await campaign(req.params.id, req.user)
    const rows = await comments.find({ scopeKey, deleted: { $ne: true } }).sort({ createdAt: 1, _id: 1 }).toArray()
    const favorite = !!req.user && !!await favorites.findOne({ _id: `${scopeKey}:${req.user.account}` })
    res.json({ favorite, comments: rows.map(c => ({ id: c._id, account: c.account, text: c.text, createdAt: c.createdAt })) })
  })
  app.post('/api/campaigns/:id/favorite', requireSession, async (req, res) => {
    limit(req, 'favorite', 30)
    const { scopeKey } = await campaign(req.params.id, req.user)
    if (typeof req.body?.favorite !== 'boolean') throw httpError(400, 'Thiếu trạng thái yêu thích.')
    const _id = `${scopeKey}:${req.user.account}`
    if (req.body.favorite) await favorites.updateOne({ _id }, { $setOnInsert: { ...namespace, scopeKey, campaignId: req.params.id, account: req.user.account, createdAt: new Date().toISOString() } }, { upsert: true })
    else await favorites.deleteOne({ _id })
    res.json({ ok: true })
  })
  app.get('/api/favorites', requireSession, async (req, res) => {
    const rows = await favorites.find({ ...namespace, account: req.user.account }).toArray()
    const campaigns = []
    for (const item of rows) {
      const { record, metadata } = await campaign(item.campaignId, req.user, { publicContent: false })
      if (!metadata?.hidden && (record.approvalStatus === 'approved' || record.owner === req.user.account)) campaigns.push(await decorate(record))
    }
    res.json({ campaigns })
  })
  app.post('/api/campaigns/:id/comments', requireSession, async (req, res) => {
    limit(req, 'comment', 10)
    const { scopeKey } = await campaign(req.params.id, req.user)
    const value = text(req.body?.text)
    await comments.insertOne({ _id: randomUUID(), ...namespace, scopeKey, campaignId: req.params.id,
      account: req.user.account, text: value, createdAt: new Date().toISOString(), deleted: false })
    res.json({ ok: true })
  })
  app.post('/api/campaigns/:id/comments/:commentId/delete', requireSession, async (req, res) => {
    const { scopeKey } = await campaign(req.params.id, req.user, { publicContent: false })
    const row = await comments.findOne({ _id: req.params.commentId, scopeKey, deleted: false })
    if (!row) throw httpError(404, 'Không tìm thấy bình luận.')
    if (row.account !== req.user.account) throw httpError(403, 'Chỉ tác giả được xóa tại đây. Quản trị viên dùng mục quản trị và ghi lý do.')
    await transaction(async session => {
      await comments.updateOne({ _id: row._id, scopeKey, account: req.user.account }, { $set: { deleted: true } }, { session })
      await audit.insertOne(auditEntry(req, 'deleteOwnComment', row._id, 'Tác giả tự xóa bình luận.', scopeKey), { session })
    })
    res.json({ ok: true })
  })
  app.post('/api/campaigns/:id/reports', requireSession, async (req, res) => {
    limit(req, 'report', 5)
    const { scopeKey } = await campaign(req.params.id, req.user)
    const reason = text(req.body?.reason, 10)
    const _id = `${scopeKey}:${req.user.account}`
    const result = await reports.updateOne({ _id }, { $setOnInsert: { ...namespace, scopeKey, campaignId: req.params.id,
      account: req.user.account, reason, resolved: false, createdAt: new Date().toISOString() } }, { upsert: true })
    if (!result.upsertedCount) throw httpError(409, 'Bạn đã báo cáo chiến dịch này. Không cần gửi lại.')
    res.json({ ok: true })
  })
  app.post('/api/campaigns/:id/image', requireSession, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }), async (req, res) => {
    limit(req, 'image', 5)
    const { scopeKey } = await campaign(req.params.id, req.user, { owner: true, publicContent: false })
    const data = await normalizeImage(req.body, req.get('Content-Type')?.split(';')[0])
    const _id = randomUUID()
    await images.insertOne({ _id, ...namespace, campaignId: req.params.id, scopeKey, owner: req.user.account,
      data, contentType: 'image/webp', sha256: createHash('sha256').update(data).digest('hex'),
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000) })
    res.json({ ok: true, image: `/api/images/${_id}` })
  })
  app.get('/api/images/:imageId', async (req, res) => {
    if (!uuid(req.params.imageId)) throw httpError(404, 'Không tìm thấy ảnh.')
    const image = await images.findOne({ _id: req.params.imageId, ...namespace })
    if (!image) throw httpError(404, 'Không tìm thấy ảnh.')
    const { metadata } = await campaign(image.campaignId, req.user)
    if (metadata?.image !== `/api/images/${image._id}` && image.owner !== req.user?.account) throw httpError(404, 'Ảnh chưa công khai.')
    res.set({ 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'private, no-store' })
    res.send(Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer))
  })
  app.post('/api/campaigns/:id/metadata', requireSession, async (req, res) => {
    limit(req, 'metadata', 10)
    const { scopeKey, metadata } = await campaign(req.params.id, req.user, { owner: true, publicContent: false })
    const category = text(req.body?.category, 1, 60)
    const image = req.body?.image === undefined ? metadata?.image || '' : req.body.image
    let imageHash = EMPTY_IMAGE_HASH, imageId
    if (image !== undefined && image !== '') {
      if (typeof image !== 'string' || !image.startsWith('/api/images/') || !uuid(image.slice(12))) throw httpError(400, 'Chỉ nhận ảnh đã tải lên cho chiến dịch này.')
      imageId = image.slice(12)
      const row = await images.findOne({ _id: imageId, scopeKey, owner: req.user.account })
      if (!row) throw httpError(403, 'Ảnh không thuộc ví và chiến dịch hiện tại.')
      imageHash = `0x${row.sha256}`
    }
    let metadataHash
    try { metadataHash = calculateMetadataHash({ category, imageHash }) } catch { throw httpError(400, 'Chủ đề không hợp lệ.') }
    await transaction(async session => {
      const update = { category, image, metadataHash, updatedAt: new Date().toISOString() }
      await content.updateOne({ _id: scopeKey }, { $set: update, $setOnInsert: { ...namespace, campaignId: req.params.id, hidden: false } }, { upsert: true, session })
      if (imageId) await images.updateOne({ _id: imageId, scopeKey }, { $unset: { expiresAt: '' } }, { session })
      if (metadata?.image && metadata.image !== image) await images.updateOne({ _id: metadata.image.slice(12), scopeKey }, { $set: { expiresAt: new Date(Date.now() + 86400000) } }, { session })
      await audit.insertOne(auditEntry(req, 'saveMetadata', req.params.id, 'Chủ chiến dịch cập nhật ảnh/chủ đề.', scopeKey), { session })
    })
    res.json({ ok: true })
  })
  app.get('/api/admin/:section', requireAdmin, async (req, res) => {
    const section = req.params.section
    let items
    if (section === 'campaigns') {
      const records = await listCampaigns(req.user.account)
      items = []
      for (const row of records) {
        const meta = await content.findOne({ _id: campaignKey(row.campaignId) })
        items.push({ id: row.campaignId, title: row.title, text: row.description, hidden: meta?.hidden === true })
      }
    } else if (section === 'comments') {
      items = (await comments.find({ ...namespace, deleted: false }).sort({ createdAt: -1 }).toArray()).map(c => ({ id: c._id, title: `Bình luận chiến dịch #${c.campaignId}`, text: c.text, createdAt: c.createdAt }))
    } else if (section === 'reports') {
      items = (await reports.find(namespace).sort({ createdAt: -1 }).toArray()).map(r => ({ id: r._id, title: `Báo cáo chiến dịch #${r.campaignId}`, text: r.reason, resolved: r.resolved, createdAt: r.createdAt }))
    } else if (section === 'audit') {
      items = (await audit.find(namespace).sort({ createdAt: -1 }).toArray()).map(a => ({ id: a._id, title: `${a.action} · ${a.target}`, text: `${a.actor}: ${a.reason}`, createdAt: a.createdAt }))
    } else throw httpError(400, 'Mục quản trị không hợp lệ.')
    res.json({ items })
  })
  app.post('/api/admin/moderate', requireAdmin, async (req, res) => {
    limit(req, 'moderate', 30)
    const { section, id, action } = req.body || {}
    if (typeof id !== 'string' || id.length > 250) throw httpError(400, 'ID không hợp lệ.')
    const reason = text(req.body.reason, 10)
    const expected = { hideCampaign: 'campaigns', restoreCampaign: 'campaigns', deleteComment: 'comments', resolveReport: 'reports' }
    if (!Object.hasOwn(expected, action) || expected[action] !== section) throw httpError(400, 'Thao tác quản trị không hợp lệ.')
    let scopeKey
    if (section === 'campaigns') scopeKey = (await campaign(id, req.user, { publicContent: false })).scopeKey
    await transaction(async session => {
      if (section === 'campaigns') {
        await content.updateOne({ _id: scopeKey }, { $set: { hidden: action === 'hideCampaign' }, $setOnInsert: { ...namespace, campaignId: id } }, { upsert: true, session })
      } else {
        const collection = section === 'comments' ? comments : reports
        const row = await collection.findOne({ _id: id, ...namespace }, { session })
        if (!row) throw httpError(404, 'Không tìm thấy nội dung.')
        scopeKey = row.scopeKey
        await collection.updateOne({ _id: id, ...namespace }, { $set: section === 'comments' ? { deleted: true } : { resolved: true } }, { session })
      }
      await audit.insertOne(auditEntry(req, action, id, reason, scopeKey), { session })
    })
    res.json({ ok: true })
  })
  return { decorate }
}
