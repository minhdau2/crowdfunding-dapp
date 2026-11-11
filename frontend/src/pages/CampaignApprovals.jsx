import { useEffect, useState } from 'react'
import { useApp } from '../lib/useApp'
import { durationLabel, shortAddress } from '../lib/campaignModel'
import { errorMessage, normalizeList } from '../lib/integration'

export default function CampaignApprovals() {
  const app = useApp()
  const [state, setState] = useState('unavailable')
  const [records, setRecords] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const allowed = app.authenticated && app.isReviewer && !app.wrongNetwork
  useEffect(() => {
    let active = true
    if (!allowed || !app.features.loadPendingCampaigns) return
    Promise.resolve().then(() => {
      if (!active) return null
      setState('loading'); setError(''); setTarget(null); setRecords([])
      return app.adapter.loadPendingCampaigns({ account: app.account })
    }).then(result => {
      if (!active) return
      const data = normalizeList(result, app.account)
      if (data.campaigns.some(item => item.approvalStatus !== 'pending')) throw new Error('Danh sách chờ duyệt chứa trạng thái không phù hợp.')
      setRecords(data.campaigns); setHasMore(data.hasMore); setState('ready')
    }).catch(issue => { if (active) { setError(errorMessage(issue)); setState('error') } })
    return () => { active = false }
  }, [app.adapter, app.account, app.features.loadPendingCampaigns, allowed, revision, app.data.campaigns])
  const busy = app.busy || !!app.request
  function decide(item, type, rejectionReason = '') {
    if (!allowed || !app.features[type] || busy) return
    app.transact({ type, id: item.id, ...(type === 'reject' ? { reason: rejectionReason.trim() } : {}) },
      type === 'approve' ? 'Duyệt chiến dịch' : 'Từ chối chiến dịch',
      type === 'approve' ? `Duyệt “${item.title}”, mục tiêu ${item.goalEth} ETH. Gọi vốn ${durationLabel(item.durationSeconds)} kể từ khi giao dịch duyệt được xác nhận; chưa biết hạn chót chính xác trước giao dịch.`
        : `Từ chối “${item.title}”. Lý do công khai: ${rejectionReason.trim()}. Không nhận góp; không thể duyệt lại đề xuất này.`,
      () => { setTarget(null); setReason(''); setRevision(value => value + 1) })
  }
  return <section aria-label="Duyệt chiến dịch"><div className="section-heading"><h2>Duyệt chiến dịch</h2><button className="secondary-button" disabled={!allowed || !app.features.loadPendingCampaigns || state === 'loading' || busy} onClick={() => setRevision(value => value + 1)}>Tải lại</button></div>
    <p className="inline-callout">Chưa duyệt thì không nhận góp. Duyệt thành công mới bắt đầu thời gian gọi vốn. Duyệt hoặc từ chối là giao dịch Sepolia, có phí gas và cần đúng quyền ví.</p>
    {allowed && state === 'ready' && hasMore && <p className="help-text">Đang hiển thị một phần danh sách; có thể còn đề xuất chờ duyệt khác.</p>}
    {!allowed ? <div className="empty-state"><h3>Cần ví có quyền duyệt trên contract</h3><p>Quyền quản lý nội dung website không tự cấp quyền duyệt chiến dịch.</p></div>
      : !app.features.loadPendingCampaigns ? <div className="empty-state"><h3>Duyệt chiến dịch chưa sẵn sàng</h3><p>Vui lòng thử lại sau. Chưa có giao dịch duyệt hoặc từ chối nào được gửi.</p></div>
        : state === 'loading' ? <p role="status">Đang tải các đề xuất chờ duyệt…</p>
          : state === 'error' ? <p className="field-error" role="alert">{error}</p>
            : state === 'ready' && (records.length === 0 ? <div className="empty-state"><h3>Không có đề xuất chờ duyệt</h3><p>Các đề xuất mới sẽ xuất hiện sau khi được ghi nhận.</p></div>
              : <div className="moderation-list">{records.map(item => <article className="content-panel" key={item.id}><span className="status pending">Chờ duyệt</span><h3>{item.title}</h3><p className="help-text">ID {item.id} · Chủ chiến dịch <span title={item.owner}>{shortAddress(item.owner)}</span></p><p className="full-description">{item.description}</p><dl><dt>Mục tiêu</dt><dd>{item.goalEth} ETH</dd><dt>Thời lượng</dt><dd>{durationLabel(item.durationSeconds)} từ lúc được duyệt</dd><dt>Hạn chót</dt><dd>Chưa xác định</dd></dl><div className="button-row"><a href={`#/campaign/${item.id}`}>Xem chi tiết</a><button className="primary-button" disabled={busy || !app.features.approve} onClick={() => decide(item, 'approve')}>Duyệt chiến dịch</button><button className="secondary-button" disabled={busy || !app.features.reject} onClick={() => { setTarget(item); setReason('') }}>Từ chối</button></div></article>)}</div>)}
    {target && <form className="form-panel" onSubmit={event => { event.preventDefault(); if (reason.trim().length >= 10) decide(target, 'reject', reason) }}><h3>Từ chối “{target.title}”</h3><label htmlFor="rejection-reason">Lý do từ chối (công khai)</label><textarea id="rejection-reason" minLength={10} maxLength={1000} rows={4} required value={reason} onChange={event => setReason(event.target.value)} /><p className="help-text">Từ 10 đến 1.000 ký tự, không chứa thông tin riêng tư. Chủ chiến dịch sẽ thấy lý do và có thể gửi đề xuất mới.</p><div className="button-row"><button type="button" className="secondary-button" disabled={busy} onClick={() => setTarget(null)}>Hủy</button><button className="primary-button" disabled={busy || !app.features.reject || reason.trim().length < 10}>Xem lại và từ chối</button></div></form>}
  </section>
}
