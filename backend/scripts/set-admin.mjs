import { MongoClient } from 'mongodb'
import { getAddress } from 'ethers'
import { randomUUID } from 'node:crypto'
import { CONTRACT_ADDRESS } from '../../frontend/src/lib/chainReader.js'

const account = getAddress(process.argv[2]).toLowerCase()
const enabled = !process.argv.includes('--revoke')
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || 'crowdfunding')
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      await db.collection('admins').updateOne({ _id: account }, { $set: { enabled, updatedAt: new Date().toISOString() } }, { upsert: true, session })
      await db.collection('audit').insertOne({ _id: randomUUID(), chainId: 11155111, contractAddress: CONTRACT_ADDRESS.toLowerCase(),
        actor: 'local-operator', action: enabled ? 'grantContentAdmin' : 'revokeContentAdmin', target: account,
        reason: 'Cấu hình quyền quản trị nội dung bởi người vận hành backend.', createdAt: new Date().toISOString() }, { session })
    })
  } finally { await session.endSession() }
  console.log(`${enabled ? 'Đã cấp' : 'Đã thu hồi'} quyền quản trị nội dung: ${account}`)
} catch {
  console.error('Không cập nhật được quyền. Kiểm tra MongoDB và quyền truy cập database.'); process.exitCode = 1
} finally { await client.close() }
