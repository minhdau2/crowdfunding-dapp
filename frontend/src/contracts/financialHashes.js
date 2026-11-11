import { AbiCoder, getAddress, id, isHexString, keccak256 } from 'ethers'

// V3 contract / review-v1 workflow. Pure encoding helpers, not RPC verification.
export const FINANCIAL_HASH_VERSION = 2n
const coder = AbiCoder.defaultAbiCoder()
function uint(value, positive = false) {
  if (typeof value !== 'bigint' && (typeof value !== 'string' || !/^(0|[1-9]\d{0,77})$/.test(value))) {
    throw new Error('Use a bigint or decimal string for on-chain integers.')
  }
  const result = BigInt(value)
  if (result < (positive ? 1n : 0n) || result >= 2n ** 256n) throw new Error('Integer outside uint256 range.')
  return result
}
function context({ chainId, contractAddress }) {
  const chain = typeof chainId === 'number' && Number.isSafeInteger(chainId) ? BigInt(chainId) : chainId
  return [FINANCIAL_HASH_VERSION, uint(chain, true), getAddress(contractAddress)]
}

export function proposalDigest(values) {
  return keccak256(coder.encode(
    ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'address', 'uint256', 'uint256'],
    [id('CHUNG_TAY_PROPOSAL'), ...context(values), uint(values.campaignId, true),
      getAddress(values.owner), uint(values.goalWei, true), uint(values.durationSeconds, true)],
  ))
}

export function decisionDigest(values) {
  const status = uint(values.approvalStatus)
  if (status !== 1n && status !== 2n) throw new Error('Decision status must be Approved (1) or Rejected (2).')
  if (!isHexString(values.proposalHash, 32) || typeof values.rejectionReason !== 'string') throw new Error('Invalid decision fields.')
  return keccak256(coder.encode(
    ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'bytes32', 'uint8', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
    [id('CHUNG_TAY_DECISION'), ...context(values), uint(values.campaignId, true), values.proposalHash,
      status, getAddress(values.decidedBy), uint(values.decidedAt, true), uint(values.approvedAt),
      uint(values.deadlineSeconds), keccak256(new TextEncoder().encode(values.rejectionReason))],
  ))
}

export function receiptDigest(values) {
  const kind = uint(values.kind)
  if (kind > 2n) throw new Error('Unknown payment kind.')
  return keccak256(coder.encode(
    ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'uint8', 'uint256', 'address', 'uint256'],
    [id('CHUNG_TAY_RECEIPT'), ...context(values), uint(values.receiptId, true), kind,
      uint(values.campaignId, true), getAddress(values.account), uint(values.amountWei, true)],
  ))
}
