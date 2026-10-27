import CampaignList from './CampaignList'
import { useNow } from '../lib/useNow'
import { dateFormatter } from '../lib/demoModel'
import { useDemo } from '../lib/useDemo'
import { campaignStatus, statusLabels } from '../lib/demoModel'
import { useState } from 'react'

const titles = { mine: 'Chiến dịch của tôi', contributions: 'Khoản đã góp', favorites: 'Đã yêu thích' }

export default function AccountCampaigns({ mode }) {
  const demo = useDemo()
  const now = useNow()
  const [filter, setFilter] = useState('all')
  if (!demo.account) return <section className="page-section"><h1 className="page-title">{titles[mode]}</h1><div className="empty-state"><h2>Kết nối ví để xem dữ liệu của bạn</h2><p>Mỗi ví mô phỏng có chiến dịch và khoản góp riêng.</p><button className="primary-button" onClick={demo.connect}>Kết nối ví mẫu</button></div></section>
  if (mode === 'favorites') return <section className="page-section">{!demo.authenticated ? <div className="inline-callout">Đăng nhập để xem và quản lý danh sách yêu thích. <button className="secondary-button" onClick={demo.login}>Ký để đăng nhập (mẫu)</button></div> : <CampaignList title={titles[mode]} subtitle="NHỮNG ĐIỀU BẠN QUAN TÂM" campaigns={demo.data.campaigns.filter((item) => (demo.data.favorites[demo.account] || []).includes(item.id))} />}</section>
  const records = demo.data.campaigns.filter((item) => mode === 'mine' ? item.owner === demo.account : !!item.contributions[demo.account])
  const filtered = records.filter((item) => filter === 'all' || campaignStatus(item, now) === filter)
  return <section className="page-section"><p className="eyebrow">GÓC CỦA BẠN</p><h1 className="page-title">{titles[mode]}</h1><p className="page-description">{mode === 'mine' ? 'Theo dõi chiến dịch bạn đã tạo và rút vốn khi đủ điều kiện.' : 'Tổng hợp các lần góp theo từng chiến dịch và trạng thái hoàn tiền.'}</p>
    <div className="management-toolbar"><label>Lọc trạng thái<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tất cả</option><option value="active">Đang gọi vốn</option><option value="successful">Đã kết thúc · Đủ mục tiêu</option><option value="unsuccessful">Đã kết thúc · Chưa đủ vốn</option></select></label>{mode === 'mine' && <a className="primary-link" href="#/create">+ Tạo chiến dịch</a>}</div>
    {filtered.length === 0 ? <div className="empty-state"><h2>Chưa có chiến dịch phù hợp</h2><p>Thử đổi bộ lọc hoặc bắt đầu khám phá các dự án.</p><a href="#/">Khám phá chiến dịch →</a></div> : <div className="management-list">{filtered.map((item) => {
      const status = campaignStatus(item, now)
      const refunded = item.refunded[demo.account]
      const canWithdraw = mode === 'mine' && status === 'successful' && !item.withdrawn
      const canRefund = mode === 'contributions' && status === 'unsuccessful' && !refunded
      const reason = mode === 'mine' ? item.withdrawn ? 'Đã rút vốn' : status === 'active' ? 'Chưa hết hạn, chưa thể rút vốn.' : status === 'unsuccessful' ? 'Thiếu mục tiêu, người góp được hoàn tiền.' : '' : refunded ? 'Đã hoàn tiền' : status === 'active' ? 'Còn hạn, chưa thể hoàn tiền.' : status === 'successful' ? 'Đủ mục tiêu, không áp dụng hoàn tiền.' : ''
      return <article className="management-item" key={item.id}><div><span className={`status ${status}`}>{statusLabels[status]}</span><h2><a className="title-link" href={`#/campaign/${item.id}`}>{item.title}</a></h2><p className="muted">Hạn: {dateFormatter.format(new Date(item.deadline))} (VN)</p><p className="help-text">{reason}</p></div><div className="management-amount"><strong>{mode === 'mine' ? item.totalRaisedEth : item.contributions[demo.account]} ETH</strong><span>{mode === 'mine' ? `Mục tiêu ${item.goalEth} ETH` : 'Tổng khoản đã góp'}</span></div><div className="management-actions"><a href={`#/campaign/${item.id}`}>Xem chi tiết ↗</a>{canWithdraw && <button className="primary-button" disabled={demo.wrongNetwork || !!demo.request} onClick={() => demo.transact({ type: 'withdraw', id: item.id }, 'Xác nhận rút vốn', `Rút ${item.totalRaisedEth} ETH mô phỏng từ “${item.title}”.`)}>Rút vốn mô phỏng</button>}{canRefund && <button className="primary-button" disabled={demo.wrongNetwork || !!demo.request} onClick={() => demo.transact({ type: 'refund', id: item.id }, 'Xác nhận hoàn tiền', `Hoàn ${item.contributions[demo.account]} ETH mô phỏng từ “${item.title}”.`)}>Yêu cầu hoàn tiền</button>}</div></article>
    })}</div>}
  </section>
}
