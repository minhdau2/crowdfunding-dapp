import { useState } from 'react'
import { useNow } from '../lib/useNow'
import CampaignCard from '../components/CampaignCard'
import { useDemo } from '../lib/useDemo'
import { campaignStatus } from '../lib/demoModel'


export default function CampaignList({ campaigns: supplied, title = 'Khám phá chiến dịch', subtitle = 'CÙNG NHAU TẠO KHÁC BIỆT' }) {
  const { data, loading } = useDemo()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const now = useNow()
  const campaigns = (supplied || data.campaigns).filter((campaign) => (
    (status === 'all' || campaignStatus(campaign, now) === status)
    && `${campaign.title} ${campaign.description} ${campaign.category}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
  ))
  return <section id="campaigns" aria-labelledby="campaigns-title">
    <div className="section-heading"><div><p className="eyebrow">{subtitle}</p><h2 id="campaigns-title">{title}</h2></div><p className="result-count" role="status">{campaigns.length} chiến dịch</p></div>
    <div className="filters"><div className="search-field"><label htmlFor="campaign-search">Tìm chiến dịch</label><input id="campaign-search" type="search" placeholder="Nhập tên hoặc chủ đề…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="status-field"><label htmlFor="campaign-status">Trạng thái</label><select id="campaign-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả chiến dịch</option><option value="active">Đang gọi vốn</option><option value="successful">Đã kết thúc · Đủ mục tiêu</option><option value="unsuccessful">Đã kết thúc · Chưa đủ vốn</option></select></div></div>
    {loading ? <div className="empty-state" role="status">Đang tải chiến dịch mô phỏng…</div> : campaigns.length ? <div className="campaign-list">{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} now={now} />)}</div> : <div className="empty-state"><h3>Chưa có chiến dịch phù hợp</h3><p>Thử từ khóa khác, đổi trạng thái hoặc khám phá thêm chiến dịch.</p><div className="button-row"><button className="secondary-button" onClick={() => { setQuery(''); setStatus('all') }}>Xóa bộ lọc</button><a href="#/">Khám phá chiến dịch</a></div></div>}
  </section>
}
