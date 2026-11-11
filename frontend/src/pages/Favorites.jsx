import { useEffect, useState } from 'react'
import { useApp } from '../lib/useApp'
import { errorMessage, normalizeList } from '../lib/integration'
import CampaignCard from '../components/CampaignCard'

export default function Favorites() {
  const app = useApp()
  const [state, setState] = useState(app.features.loadFavorites ? 'loading' : 'unavailable')
  const [error, setError] = useState('')
  const [records, setRecords] = useState([])
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    if (!app.features.loadFavorites) return
    Promise.resolve().then(() => {
      if (!active) return null
      setRecords([]); setState('loading')
      return app.adapter.loadFavorites({ account: app.account })
    }).then(result => {
      if (!active) return
      const list = normalizeList(result, app.account)
      if (active) { setRecords(list.campaigns); setState('ready') }
    }).catch(issue => { if (active) { setError(errorMessage(issue)); setState('error') } })
    return () => { active = false }
  }, [app.adapter, app.account, app.features.loadFavorites, revision])
  if (state === 'ready' && records.length) return <div className="campaign-list favorites-list">{records.map(item => <CampaignCard key={item.id} campaign={item} />)}</div>
  return <div className="empty-state" role={state === 'error' ? 'alert' : 'status'}><h2>{state === 'loading' ? 'Đang tải yêu thích…' : state === 'unavailable' ? 'Danh sách yêu thích chưa sẵn sàng' : state === 'error' ? 'Chưa tải được yêu thích' : 'Chưa có chiến dịch yêu thích'}</h2><p>{state === 'error' ? error : state === 'unavailable' ? 'Vui lòng thử lại sau.' : 'Mở chi tiết chiến dịch để lưu dự án bạn quan tâm.'}</p><div className="button-row"><button className="secondary-button" disabled={!app.features.loadFavorites || state === 'loading'} onClick={() => setRevision(value => value + 1)}>Tải lại</button><a href="#/">Khám phá chiến dịch</a></div></div>
}
