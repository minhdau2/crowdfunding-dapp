import test from 'node:test'
import assert from 'node:assert/strict'
import { CHAIN_ID, formatAmount, fundingPercent, hasReachedGoal, normalizeCampaign, parseAmount, uintString, validateCampaign } from '../src/lib/campaignModel.js'
import { capabilities, normalizeList, normalizeSession, runConfirmedOperation } from '../src/lib/integration.js'
import adapter from '../src/lib/integrationAdapter.js'

// Test-only fixtures. Never imported by the application.
const owner = '0x1234567890123456789012345678901234567890'
const contract = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const hash = `0x${'ab'.repeat(32)}`
const record = (values = {}) => ({ campaignId: '9007199254740993', owner, title: 'Test contract data', description: 'Test only',
  goalWei: '1000000000000000001', totalRaisedWei: '1000000000000000000', totalRefundedWei: '0',
  deadlineSeconds: '2000000000', withdrawn: false,
  snapshot: { verified: true, chainId: CHAIN_ID, contractAddress: contract, blockNumber: 123, blockTimestamp: 1999999999 }, ...values })

test('default build has no adapter or enabled operations', () => {
  assert.equal(adapter, null)
  assert.ok(Object.values(capabilities(adapter)).every(value => value === false))
})
test('missing integration cannot manufacture a successful transaction', async () => {
  await assert.rejects(runConfirmedOperation(null, { type: 'create' }, owner, () => assert.fail('No transaction expected')))
})
test('money retains one wei precision and validates positive input', () => {
  assert.equal(formatAmount(parseAmount('0.100000000000000001')), '0.100000000000000001')
  for (const value of ['0', '-1', '1e3', '0,1', '0.0000000000000000001']) assert.throws(() => parseAmount(value))
})
test('core values come from a verified snapshot and IDs remain strings', () => {
  const campaign = normalizeCampaign(record())
  assert.equal(campaign.id, '9007199254740993')
  assert.equal(campaign.goalEth, '1.000000000000000001')
  assert.equal(campaign.status, 'active')
  assert.equal(hasReachedGoal(campaign), false)
  assert.ok(fundingPercent(campaign) < 100)
  assert.throws(() => normalizeCampaign({ ...record(), snapshot: { ...record().snapshot, verified: false } }))
  assert.throws(() => normalizeCampaign({ ...record(), snapshot: { ...record().snapshot, chainId: 1 } }))
})
test('deadline and goal boundaries use block time and bigint, not local time', () => {
  const expired = record({ snapshot: { ...record().snapshot, blockTimestamp: 2000000000 } })
  assert.equal(normalizeCampaign(expired).status, 'unsuccessful')
  assert.equal(normalizeCampaign({ ...expired, totalRaisedWei: expired.goalWei }).status, 'successful')
})
test('invalid totals, unsafe dates, IDs and incomplete wallet data are rejected', () => {
  assert.throws(() => normalizeCampaign(record({ totalRefundedWei: '1000000000000000001' })))
  assert.throws(() => normalizeCampaign(record({ deadlineSeconds: (2n ** 255n).toString() })))
  assert.throws(() => normalizeCampaign(record({ viewer: owner })))
  for (const value of [1, '0', '-1', '1.5', (2n ** 256n).toString()]) assert.throws(() => uintString(value, true))
})
test('wallet/contract mismatch and duplicate campaign data fail closed', () => {
  assert.throws(() => normalizeList({ campaigns: [record()] }, owner))
  assert.throws(() => normalizeList({ campaigns: [record(), record()] }, ''))
  assert.throws(() => normalizeList({ campaigns: [record(), record({ campaignId: '2', snapshot: { ...record().snapshot, contractAddress: owner } })] }, ''))
  assert.deepEqual(normalizeList({ campaigns: [] }, ''), { campaigns: [], hasMore: false })
})
test('admin is never inferred from wallet connection alone or from another chain', () => {
  assert.equal(normalizeSession({ account: owner, chainId: CHAIN_ID, isAdmin: true }).isAdmin, false)
  assert.equal(normalizeSession({ account: owner, chainId: 1, authenticated: true, isAdmin: true }).isAdmin, false)
  assert.deepEqual(normalizeSession(null), { account: '', chainId: null, authenticated: false, isAdmin: false, isReviewer: false })
})
test('proposal form validates duration instead of guessing an approval deadline', () => {
  const values = { title: 'New', description: 'Description', goalEth: '0.01', durationDays: '7' }
  assert.doesNotThrow(() => validateCampaign(values))
  assert.throws(() => validateCampaign({ ...values, goalEth: '0' }))
  for (const durationDays of ['', '0', '-1', '1.5', '91', '7e0']) assert.throws(() => validateCampaign({ ...values, durationDays }))
})

test('legacy adapters cannot send proposal durations into old createCampaign deadline', async () => {
  let sent = false
  const service = { create: async () => { sent = true } }
  assert.equal(capabilities(service).create, false)
  await assert.rejects(runConfirmedOperation(service, { type: 'create' }, owner, () => {}))
  assert.equal(sent, false)
  assert.equal(capabilities({ ...service, campaignWorkflow: 'review-v1' }).create, true)
})

test('pending and rejected have no deadline and are not failed fundraising campaigns', () => {
  const pending = record({ approvalStatus: 'pending', durationSeconds: '604800', approvedAtSeconds: '0',
    deadlineSeconds: '0', totalRaisedWei: '0' })
  const normalized = normalizeCampaign(pending)
  assert.equal(normalized.status, 'pending')
  assert.equal(normalized.deadline, null)
  assert.equal(normalizeCampaign({ ...pending, approvalStatus: 'rejected', rejectionReason: 'Insufficient information' }).status, 'rejected')
  assert.throws(() => normalizeCampaign({ ...pending, approvalStatus: 'rejected' }))
  assert.throws(() => normalizeCampaign({ ...pending, totalRaisedWei: '1' }))
})

test('approved deadline is bound to approval time plus submitted duration', () => {
  const approved = record({ approvalStatus: 'approved', durationSeconds: '604800', approvedAtSeconds: '1999395200' })
  assert.equal(normalizeCampaign(approved).status, 'active')
  assert.throws(() => normalizeCampaign({ ...approved, approvedAtSeconds: '0' }))
  assert.throws(() => normalizeCampaign({ ...approved, deadlineSeconds: '2000000001' }))
})

test('backend admin does not implicitly have the on-chain reviewer role', () => {
  assert.equal(normalizeSession({ account: owner, chainId: CHAIN_ID, authenticated: true, isAdmin: true }).isReviewer, false)
  assert.equal(normalizeSession({ account: owner, chainId: 1, authenticated: true, isReviewer: true }).isReviewer, false)
})
test('transaction success waits for a receipt; no optimistic money changes', async () => {
  let settle
  let submitted
  let completed = false
  const result = runConfirmedOperation({ contribute: async () => ({ hash, wait: () => new Promise(resolve => { settle = resolve }) }) },
    { type: 'contribute', id: '1', amount: '0.01' }, owner, value => { submitted = value }).then(value => { completed = true; return value })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(submitted, hash)
  assert.equal(completed, false)
  settle({ status: 1, hash })
  assert.equal((await result).hash, hash)
})
test('failed or incomplete receipts never signal success', async () => {
  for (const receipt of [{ status: 0, hash }, undefined, { status: 1 }]) {
    await assert.rejects(runConfirmedOperation({ refund: async () => ({ hash, wait: async () => receipt }) }, { type: 'refund' }, owner, () => {}))
  }
  await assert.rejects(runConfirmedOperation({ create: async () => ({ ok: true }) }, { type: 'create' }, owner, () => {}))
})
test('replacement is accepted only with a successful receipt and is not a cancellation', async () => {
  const replacement = { code: 'TRANSACTION_REPLACED', cancelled: false, receipt: { status: 1, hash } }
  const service = { withdraw: async () => ({ hash, wait: async () => { throw replacement } }) }
  assert.equal((await runConfirmedOperation(service, { type: 'withdraw' }, owner, () => {})).hash, hash)
  replacement.cancelled = true
  await assert.rejects(runConfirmedOperation(service, { type: 'withdraw' }, owner, () => {}))
})
