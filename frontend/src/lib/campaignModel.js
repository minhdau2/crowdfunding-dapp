export const CHAIN_ID = 11155111
export const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
})
export const statusLabels = {
  pending: 'Chờ duyệt', rejected: 'Bị từ chối',
  active: 'Đang gọi vốn', successful: 'Đã kết thúc · Đủ mục tiêu', unsuccessful: 'Đã kết thúc · Chưa đủ vốn',
}

export function uintString(value, positive = false) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,77})$/.test(value)
    || BigInt(value) >= 2n ** 256n || (positive && value === '0')) throw new Error('Dữ liệu số không hợp lệ.')
  return value
}
export function address(value) {
  if (typeof value !== 'string' || !/^0x[\da-fA-F]{40}$/.test(value)) throw new Error('Địa chỉ ví không hợp lệ.')
  return value.toLowerCase()
}
export function parseAmount(value) {
  const text = String(value).trim()
  if (!/^\d{1,12}(\.\d{1,18})?$/.test(text)) throw new Error('Nhập ETH bằng dấu chấm, tối đa 18 chữ số thập phân.')
  const [whole, decimal = ''] = text.split('.')
  const wei = BigInt(whole) * 10n ** 18n + BigInt(decimal.padEnd(18, '0'))
  if (wei <= 0n) throw new Error('Số ETH phải lớn hơn 0.')
  return wei
}
export function formatAmount(wei) {
  const amount = BigInt(wei)
  const decimal = (amount % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return `${amount / 10n ** 18n}${decimal ? `.${decimal}` : ''}`
}
export function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Chưa kết nối' }
export function campaignStatus(campaign) { return campaign.status }
export function hasReachedGoal(campaign) { return BigInt(campaign.totalRaisedWei) >= BigInt(campaign.goalWei) }
export function fundingPercent(campaign) {
  const hundredths = BigInt(campaign.totalRaisedWei) * 10000n / BigInt(campaign.goalWei)
  return Number(hundredths > 1000000n ? 1000000n : hundredths) / 100
}
export function validateCampaign(values) {
  if (!values.title.trim() || values.title.trim().length > 100) throw new Error('Tên chiến dịch cần từ 1 đến 100 ký tự.')
  if (!values.description.trim() || values.description.trim().length > 5000) throw new Error('Mô tả cần từ 1 đến 5.000 ký tự.')
  parseAmount(values.goalEth)
  if (typeof values.durationDays !== 'string' || !/^[1-9]\d?$/.test(values.durationDays)
    || Number(values.durationDays) > 90) throw new Error('Thời lượng gọi vốn cần là số nguyên từ 1 đến 90 ngày.')
}

export function durationLabel(seconds) {
  const value = BigInt(seconds)
  return value % 86400n === 0n ? `${value / 86400n} ngày` : `${value} giây`
}
export function campaignTiming(campaign) {
  return campaign.deadline ? `${dateFormatter.format(new Date(campaign.deadline))} (VN)`
    : campaign.approvalStatus === 'rejected' ? 'Không mở gọi vốn' : 'Tính từ khi được duyệt'
}

// This validates the integration boundary, not cryptographic proofs.
// The trusted adapter must read/verify on-chain data before returning this shape.
export function normalizeCampaign(record) {
  const proof = record.snapshot
  if (proof?.verified !== true || proof.chainId !== CHAIN_ID
    || !Number.isSafeInteger(proof.blockNumber) || proof.blockNumber < 0
    || !Number.isSafeInteger(proof.blockTimestamp) || proof.blockTimestamp <= 0) {
    throw new Error('Chưa xác minh được dữ liệu chiến dịch trên Sepolia.')
  }
  const id = uintString(record.campaignId, true)
  const owner = address(record.owner)
  const contractAddress = address(proof.contractAddress)
  const goalWei = uintString(record.goalWei, true)
  const raised = uintString(record.totalRaisedWei)
  const refunded = uintString(record.totalRefundedWei)
  const legacy = record.approvalStatus === undefined
  const approvalStatus = legacy ? 'approved' : record.approvalStatus
  if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) throw new Error('Trạng thái duyệt không hợp lệ.')
  const durationSeconds = legacy ? null : uintString(record.durationSeconds, true)
  const approvedAtSeconds = legacy ? null : uintString(record.approvedAtSeconds)
  const deadlineSeconds = uintString(record.deadlineSeconds, approvalStatus === 'approved')
  if (!legacy && (approvalStatus === 'approved'
    ? approvedAtSeconds === '0' || BigInt(approvedAtSeconds) > BigInt(proof.blockTimestamp)
      || BigInt(deadlineSeconds) !== BigInt(approvedAtSeconds) + BigInt(durationSeconds)
    : deadlineSeconds !== '0' || approvedAtSeconds !== '0' || raised !== '0' || refunded !== '0' || record.withdrawn)) {
    throw new Error('Điều kiện duyệt và thời hạn không nhất quán.')
  }
  if (approvalStatus === 'rejected' && (typeof record.rejectionReason !== 'string' || !record.rejectionReason.trim())) {
    throw new Error('Chưa đọc được lý do từ chối.')
  }
  if (BigInt(refunded) > BigInt(raised) || typeof record.withdrawn !== 'boolean'
    || typeof record.title !== 'string' || !record.title.trim() || record.title.length > 300
    || typeof record.description !== 'string' || record.description.length > 15000) throw new Error('Dữ liệu chiến dịch không hợp lệ.')
  const deadlineMs = Number(BigInt(deadlineSeconds) * 1000n)
  if (!Number.isSafeInteger(deadlineMs) || !Number.isFinite(new Date(deadlineMs).getTime())) throw new Error('Hạn chót không thể hiển thị.')
  const viewer = record.viewer ? address(record.viewer) : ''
  const contributionWei = viewer ? uintString(record.contributionWei) : '0'
  if (viewer && typeof record.hasRefunded !== 'boolean') throw new Error('Chưa đọc được khoản hoàn của ví.')
  if (approvalStatus !== 'approved' && (contributionWei !== '0' || record.hasRefunded === true)) throw new Error('Chiến dịch chưa duyệt không thể có thanh toán.')
  const status = approvalStatus !== 'approved' ? approvalStatus : BigInt(proof.blockTimestamp) < BigInt(deadlineSeconds) ? 'active'
    : BigInt(raised) >= BigInt(goalWei) ? 'successful' : 'unsuccessful'
  const hidden = record.contentHidden === true
  const image = !hidden && typeof record.image === 'string' && (/^https:\/\//i.test(record.image) || /^\/api\/images\/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(record.image)) ? record.image : ''
  return {
    id, owner, title: hidden ? 'Nội dung chiến dịch đã được ẩn' : record.title, description: hidden ? 'Nội dung đang được quản trị viên xem xét. Các quyền góp/rút/hoàn trên blockchain vẫn tuân theo contract.' : record.description, goalWei, totalRaisedWei: raised,
    totalRefundedWei: refunded, goalEth: formatAmount(goalWei), totalRaisedEth: formatAmount(raised),
    deadline: deadlineSeconds === '0' ? null : new Date(deadlineMs).toISOString(), deadlineSeconds, withdrawn: record.withdrawn, status,
    approvalStatus, durationSeconds, approvedAtSeconds, legacy,
    rejectionReason: approvalStatus === 'rejected' ? record.rejectionReason : '',
    contributions: viewer ? { [viewer]: formatAmount(contributionWei) } : {},
    refunded: viewer ? { [viewer]: record.hasRefunded } : {}, viewer,
    category: typeof record.category === 'string' ? record.category.slice(0, 60) : 'Cộng đồng',
    image, contentHidden: hidden, snapshot: { ...proof, contractAddress },
  }
}
