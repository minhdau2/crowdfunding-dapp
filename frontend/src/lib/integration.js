import { address, CHAIN_ID, normalizeCampaign } from './campaignModel.js'

export const unavailableMessage = 'Chức năng này chưa sẵn sàng. Vui lòng thử lại sau.'
export function capabilities(adapter) {
  const result = Object.fromEntries(['connect', 'login', 'logout', 'switchNetwork', 'loadCampaigns', 'loadCampaign',
    'create', 'contribute', 'withdraw', 'refund', 'loadSocial', 'loadFavorites', 'toggleFavorite', 'addComment', 'deleteComment', 'reportCampaign',
    'loadAdmin', 'moderate', 'loadPendingCampaigns', 'approve', 'reject'].map(name => [name, typeof adapter?.[name] === 'function']))
  for (const name of ['create', 'approve', 'reject', 'loadPendingCampaigns']) result[name] &&= adapter.campaignWorkflow === 'review-v1'
  return result
}
export function normalizeSession(value) {
  if (!value?.account) return { account: '', chainId: null, authenticated: false, isAdmin: false, isReviewer: false }
  const account = address(value.account)
  const chainId = Number(value.chainId)
  return { account, chainId, authenticated: value.authenticated === true && chainId === CHAIN_ID,
    isAdmin: value.authenticated === true && value.isAdmin === true && chainId === CHAIN_ID,
    isReviewer: value.authenticated === true && value.isReviewer === true && chainId === CHAIN_ID }
}
export function normalizeList(result, account) {
  if (!result || !Array.isArray(result.campaigns)) throw new Error('Không đọc được danh sách chiến dịch.')
  const campaigns = result.campaigns.map(normalizeCampaign)
  const keys = new Set()
  let contract
  for (const item of campaigns) {
    if (item.viewer !== account) throw new Error('Dữ liệu chưa khớp với ví đang chọn.')
    if (keys.has(item.id) || (contract && contract !== item.snapshot.contractAddress)) throw new Error('Danh sách không nhất quán.')
    keys.add(item.id); contract = item.snapshot.contractAddress
  }
  return { campaigns, hasMore: result.hasMore === true }
}
export async function runConfirmedOperation(adapter, operation, account, onSubmitted) {
  if (['create', 'approve', 'reject'].includes(operation.type) && adapter?.campaignWorkflow !== 'review-v1') {
    throw new Error('Luồng duyệt chiến dịch chưa sẵn sàng. Chưa gửi giao dịch.')
  }
  const method = adapter?.[operation.type]
  if (typeof method !== 'function') throw new Error(unavailableMessage)
  const transaction = await method.call(adapter, { ...operation, account })
  if (!/^0x[\da-fA-F]{64}$/.test(transaction?.hash) || typeof transaction.wait !== 'function') {
    throw new Error('Chưa nhận được mã giao dịch hợp lệ. Kiểm tra ví trước khi gửi lại.')
  }
  onSubmitted(transaction.hash)
  let receipt
  try { receipt = await transaction.wait() } catch (error) {
    if (error.code !== 'TRANSACTION_REPLACED' || error.cancelled || !error.receipt) throw error
    receipt = error.receipt
  }
  if (Number(receipt?.status) !== 1) throw new Error('Giao dịch không thành công. Kiểm tra chi tiết trên Sepolia.')
  if (!/^0x[\da-fA-F]{64}$/.test(receipt.hash)) throw new Error('Chưa xác nhận được biên nhận giao dịch.')
  return receipt
}
export function errorMessage(error) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return 'Bạn đã từ chối yêu cầu trong ví.'
  if (error?.code === 'INSUFFICIENT_FUNDS') return 'Ví chưa đủ Sepolia ETH để thanh toán và trả phí gas.'
  if (error?.code === 'CALL_EXCEPTION') return 'Contract từ chối giao dịch. Hãy tải lại và kiểm tra điều kiện thực hiện.'
  return error instanceof Error ? error.message : 'Không thực hiện được. Vui lòng thử lại.'
}
