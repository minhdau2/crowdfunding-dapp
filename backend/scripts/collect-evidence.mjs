import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getAddress } from 'ethers'
import { provider, crowdfunding, chainSnapshot, campaignSnapshot } from '../blockchain.js'
import { CONTRACT_ADDRESS, executableHash } from '../../frontend/src/lib/chainReader.js'
import { receiptDigest } from '../../frontend/src/contracts/financialHashes.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const deployHash = '0x2d9c5ad35ba5b72731cef0884f0410bd37e475b1e0b3c704c9a163b5b2a27b0d'
try {
  const anchor = await chainSnapshot()
  const receipt = await provider.getTransactionReceipt(deployHash)
  const deployTx = await provider.getTransaction(deployHash)
  if (!receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase() || deployTx.to !== null) throw new Error('Deployment receipt mismatch')
  const code = await provider.getCode(CONTRACT_ADDRESS, anchor.number)
  const count = await crowdfunding.campaignCount({ blockTag: anchor.number })
  const campaigns = []
  for (let id = 1n; id <= count; id++) campaigns.push(await campaignSnapshot(id.toString(), '', anchor))
  const logs = []
  let step = 2000
  for (let start = receipt.blockNumber; start <= anchor.number;) {
    const end = Math.min(start + step - 1, anchor.number)
    try { logs.push(...await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: start, toBlock: end })); start = end + 1 }
    catch (error) { if (step === 1) throw error; step = Math.max(1, Math.floor(step / 2)) }
  }
  const receipts = new Map(), blocks = new Map(), events = []
  for (const log of logs) {
    let parsed
    try { parsed = crowdfunding.interface.parseLog(log) } catch { continue }
    if (!parsed) continue
    if (!receipts.has(log.transactionHash)) receipts.set(log.transactionHash, await provider.getTransactionReceipt(log.transactionHash))
    const txReceipt = receipts.get(log.transactionHash)
    if (!txReceipt || txReceipt.status !== 1 || txReceipt.blockHash !== log.blockHash) throw new Error('Event receipt mismatch')
    if (!blocks.has(log.blockNumber)) blocks.set(log.blockNumber, await provider.getBlock(log.blockNumber))
    const block = blocks.get(log.blockNumber)
    if (block.hash !== log.blockHash) throw new Error('Block reorg during collection')
    const args = Object.fromEntries(parsed.fragment.inputs.map((input, i) => [input.name, typeof parsed.args[i] === 'bigint' ? parsed.args[i].toString() : parsed.args[i]]))
    const event = { name: parsed.name, args, transactionHash: log.transactionHash, logIndex: log.index,
      blockNumber: log.blockNumber, blockHash: log.blockHash, timestamp: new Date(block.timestamp * 1000).toISOString(),
      receiptStatus: txReceipt.status, sender: txReceipt.from,
      explorer: `https://sepolia.etherscan.io/tx/${log.transactionHash}` }
    if (parsed.name === 'PaymentReceipt') {
      const expected = receiptDigest({ chainId: 11155111, contractAddress: CONTRACT_ADDRESS, ...args })
      const onChain = await crowdfunding.receiptHash(args.receiptId, { blockTag: anchor.number })
      if (expected !== args.digest || onChain !== args.digest) throw new Error('Payment receipt digest mismatch')
      event.paymentDigestVerified = true
    }
    events.push(event)
  }
  if ((await provider.getBlock(anchor.number)).hash !== anchor.hash) throw new Error('Anchor block changed; collect again')
  const files = ['blockchain/contracts/Crowdfunding.sol', 'frontend/src/contracts/CrowdfundingV3.json', 'frontend/src/lib/chainReader.js',
    'frontend/src/lib/integrationAdapter.js', 'backend/server.js', 'backend/auth.js', 'backend/content.js', 'backend/package-lock.json']
  const sourceSha256 = {}
  for (const file of files) sourceSha256[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')
  let finalizedBlock = null
  try { finalizedBlock = (await provider.getBlock('finalized'))?.number || null } catch { /* Provider may not support finalized. */ }
  const collectedAt = new Date().toISOString()
  const report = {
    collectedAt, source: 'Sepolia RPC; receipts + canonical logs + same-block getters; no UI assertions',
    git: { headAtCollection: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() },
    sourceSha256, chainId: 11155111, contractAddress: CONTRACT_ADDRESS,
    deployment: { transactionHash: deployHash, status: receipt.status, blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash, deployer: receipt.from, initialReviewer: getAddress('0x' + deployTx.data.slice(-40)),
      constructorMethod: 'Last ABI address word of direct contract-creation input; source runtime independently matched.' },
    verification: { contractVersion: '3', hashVersion: '2', workflow: 'review-v1', executableHash: executableHash(code),
      runtimeBytes: (code.length - 2) / 2, compiler: '0.8.34', evm: 'cancun', optimizer: false, viaIR: false,
      note: 'Executable bytes match source with optimizer OFF; historical build/tests used optimizer ON. Metadata not asserted equal.' },
    anchor: { number: anchor.number, hash: anchor.hash, timestamp: new Date(anchor.timestamp * 1000).toISOString(), finalizedBlock },
    reviewer: await crowdfunding.reviewer({ blockTag: anchor.number }), campaigns,
    eventCounts: Object.fromEntries([...new Set(events.map(e => e.name))].map(name => [name, events.filter(e => e.name === name).length])),
    events,
    acceptance: Object.fromEntries(['CampaignSubmitted', 'CampaignApproved', 'CampaignRejected', 'ContributionReceived', 'FundsWithdrawn', 'RefundClaimed'].map(name => [name,
      events.some(e => e.name === name) ? 'On-chain evidence recorded; UI/manual acceptance not asserted.' : 'No successful event found in collected deployment history.'])),
    notVerified: ['Manual MetaMask/UI end-to-end acceptance', '49 Solidity tests rerun with actual optimizer OFF settings',
      'All negative wallet cases: cancellation, insufficient gas, wallet/network changes during signing', 'Full compiler metadata equivalence'],
  }
  const directory = path.join(root, 'docs', 'evidence')
  await mkdir(directory, { recursive: true })
  const output = path.join(directory, `sepolia-${collectedAt.replaceAll(':', '-')}.json`)
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output, anchor: anchor.number, campaigns: campaigns.length, eventCounts: report.eventCounts }))
} catch (error) {
  console.error(`Không thu thập được bằng chứng: ${error.shortMessage || error.message}`)
  process.exitCode = 1
} finally { provider.destroy() }
