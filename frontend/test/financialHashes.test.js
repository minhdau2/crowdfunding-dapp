import test from 'node:test'
import assert from 'node:assert/strict'
import vectors from './fixtures/review-hash-vectors.json' with { type: 'json' }
import { decisionDigest, proposalDigest, receiptDigest } from '../src/contracts/financialHashes.js'

// Vectors captured from V3 production bytecode on LOCAL Remix Simulator, not Sepolia.
test('proposal encoder matches the production-bytecode vector', () => {
  const value = vectors.vectors.proposal
  assert.equal(proposalDigest(value.values), value.digest)
  assert.notEqual(proposalDigest({ ...value.values, goalWei: (BigInt(value.values.goalWei) + 1n).toString() }), value.digest)
})
test('approval and UTF-8 rejection encoders match production-bytecode vectors', () => {
  for (const kind of ['approval', 'rejection']) {
    const value = vectors.vectors[kind]
    assert.equal(decisionDigest(value.values), value.digest)
    assert.notEqual(decisionDigest({ ...value.values, rejectionReason: `${value.values.rejectionReason} changed` }), value.digest)
  }
})
test('payment encoder matches the production-bytecode vector', () => {
  const value = vectors.vectors.payment
  assert.equal(receiptDigest(value.values), value.digest)
  assert.notEqual(receiptDigest({ ...value.values, kind: '2' }), value.digest)
})
test('hash encoders reject unsafe monetary numbers, invalid enums and overflow', () => {
  const proposal = vectors.vectors.proposal.values
  assert.throws(() => proposalDigest({ ...proposal, goalWei: Number.MAX_SAFE_INTEGER + 1 }))
  assert.throws(() => proposalDigest({ ...proposal, durationSeconds: (2n ** 256n).toString() }))
  assert.throws(() => decisionDigest({ ...vectors.vectors.approval.values, approvalStatus: '0' }))
  assert.throws(() => receiptDigest({ ...vectors.vectors.payment.values, kind: '3' }))
})
