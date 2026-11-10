import { useApp } from '../lib/useApp'
import { campaignTiming, statusLabels } from '../lib/campaignModel'
import WalletGate from '../components/WalletGate'
import DataState from '../components/DataState'
import { useState } from 'react'
import Favorites from './Favorites'

const titles = { mine: 'Chiến dịch của tôi', contributions: 'Khoản đã góp', favorites: 'Đã yêu thích' }
export default function AccountCampaigns({ mode }) {
  const app = useApp()
  const [filter, setFilter] = useState('all')
  const records = app.data.campaigns.filter(item => mode === 'mine' ? item.owner === app.account
    : mode === 'contributions' ? !!item.contributions[app.account] && item.contributions[app.account] !== '0'
      : (app.data.favorites[app.account] || []).includes(item.id))
  const filtered = records.filter(item => filter === 'all' || item.status === filter)
  return <section className="page-section"><p className="eyebrow">GÓC CỦA BẠN</p><h1 className="page-title">{titles[mode]}</h1><p className="page-description">{mode === 'mine' ? 'Theo dõi chiến dịch và rút vốn khi đủ điều kiện.' : mode === 'contributions' ? 'Theo dõi khoản góp và trạng thái hoàn tiền của ví đang chọn.' : 'Những chiến dịch bạn muốn đồng hành.'}</p><WalletGate />
    {app.account && (mode !== 'favorites' || app.authenticated) && <>
      {mode === 'favorites' ? <Favorites /> : <>
        <div className="management-toolbar"><label>Lọc trạng thái<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả</option><option value="pending">Chờ duyệt</option><option value="rejected">Bị từ chối</option><option value="active">Đang gọi vốn</option><option value="successful">Đã kết thúc · Đủ mục tiêu</option><option value="unsuccessful">Đã kết thúc · Chưa đủ vốn</option></select></label><button className="secondary-button" disabled={!app.features.loadCampaigns || app.loading} onClick={app.refresh}>Tải lại</button>{mode === 'mine' && <a className="primary-button" href="#/create">+ Tạo chiến dịch</a>}</div><DataState />
        {app.loadState === 'ready' && <>{app.hasMore && <p className="inline-callout">Đang hiển thị phần dữ liệu đã tải. Có thể còn chiến dịch hoặc khoản góp khác.</p>}{filtered.length === 0 ? <div className="empty-state"><h2>Chưa có chiến dịch phù hợp</h2><p>Dữ liệu hiển thị theo ví đang kết nối và bộ lọc hiện tại.</p><a href="#/">Khám phá chiến dịch →</a></div> : <div className="management-list">{filtered.map(item => {
          const canWithdraw = mode === 'mine' && item.status === 'successful' && !item.withdrawn
          const canRefund = mode === 'contributions' && item.status === 'unsuccessful' && !item.refunded[app.account]
          const operation = mode === 'mine' ? 'withdraw' : 'refund'
          const ready = app.authenticated && !app.wrongNetwork && app.features[operation] && !app.busy && !app.request
          return <article className="management-item" key={item.id}><div><span className={`status ${item.status}`}>{statusLabels[item.status]}</span><h2><a className="title-link" href={`#/campaign/${item.id}`}>{item.title}</a></h2><p className="muted">Hạn: {campaignTiming(item)}</p><p className="help-text">{item.status === 'pending' ? 'Đang chờ duyệt, chưa nhận góp.' : item.status === 'rejected' ? `Bị từ chối: ${item.rejectionReason}` : item.withdrawn ? 'Chủ chiến dịch đã rút vốn.' : item.refunded[app.account] ? 'Ví đã nhận hoàn tiền.' : item.status === 'active' ? 'Chưa hết hạn, chưa thể rút hoặc hoàn tiền.' : 'Xem chi tiết để kiểm tra điều kiện thanh toán.'}</p></div><div className="management-amount"><strong>{mode === 'mine' ? item.totalRaisedEth : item.contributions[app.account]} ETH</strong><span>{mode === 'mine' ? `Mục tiêu ${item.goalEth} ETH` : 'Tổng khoản đã góp'}</span></div><div className="management-actions"><a href={`#/campaign/${item.id}`}>Xem chi tiết ↗</a>{(canWithdraw || canRefund) && <button className="primary-button" disabled={!ready} onClick={() => app.transact({ type: operation, id: item.id }, canWithdraw ? 'Xác nhận rút vốn' : 'Xác nhận hoàn tiền', `Chiến dịch “${item.title}”. Kiểm tra số tiền trong ví trước khi xác nhận.`)}>{canWithdraw ? 'Rút vốn' : 'Yêu cầu hoàn tiền'}</button>}</div></article>
        })}</div>}</>}
      </>}
    </>}
  </section>
}
