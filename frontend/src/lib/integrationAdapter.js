import { BrowserProvider, Contract } from 'ethers'
import abi from '../contracts/CrowdfundingV3.json' with { type: 'json' }
import { CONTRACT_ADDRESS, checkDeployment, readCampaign } from './chainReader.js'
import { parseAmount, validateCampaign } from './campaignModel.js'

export async function api(path, body) {
  const binary = typeof Blob !== 'undefined' && body instanceof Blob
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': binary ? body.type : 'application/json' }, body: binary ? body : JSON.stringify(body) }) })
  let result
  try { result = await response.json() } catch { throw new Error('Backend chưa sẵn sàng. Hãy kiểm tra terminal backend.') }
  if (!response.ok) {
    if (response.status === 401) publish({ ...session, authenticated: false, isAdmin: false, isReviewer: false })
    if (response.status === 403 && path.startsWith('/admin')) publish({ ...session, isAdmin: false })
    throw new Error(result.error || 'Không kết nối được backend.')
  }
  return result
}
const empty = () => ({ account: '', chainId: null, authenticated: false, isAdmin: false, isReviewer: false })
const listeners = new Set()
let epoch = 0, suppress = false, session = empty(), attached = false
let invalidation = Promise.resolve()
function wallet() {
  if (!window.ethereum) throw new Error('Hãy cài và mở khóa MetaMask trong trình duyệt này.')
  return window.ethereum
}
function publish(value) { session = value; for (const callback of listeners) callback(value); return value }
async function getSession() {
  const current = epoch
  if (suppress) return session
  if (!window.ethereum) return empty()
  const [accounts, chain] = await Promise.all([wallet().request({ method: 'eth_accounts' }), wallet().request({ method: 'eth_chainId' })])
  const account = accounts[0]?.toLowerCase() || '', chainId = Number(BigInt(chain))
  let authenticated = false, isReviewer = false, isAdmin = false
  if (account && chainId === 11155111) {
    const auth = await api('/auth/session')
    authenticated = auth.authenticated && auth.account === account
    isAdmin = authenticated && auth.isAdmin === true
    const provider = new BrowserProvider(wallet())
    const contract = new Contract(CONTRACT_ADDRESS, abi, provider)
    await checkDeployment(provider, contract)
    isReviewer = await contract.isReviewer(account)
  }
  if (current !== epoch || suppress) return session
  return publish({ account, chainId, authenticated, isAdmin, isReviewer })
}
function invalidate() {
  epoch++
  publish(empty())
  // Serialize invalidation so a previous wallet event cannot revoke a new login.
  invalidation = invalidation.catch(() => {}).then(() => api('/auth/logout', {}))
  invalidation.then(() => getSession()).catch(() => publish(empty()))
}
function attach() {
  if (attached || !window.ethereum) return
  attached = true
  wallet().on('accountsChanged', invalidate)
  wallet().on('chainChanged', invalidate)
  wallet().on('disconnect', invalidate)
}
async function signerFor(account) {
  await invalidation
  const next = await getSession()
  if (!next.authenticated || next.account !== account.toLowerCase() || next.chainId !== 11155111) throw new Error('Hãy kết nối đúng ví, chuyển Sepolia và ký đăng nhập lại.')
  const provider = new BrowserProvider(wallet())
  const signer = await provider.getSigner(account)
  const contract = new Contract(CONTRACT_ADDRESS, abi, signer)
  await checkDeployment(provider, contract)
  return contract
}
async function checkedRecord(record, account = '') {
  // Independently read the block and financial fields through the wallet when available.
  // Public browsing uses the backend's trusted, same-block RPC verification.
  if (!window.ethereum) return record
  const provider = new BrowserProvider(wallet())
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Hãy chuyển ví sang Ethereum Sepolia để đọc dữ liệu.')
  const contract = new Contract(CONTRACT_ADDRESS, abi, provider)
  const block = await provider.getBlock(record.snapshot.blockNumber)
  if (!block || block.hash !== record.snapshot.blockHash) throw new Error('Block không khớp. Hãy tải lại.')
  await checkDeployment(provider, contract, block.number)
  const verified = await readCampaign(contract, block, record.campaignId, account)
  return { ...verified, image: record.image, category: record.category, contentHidden: record.contentHidden === true }
}
async function contentAccount(account) {
  await invalidation
  const current = await getSession()
  if (!current.authenticated || current.chainId !== 11155111 || account && current.account !== account.toLowerCase()) throw new Error('Hãy đăng nhập lại bằng đúng ví.')
  return current
}
const adapter = {
  campaignWorkflow: 'review-v1',
  getSession,
  subscribeSession(callback) {
    attach(); listeners.add(callback)
    const timer = setInterval(() => { if (!suppress) getSession().catch(() => publish(empty())) }, 30000)
    return () => { listeners.delete(callback); clearInterval(timer) }
  },
  async connect() {
    suppress = false; attach()
    await wallet().request({ method: 'eth_requestAccounts' })
    await invalidation
    return getSession()
  },
  async switchNetwork() {
    await wallet().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] })
    await invalidation
    return getSession()
  },
  async login() {
    await invalidation
    suppress = false
    const before = await getSession(), current = epoch
    if (!before.account || before.chainId !== 11155111) throw new Error('Kết nối ví và chọn Sepolia trước khi đăng nhập.')
    const challenge = await api('/auth/nonce', { account: before.account })
    const signer = await new BrowserProvider(wallet()).getSigner(before.account)
    const signature = await signer.signMessage(challenge.message)
    if (epoch !== current) throw new Error('Ví đã thay đổi trong lúc ký. Hãy đăng nhập lại.')
    await api('/auth/verify', { nonce: challenge.nonce, signature })
    if (epoch !== current) { await api('/auth/logout', {}); throw new Error('Ví đã thay đổi. Hãy đăng nhập lại.') }
    return getSession()
  },
  async logout() { epoch++; suppress = true; await invalidation.catch(() => {}); await api('/auth/logout', {}); return publish(empty()) },
  async loadCampaigns({ account = '' }) {
    const result = await api(`/campaigns?account=${encodeURIComponent(account)}`)
    const campaigns = []
    for (const record of result.campaigns) campaigns.push(await checkedRecord(record, account))
    return { campaigns, hasMore: result.hasMore }
  },
  async loadCampaign({ id, account = '' }) { return checkedRecord(await api(`/campaigns/${id}?account=${encodeURIComponent(account)}`), account) },
  async loadSocial({ id }) { return api(`/campaigns/${id}/social`) },
  async loadFavorites({ account }) {
    await contentAccount(account)
    const result = await api('/favorites')
    const campaigns = []
    for (const row of result.campaigns) campaigns.push(await checkedRecord(row, account))
    return { campaigns }
  },
  async toggleFavorite({ id, account }) {
    await contentAccount(account)
    const current = await api(`/campaigns/${id}/social`)
    return api(`/campaigns/${id}/favorite`, { favorite: !current.favorite })
  },
  async addComment({ id, account, text }) { await contentAccount(account); return api(`/campaigns/${id}/comments`, { text }) },
  async deleteComment({ id, account, commentId }) { await contentAccount(account); return api(`/campaigns/${id}/comments/${encodeURIComponent(commentId)}/delete`, {}) },
  async reportCampaign({ id, account, reason }) { await contentAccount(account); return api(`/campaigns/${id}/reports`, { reason }) },
  async uploadImage({ id, account, file }) {
    await contentAccount(account)
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Chọn ảnh PNG, JPEG hoặc WebP tối đa 5 MB.')
    return api(`/campaigns/${id}/image`, file)
  },
  async saveMetadata({ id, account, category, image }) { await contentAccount(account); return api(`/campaigns/${id}/metadata`, { category, ...(image === undefined ? {} : { image }) }) },
  async loadAdmin({ section }) {
    const current = await contentAccount()
    if (!current.isAdmin) throw new Error('Ví chưa được cấp quyền quản trị nội dung.')
    return api(`/admin/${encodeURIComponent(section)}`)
  },
  async moderate({ section, id, action, reason }) { await contentAccount(); return api('/admin/moderate', { section, id, action, reason }) },
  async loadPendingCampaigns({ account }) {
    const contract = await signerFor(account)
    if (!await contract.isReviewer(account)) throw new Error('Ví không có quyền duyệt.')
    const provider = contract.runner.provider
    const block = await provider.getBlock('latest')
    const count = await contract.campaignCount({ blockTag: block.number })
    const campaigns = []
    for (let id = 1n; id <= count; id++) {
      const record = await readCampaign(contract, block, id.toString(), account)
      if (record.approvalStatus === 'pending') campaigns.push(record)
    }
    return { campaigns, hasMore: false }
  },
  async create({ account, values }) {
    validateCampaign(values)
    const contract = await signerFor(account)
    return contract.submitCampaign(values.title.trim(), values.description.trim(), parseAmount(values.goalEth), BigInt(values.durationDays) * 86400n)
  },
  async approve({ account, id }) { return (await signerFor(account)).approveCampaign(id) },
  async reject({ account, id, reason }) { return (await signerFor(account)).rejectCampaign(id, reason.trim()) },
  async contribute({ account, id, amount }) { return (await signerFor(account)).contribute(id, { value: parseAmount(amount) }) },
  async withdraw({ account, id }) { return (await signerFor(account)).withdraw(id) },
  async refund({ account, id }) { return (await signerFor(account)).refund(id) },
  async afterTransaction({ receipt, operation }) {
    let id = operation.id
    if (operation.type === 'create') {
      const contract = new Contract(CONTRACT_ADDRESS, abi)
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue
        try { const event = contract.interface.parseLog(log); if (event?.name === 'CampaignSubmitted') id = event.args.id.toString() } catch { /* unrelated log */ }
      }
    }
    if (!id) throw new Error('Đã có receipt nhưng chưa tìm được ID; không gửi lại giao dịch.')
    await api('/campaigns/sync', { campaignId: id })
    if (operation.type === 'create') {
      const current = await contentAccount(receipt.from)
      let image = ''
      if (operation.values.imageFile) image = (await adapter.uploadImage({ id, account: current.account, file: operation.values.imageFile })).image
      await adapter.saveMetadata({ id, account: current.account, category: operation.values.category || 'Cộng đồng', image })
    }
    await getSession()
  },
}
export default adapter
