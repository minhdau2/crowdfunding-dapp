import { Contract, JsonRpcProvider } from 'ethers'

import abi from '../frontend/src/contracts/Crowdfunding.json' with {
  type: 'json',
}

export const provider = new JsonRpcProvider(
  process.env.SEPOLIA_RPC_URL,
)

export const crowdfunding = new Contract(
  process.env.CROWDFUNDING_ADDRESS,
  abi,
  provider,
)