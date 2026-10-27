export const DEMO_ACCOUNTS = [
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
]

export const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
})

export function parseAmount(value) {
  const text = String(value).trim()
  if (!/^\d{1,12}(\.\d{1,18})?$/.test(text)) throw new Error('Nhập số ETH hợp lệ, tối đa 18 chữ số thập phân. Dùng dấu chấm, ví dụ 0.01.')
  const [whole, decimal = ''] = text.split('.')
  const wei = BigInt(whole) * 10n ** 18n + BigInt(decimal.padEnd(18, '0'))
  if (wei <= 0n) throw new Error('Số ETH phải lớn hơn 0.')
  return wei
}

export function formatAmount(wei) {
  const whole = wei / 10n ** 18n
  const decimal = (wei % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return `${whole}${decimal ? `.${decimal}` : ''}`
}

export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function campaignStatus(campaign, now = Date.now()) {
  if (new Date(campaign.deadline).getTime() > now) return 'active'
  const raised = campaign.totalRaisedEth === '0' ? 0n : parseAmount(campaign.totalRaisedEth)
  return raised >= parseAmount(campaign.goalEth) ? 'successful' : 'unsuccessful'
}

export const statusLabels = {
  active: 'Đang gọi vốn',
  successful: 'Đã kết thúc · Đủ mục tiêu',
  unsuccessful: 'Đã kết thúc · Chưa đủ vốn',
}

export function createDemoData() {
  const now = Date.now()
  const activeDeadline = new Date(now + 7 * 86400000).toISOString()
  const pastDeadline = new Date(now - 86400000).toISOString()
  const [alice, bob] = DEMO_ACCOUNTS
  return {
    version: 1,
    favorites: {},
    comments: {},
    campaigns: [
      { id: 1, title: 'Mang sách đến vùng cao', description: 'Cùng xây dựng tủ sách và chuẩn bị dụng cụ học tập cho các em học sinh vùng cao.\n\nKhoản đóng góp sẽ giúp bổ sung sách, vở và dụng cụ học tập cho các lớp học. Đây là chiến dịch minh họa của đồ án.', category: 'Giáo dục', theme: 'books', symbol: 'Aa', goalEth: '1', totalRaisedEth: '0.4', deadline: activeDeadline, owner: bob, withdrawn: false, contributions: { [alice]: '0.4' }, refunded: {} },
      { id: 2, title: 'Thêm một mầm xanh', description: 'Trồng cây tại khu dân cư, tạo không gian xanh để mọi người cùng tận hưởng. Chiến dịch mẫu đã hết hạn và đủ mục tiêu, giúp thử thao tác rút vốn.', category: 'Môi trường', theme: 'trees', symbol: '✳', goalEth: '2', totalRaisedEth: '2.2', deadline: pastDeadline, owner: alice, withdrawn: false, contributions: { [alice]: '0.7', [bob]: '1.5' }, refunded: {} },
      { id: 3, title: 'Bữa cơm cho mái ấm', description: 'Góp thêm thực phẩm và đồ dùng sinh hoạt để chăm lo những bữa cơm tại mái ấm. Chiến dịch mẫu đã hết hạn và chưa đủ vốn, giúp thử thao tác hoàn tiền.', category: 'Cộng đồng', theme: 'community', symbol: '♡', goalEth: '0.5', totalRaisedEth: '0.2', deadline: pastDeadline, owner: bob, withdrawn: false, contributions: { [alice]: '0.1', [bob]: '0.1' }, refunded: {} },
    ],
  }
}

export function validateCampaign(values, now = Date.now()) {
  if (!values.title.trim() || values.title.trim().length > 100) throw new Error('Tên chiến dịch cần từ 1 đến 100 ký tự.')
  if (!values.description.trim() || values.description.trim().length > 5000) throw new Error('Mô tả cần từ 1 đến 5.000 ký tự.')
  parseAmount(values.goalEth)
  if (!Number.isFinite(new Date(values.deadline).getTime()) || new Date(values.deadline).getTime() <= now) throw new Error('Hạn chót phải ở tương lai (giờ Việt Nam).')
}

// Chỉ phục vụ mô phỏng UI. Khi tích hợp, thay bằng dữ liệu/receipt từ lớp lib thật.
export function applyOperation(data, operation, account, now = Date.now()) {
  if (!account) throw new Error('Hãy kết nối ví mô phỏng trước.')
  if (operation.type === 'create') {
    validateCampaign(operation.values, now)
    const campaign = { ...operation.values, id: Math.max(0, ...data.campaigns.map((item) => item.id)) + 1, title: operation.values.title.trim(), description: operation.values.description.trim(), goalEth: formatAmount(parseAmount(operation.values.goalEth)), owner: account, totalRaisedEth: '0', withdrawn: false, contributions: {}, refunded: {}, theme: 'community', symbol: '♡' }
    return { ...data, campaigns: [campaign, ...data.campaigns] }
  }
  const campaign = data.campaigns.find((item) => item.id === operation.id)
  if (!campaign) throw new Error('Không tìm thấy chiến dịch.')
  const status = campaignStatus(campaign, now)
  let updated = { ...campaign }
  if (operation.type === 'contribute') {
    if (status !== 'active') throw new Error('Chiến dịch đã hết hạn, không thể góp thêm.')
    const amount = parseAmount(operation.amount)
    const previous = campaign.contributions[account] || '0'
    const toWei = (value) => value === '0' ? 0n : parseAmount(value)
    updated.totalRaisedEth = formatAmount(toWei(campaign.totalRaisedEth) + amount)
    updated.contributions = { ...campaign.contributions, [account]: formatAmount(toWei(previous) + amount) }
  } else if (operation.type === 'withdraw') {
    if (campaign.owner !== account || status !== 'successful' || campaign.withdrawn) throw new Error('Chỉ chủ chiến dịch đã hết hạn và đủ vốn mới được rút, tối đa một lần.')
    updated.withdrawn = true
  } else if (operation.type === 'refund') {
    if (status !== 'unsuccessful' || !campaign.contributions[account] || campaign.refunded[account]) throw new Error('Không có khoản góp đủ điều kiện hoàn tiền.')
    updated.refunded = { ...campaign.refunded, [account]: true }
  } else throw new Error('Thao tác không hợp lệ.')
  return { ...data, campaigns: data.campaigns.map((item) => item.id === campaign.id ? updated : item) }
}
