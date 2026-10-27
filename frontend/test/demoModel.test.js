import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOperation, campaignStatus, createDemoData, DEMO_ACCOUNTS, formatAmount, parseAmount } from '../src/lib/demoModel.js'

const [alice, bob] = DEMO_ACCOUNTS

test('ETH keeps all 18 decimal digits and rejects invalid amounts', () => {
  assert.equal(formatAmount(parseAmount('0.100000000000000001')), '0.100000000000000001')
  for (const amount of ['0', '-1', '1e3', '0,1', '0.0000000000000000001']) assert.throws(() => parseAmount(amount))
})

test('multiple contributions add exactly and do not change other campaigns', () => {
  const original = createDemoData()
  let data = applyOperation(original, { type: 'contribute', id: 1, amount: '0.1' }, alice)
  data = applyOperation(data, { type: 'contribute', id: 1, amount: '0.2' }, alice)
  assert.equal(data.campaigns[0].totalRaisedEth, '0.7')
  assert.equal(data.campaigns[0].contributions[alice], '0.7')
  assert.deepEqual(data.campaigns[1], original.campaigns[1])
  assert.equal(original.campaigns[0].totalRaisedEth, '0.4')
})

test('at the deadline contributions close and enough funding still waits until deadline', () => {
  const data = createDemoData()
  const campaign = data.campaigns[0]
  const deadline = new Date(campaign.deadline).getTime()
  const funded = applyOperation(data, { type: 'contribute', id: 1, amount: '2' }, alice, deadline - 1)
  assert.equal(campaignStatus(funded.campaigns[0], deadline - 1), 'active')
  assert.throws(() => applyOperation(funded, { type: 'withdraw', id: 1 }, bob, deadline - 1))
  assert.throws(() => applyOperation(funded, { type: 'contribute', id: 1, amount: '1' }, alice, deadline))
  assert.equal(campaignStatus(funded.campaigns[0], deadline), 'successful')
})

test('only owner withdraws once after successful deadline', () => {
  const data = createDemoData()
  assert.throws(() => applyOperation(data, { type: 'withdraw', id: 2 }, bob))
  const next = applyOperation(data, { type: 'withdraw', id: 2 }, alice)
  assert.equal(next.campaigns[1].withdrawn, true)
  assert.throws(() => applyOperation(next, { type: 'withdraw', id: 2 }, alice))
})

test('refund only failed campaigns, once per contributor, preserving historical totals', () => {
  const data = createDemoData()
  assert.throws(() => applyOperation(data, { type: 'refund', id: 2 }, alice))
  const next = applyOperation(data, { type: 'refund', id: 3 }, alice)
  assert.equal(next.campaigns[2].refunded[alice], true)
  assert.equal(next.campaigns[2].totalRaisedEth, '0.2')
  assert.equal(next.campaigns[2].contributions[alice], '0.1')
  assert.throws(() => applyOperation(next, { type: 'refund', id: 3 }, alice))
  assert.equal(applyOperation(next, { type: 'refund', id: 3 }, bob).campaigns[2].refunded[bob], true)
})

test('create validates input and starts with zero contributions', () => {
  const data = createDemoData()
  const values = { title: 'Chiến dịch mới', description: 'Mô tả', goalEth: '0.01', deadline: new Date(Date.now() + 86400000).toISOString() }
  const next = applyOperation(data, { type: 'create', values }, alice)
  assert.equal(next.campaigns[0].owner, alice)
  assert.equal(next.campaigns[0].totalRaisedEth, '0')
  assert.equal(campaignStatus(next.campaigns[0]), 'active')
  assert.throws(() => applyOperation(data, { type: 'create', values: { ...values, title: ' ' } }, alice))
  assert.throws(() => applyOperation(data, { type: 'create', values: { ...values, deadline: '2020-01-01' } }, alice))
  assert.throws(() => applyOperation(data, { type: 'create', values }, ''))
})
