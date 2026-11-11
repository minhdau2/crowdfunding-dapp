import express from 'express'
import { MongoClient } from 'mongodb'
import { getAddress } from 'ethers'
import { crowdfunding, provider, chainSnapshot, campaignSnapshot } from './blockchain.js'
import { installAuth } from './auth.js'
import { installContent } from './content.js'

if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong file .env')
const app = express()
const port = Number(process.env.PORT || 3001)
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
const db = client.db(process.env.MONGODB_DB || 'crowdfunding')
app.use(express.json({ limit: '16kb' }))
installAuth(app, { origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  isAdmin: async account => !!await db.collection('admins').findOne({ _id: account, enabled: true }) })
let contentService
app.get('/api/health', async (_req, res) => {
  try { await db.command({ ping: 1 }); res.json({ ok: true, database: 'connected' }) }
  catch { res.status(503).json({ error: 'Không kết nối được MongoDB.' }) }
})
app.get('/api/deployment', async (_req, res) => {
  const block = await chainSnapshot()
  res.json({ chainId: 11155111, contractAddress: await crowdfunding.getAddress(), contractVersion: 3,
    hashVersion: 2, campaignWorkflow: 'review-v1', executableVerified: true, reviewer: await crowdfunding.reviewer({ blockTag: block.number }),
    blockNumber: block.number, blockHash: block.hash })
})
app.get('/api/blockchain/campaign-count', async (_req, res) => {
  const block = await chainSnapshot()
  res.json({ chainId: 11155111, contractAddress: await crowdfunding.getAddress(), campaignCount: (await crowdfunding.campaignCount({ blockTag: block.number })).toString() })
})
const viewer = req => req.query.account ? getAddress(req.query.account).toLowerCase() : ''
async function listCampaigns(account = '') {
  const block = await chainSnapshot()
  const count = await crowdfunding.campaignCount({ blockTag: block.number })
  const campaigns = []
  for (let start = 1n; start <= count; start += 4n) {
    const ids = []
    for (let id = start; id < start + 4n && id <= count; id++) ids.push(id.toString())
    campaigns.push(...await Promise.all(ids.map(id => campaignSnapshot(id, account, block))))
  }
  return campaigns
}
app.get('/api/campaigns', async (req, res) => {
  const account = viewer(req)
  const rows = await listCampaigns(account)
  const campaigns = []
  for (const record of rows) {
    const decorated = await contentService.decorate(record)
    if (record.owner === account || record.approvalStatus === 'approved' && !decorated.contentHidden) campaigns.push(decorated)
  }
  res.json({ campaigns, hasMore: false })
})
app.get('/api/campaigns/:id', async (req, res) => res.json(await contentService.decorate(await campaignSnapshot(req.params.id, viewer(req)))))
app.post('/api/campaigns/sync', async (req, res) => {
  const record = await campaignSnapshot(req.body.campaignId)
  const contractAddress = (await crowdfunding.getAddress()).toLowerCase()
  await db.collection('campaigns').updateOne({ _id: `11155111:${contractAddress}:${record.campaignId}` },
    { $set: { ...record, chainId: 11155111, contractAddress, syncedBlock: record.snapshot.blockNumber,
      syncedBlockHash: record.snapshot.blockHash, syncedAt: new Date() } }, { upsert: true })
  res.json({ ok: true, campaign: record })
})
function handleError(error, _req, res, _next) {
  if (error.status && error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: error.type === 'entity.too.large' ? 'File/nội dung vượt giới hạn kích thước.' : error.message })
  if (error.code === 11000) return res.status(409).json({ error: 'Thao tác đã được ghi nhận. Hãy tải lại.' })
  const invalid = error.code === 'INVALID_ARGUMENT' || /ID chiến dịch/.test(error.message)
  res.status(invalid ? 400 : 503).json({ error: invalid ? 'ID hoặc địa chỉ ví không hợp lệ.' : 'Chưa đọc/đối chiếu được dữ liệu Sepolia. Kiểm tra RPC, địa chỉ và phiên bản V3.' })
}
try {
  await client.connect()
  await db.command({ ping: 1 })
  contentService = await installContent(app, { db, client, readCampaign: campaignSnapshot, listCampaigns })
  app.use(handleError)
  console.log('Đã kết nối MongoDB Atlas')
  app.listen(port, '127.0.0.1', () => console.log(`Backend: http://localhost:${port}`))
} catch {
  console.error('Không kết nối được Atlas. Kiểm tra URI, database user và Network Access.')
  await client.close()
  provider.destroy()
  process.exitCode = 1
}
