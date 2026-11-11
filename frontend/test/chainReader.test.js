import test from 'node:test'
import assert from 'node:assert/strict'
import { ZeroAddress, ZeroHash, keccak256 } from 'ethers'
import { readCampaign, CONTRACT_ADDRESS, checkDeployment, executableHash } from '../src/lib/chainReader.js'
import { proposalDigest } from '../src/contracts/financialHashes.js'

const block = { number: 100, timestamp: 1000, hash: `0x${'12'.repeat(32)}` }
const owner = '0x1234567890123456789012345678901234567890'
const c = { owner, title: 'Title', description: 'Description', goal: 1n, deadline: 0n,
  totalRaised: 0n, totalRefunded: 0n, withdrawn: false, durationSeconds: 86400n,
  submittedAt: 900n, approvedAt: 0n, approvalStatus: 0n, rejectionReason: '', decidedBy: ZeroAddress, decidedAt: 0n }
function mock(bad = false) {
  const digest = proposalDigest({ chainId: 11155111, contractAddress: CONTRACT_ADDRESS, campaignId: '1', owner, goalWei: '1', durationSeconds: '86400' })
  const atBlock = value => async (...args) => { assert.equal(args.at(-1).blockTag, 100); return value }
  return { getAddress: async () => CONTRACT_ADDRESS, getCampaign: atBlock(c), proposalHash: atBlock(bad ? ZeroHash : digest),
    campaignHash: atBlock(digest), decisionHash: atBlock(ZeroHash), approvalHash: atBlock(ZeroHash),
    contributions: atBlock(0n), refunded: atBlock(false) }
}
test('chain reader uses the same block and binds viewer without losing precision', async () => {
  const result = await readCampaign(mock(), block, '1', owner)
  assert.equal(result.approvalStatus, 'pending')
  assert.equal(result.viewer, owner)
  assert.equal(result.goalWei, '1')
  assert.equal(result.snapshot.blockHash, block.hash)
})
test('tampered proposal hashes and invalid IDs fail closed', async () => {
  await assert.rejects(readCampaign(mock(true), block, '1'), /Hash/)
  await assert.rejects(readCampaign(mock(), block, '0'), /ID/)
})
test('metadata is excluded but matching getters cannot bypass executable verification', async () => {
  assert.equal(executableHash('0x6000aabb0002'), keccak256('0x6000'))
  assert.equal(executableHash('0x6000ccdd0002'), keccak256('0x6000'))
  const provider = { getNetwork: async () => ({ chainId: 11155111n }), getCode: async () => '0x6000aabb0002' }
  const contract = { getAddress: async () => CONTRACT_ADDRESS, CONTRACT_VERSION: async () => 3n,
    HASH_VERSION: async () => 2n, CAMPAIGN_WORKFLOW: async () => 'review-v1' }
  await assert.rejects(checkDeployment(provider, contract), /Bytecode/)
  await assert.rejects(checkDeployment({ ...provider, getNetwork: async () => ({ chainId: 1n }) }, contract), /Sepolia/)
})
