import { useApp } from '../lib/useApp'
export default function DataState() {
  const app = useApp()
  if (app.loadState === 'ready') return null
  return <div className="empty-state" role={app.loadState === 'error' ? 'alert' : 'status'}>
    <p className="eyebrow">DỮ LIỆU CHIẾN DỊCH</p><h3>{app.loading ? 'Đang tải chiến dịch…' : app.loadState === 'unavailable' ? 'Danh sách chiến dịch chưa sẵn sàng' : 'Chưa tải được chiến dịch'}</h3>
    <p>{app.loading ? 'Đang kiểm tra dữ liệu trên Sepolia.' : app.loadState === 'unavailable' ? 'Vui lòng quay lại sau. Bạn vẫn có thể xem các bước tạo chiến dịch.' : app.loadError}</p>
    {!app.loading && <div className="button-row"><button className="secondary-button" onClick={app.refresh} disabled={!app.features.loadCampaigns}>Tải lại</button><a href="#/create">Xem form tạo chiến dịch →</a></div>}
  </div>
}
