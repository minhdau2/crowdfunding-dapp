import { useState } from 'react'
import CampaignCard from '../components/CampaignCard'
import DataState from '../components/DataState'
import { useApp } from '../lib/useApp'
import { campaignStatus } from '../lib/campaignModel'

export default function CampaignList({ campaigns: supplied, title = 'Khám phá chiến dịch', subtitle = 'CÙNG NHAU TẠO KHÁC BIỆT' }) {
  const app = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const source = (supplied || app.data.campaigns).filter(item => item.approvalStatus === 'approved')
  const campaigns = source.filter(campaign => (status === 'all' || campaignStatus(campaign) === status)
    && `${campaign.title} ${campaign.description} ${campaign.category}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  return <section id="campaigns" aria-labelledby="campaigns-title">
    <div className="section-heading"><div><p className="eyebrow">{subtitle}</p><h2 id="campaigns-title">{title}</h2></div><div className="list-actions">{app.loadState === 'ready' && <p className="result-count" role="status">{campaigns.length} chiến dịch trong danh sách đã tải</p>}<button className="secondary-button" disabled={!app.features.loadCampaigns || app.loading || app.busy} onClick={app.refresh}>Tải lại</button></div></div>
    <div className="filters"><div className="search-field"><label htmlFor="campaign-search">Tìm chiến dịch</label><input id="campaign-search" type="search" placeholder="Nhập tên hoặc chủ đề…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="status-field"><label htmlFor="campaign-status">Trạng thái</label><select id="campaign-status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tất cả chiến dịch</option><option value="active">Đang gọi vốn</option><option value="successful">Đã kết thúc · Đủ mục tiêu</option><option value="unsuccessful">Đã kết thúc · Chưa đủ vốn</option></select></div></div>
    <DataState />
    {app.loadState === 'ready' && (campaigns.length ? <><div className="campaign-list">{campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}</div>{app.hasMore && <p className="inline-callout">Danh sách hiện chỉ hiển thị một phần chiến dịch. Tìm kiếm và bộ lọc áp dụng trên phần đã tải.</p>}</> : <div className="empty-state"><h3>{source.length ? 'Không có kết quả phù hợp' : 'Chưa có chiến dịch trong danh sách này'}</h3><p>{source.length ? 'Thử từ khóa hoặc trạng thái khác.' : 'Bắt đầu một chiến dịch hoặc quay lại khám phá sau.'}</p><div className="button-row"><button className="secondary-button" onClick={() => { setQuery(''); setStatus('all') }}>Xóa bộ lọc</button><a href="#/create">Tạo chiến dịch →</a></div></div>)}
  </section>
}
