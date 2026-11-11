import { Contract, JsonRpcProvider } from 'ethers'
import abi from '../frontend/src/contracts/CrowdfundingV3.json' with { type: 'json' }
import { CONTRACT_ADDRESS, checkDeployment, readCampaign } from '../frontend/src/lib/chainReader.js'

if (!process.env.SEPOLIA_RPC_URL) throw new Error('Thiếu SEPOLIA_RPC_URL trong backend/.env')
export const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL)
export const crowdfunding = new Contract(process.env.CROWDFUNDING_ADDRESS || CONTRACT_ADDRESS, abi, provider)
export async function chainSnapshot() {
  const block = await provider.getBlock('latest')
  if (!block) throw new Error('Chưa đọc được block Sepolia.')
  await checkDeployment(provider, crowdfunding, block.number)
  return block
}
export async function campaignSnapshot(id, account = '', block) {
  block ||= await chainSnapshot()
  const record = await readCampaign(crowdfunding, block, id, account)
  const current = await provider.getBlock(block.number)
  if (!current || current.hash !== block.hash) throw new Error('Block đã thay đổi; hãy tải lại.')
  return record
}
