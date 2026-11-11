import { ZeroHash, getAddress, keccak256 } from 'ethers'
import { proposalDigest, decisionDigest } from '../contracts/financialHashes.js'

export const CONTRACT_ADDRESS = '0x407145f033F6e19F21e5118ffCA15f0B3644cD55'
// Source compiled with solc 0.8.34, cancun, optimizer OFF; metadata excluded.
export const EXECUTABLE_HASH = '0x73d3c75377d5dd3f735d867834a45c789ddbb8c9e865d866890fc2dd18732da8'
export function executableHash(code) {
  if (!/^0x[0-9a-fA-F]+$/.test(code) || code.length < 6) throw new Error('Bytecode không hợp lệ.')
  const metadataLength = Number.parseInt(code.slice(-4), 16)
  const end = code.length - (metadataLength + 2) * 2
  if (end <= 2 || code.length % 2 !== 0) throw new Error('Metadata bytecode không hợp lệ.')
  return keccak256(code.slice(0, end))
}
export async function checkDeployment(provider, contract, blockTag = 'latest') {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Hãy chọn Ethereum Sepolia.')
  const address = await contract.getAddress()
  if (getAddress(address) !== getAddress(CONTRACT_ADDRESS)) throw new Error('Địa chỉ không khớp deployment V3 đã bàn giao.')
  const options = { blockTag }
  const [code, version, hashVersion, workflow] = await Promise.all([
    provider.getCode(address, blockTag), contract.CONTRACT_VERSION(options), contract.HASH_VERSION(options), contract.CAMPAIGN_WORKFLOW(options),
  ])
  if (code === '0x' || version !== 3n || hashVersion !== 2n || workflow !== 'review-v1') throw new Error('Chưa xác minh được phiên bản contract V3.')
  if (executableHash(code) !== EXECUTABLE_HASH) throw new Error('Bytecode không khớp source V3 đã đối chiếu.')
}

export async function readCampaign(contract, block, campaignId, account = '') {
  if (typeof campaignId !== 'string' || !/^[1-9]\d{0,77}$/.test(campaignId) || BigInt(campaignId) >= 2n ** 256n) throw new Error('ID chiến dịch không hợp lệ.')
  const opts = { blockTag: block.number }
  const c = await contract.getCampaign(campaignId, opts)
  const context = { chainId: 11155111, contractAddress: await contract.getAddress(), campaignId }
  const record = {
    campaignId, owner: c.owner.toLowerCase(), title: c.title, description: c.description,
    goalWei: c.goal.toString(), deadlineSeconds: c.deadline.toString(), totalRaisedWei: c.totalRaised.toString(),
    totalRefundedWei: c.totalRefunded.toString(), withdrawn: c.withdrawn,
    durationSeconds: c.durationSeconds.toString(), submittedAt: c.submittedAt.toString(),
    approvedAtSeconds: c.approvedAt.toString(), rejectionReason: c.rejectionReason,
    decidedBy: c.decidedBy, decidedAt: c.decidedAt.toString(),
  }
  const status = Number(c.approvalStatus)
  if (![0, 1, 2].includes(status)) throw new Error('Trạng thái duyệt không hợp lệ.')
  record.approvalStatus = ['pending', 'approved', 'rejected'][status]
  const [proposal, decision, alias, approval] = await Promise.all([
    contract.proposalHash(campaignId, opts), contract.decisionHash(campaignId, opts),
    contract.campaignHash(campaignId, opts), contract.approvalHash(campaignId, opts),
  ])
  const expectedProposal = proposalDigest({ ...context, ...record })
  const expectedDecision = status === 0 ? ZeroHash : decisionDigest({ ...context, ...record,
    approvalStatus: BigInt(status), proposalHash: proposal, approvedAt: record.approvedAtSeconds })
  if (proposal !== expectedProposal || alias !== proposal || decision !== expectedDecision || approval !== (status === 1 ? decision : ZeroHash)) {
    throw new Error('Hash chiến dịch không khớp dữ liệu blockchain.')
  }
  if (account) {
    record.viewer = getAddress(account).toLowerCase()
    const [amount, refunded] = await Promise.all([contract.contributions(campaignId, account, opts), contract.refunded(campaignId, account, opts)])
    record.contributionWei = amount.toString()
    record.hasRefunded = refunded
  }
  record.proposalHash = proposal
  record.decisionHash = decision
  record.snapshot = { verified: true, ...context, blockNumber: block.number, blockTimestamp: block.timestamp, blockHash: block.hash }
  return record
}
