import { useEffect, useState } from 'react'
import { useApp } from '../lib/useApp'
import WalletGate from '../components/WalletGate'
import { dateFormatter } from '../lib/campaignModel'
import { errorMessage } from '../lib/integration'
import CampaignApprovals from './CampaignApprovals'

const sections = { approvals: 'Duyệt chiến dịch', campaigns: 'Nội dung chiến dịch', comments: 'Bình luận', reports: 'Báo cáo vi phạm', audit: 'Lịch sử quản trị' }
const actions = { hideCampaign: 'Ẩn nội dung chiến dịch', restoreCampaign: 'Hiện lại nội dung chiến dịch', deleteComment: 'Xóa bình luận', resolveReport: 'Đánh dấu đã xử lý' }
export default function Admin() {
  const app = useApp()
  const [section, setSection] = useState('approvals')
  const [state, setState] = useState('unavailable')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const contentAllowed = app.authenticated && app.isAdmin && !app.wrongNetwork
  const allowed = app.authenticated && (app.isAdmin || app.isReviewer) && !app.wrongNetwork
  useEffect(() => {
    let active = true
    if (!contentAllowed || section === 'approvals' || !app.features.loadAdmin) return
    Promise.resolve().then(() => {
      if (!active) return null
      setItems([]); setTarget(null); setError(''); setState('loading')
      return app.adapter.loadAdmin({ section })
    }).then(result => {
      if (!active) return
      if (!Array.isArray(result?.items) || result.items.some(item => typeof item.id !== 'string'
        || typeof item.title !== 'string' || typeof item.text !== 'string'
        || (section === 'campaigns' && typeof item.hidden !== 'boolean')
        || (section === 'reports' && typeof item.resolved !== 'boolean')
        || (item.createdAt && !Number.isFinite(Date.parse(item.createdAt))))) throw new Error('Dữ liệu quản trị không hợp lệ.')
      if (active) { setItems(result.items); setState('ready') }
    }).catch(issue => { if (active) { setError(errorMessage(issue)); setState('error') } })
    return () => { active = false }
  }, [contentAllowed, app.adapter, app.features.loadAdmin, section, revision])
  async function moderate(event) {
    event.preventDefault()
    if (!contentAllowed || !app.features.moderate || saving || reason.trim().length < 10) return
    setSaving(true); setError('')
    try {
      // The backend must authorize this operation and append an audit record atomically.
      const result = await app.adapter.moderate({ section, id: target.id, action: target.action, reason: reason.trim() })
      if (result?.ok !== true) throw new Error('Chưa xác nhận được kết quả quản trị. Hãy tải lại trước khi thử lại.')
      setTarget(null); setReason(''); setRevision(value => value + 1)
      app.setNotice('Đã lưu thay đổi quản lý nội dung.')
      void app.refresh()
    } catch (issue) { setError(errorMessage(issue)) }
    finally { setSaving(false) }
  }
  return <section className="page-section"><p className="eyebrow">KHÔNG GIAN QUẢN TRỊ</p><h1 className="page-title">Quản trị nội dung</h1><p className="page-description">Quản lý thông tin hiển thị và xử lý nội dung được báo cáo.</p>
    <div className="admin-scope"><strong>Duyệt chiến dịch và quản lý nội dung</strong><p>Ví có quyền duyệt quyết định đề xuất được bắt đầu gọi vốn. Ẩn nội dung website là thao tác riêng, không xóa hoặc dừng chiến dịch on-chain. Quản trị viên không được tùy ý sửa mục tiêu, hạn chót, khoản góp hoặc rút tiền thay chủ.</p></div>
    {!allowed && <><WalletGate />{app.authenticated && !app.isAdmin && <div className="empty-state" role="alert"><h2>Tài khoản không có quyền quản trị</h2><p>Khu vực này chỉ dành cho tài khoản đã được cấp quyền.</p><a href="#/">Về khám phá chiến dịch</a></div>}{!app.authenticated && <p className="help-text">Đăng nhập bằng ví được cấp quyền để xem dữ liệu quản trị.</p>}</>}
    <div className="admin-layout"><nav className="admin-nav" aria-label="Chức năng quản trị">{Object.entries(sections).map(([key, label]) => <button className={section === key ? 'selected' : ''} key={key} aria-pressed={section === key} disabled={saving} onClick={() => setSection(key)}>{label}</button>)}</nav>
      <section className="admin-content" aria-label={sections[section]}>{section === 'approvals' ? <CampaignApprovals /> : <><div className="section-heading"><h2>{sections[section]}</h2><button className="secondary-button" disabled={!contentAllowed || !app.features.loadAdmin || state === 'loading' || saving} onClick={() => setRevision(value => value + 1)}>Tải lại</button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {!contentAllowed ? <div className="empty-state"><h3>Dữ liệu được bảo vệ</h3><p>Cần đăng nhập và có quyền quản lý nội dung để tiếp tục.</p></div>
          : state === 'unavailable' ? <div className="empty-state"><h3>Quản lý nội dung chưa sẵn sàng</h3><p>Chưa thể tải hoặc thay đổi nội dung. Vui lòng thử lại sau.</p></div>
            : state === 'loading' ? <p className="inline-callout" role="status">Đang tải dữ liệu quản trị…</p>
              : state === 'ready' && (items.length === 0 ? <div className="empty-state"><h3>Chưa có mục nào</h3><p>Danh sách {sections[section].toLocaleLowerCase('vi')} hiện trống.</p></div> : <div className="moderation-list">{items.map(item => <article className="content-panel" key={item.id}><h3>{item.title}</h3><p className="full-description">{item.text}</p>{item.createdAt && <p className="help-text">{dateFormatter.format(new Date(item.createdAt))}</p>}{section === 'campaigns' && <p className="help-text">{item.hidden ? 'Đang ẩn trên website' : 'Đang hiển thị trên website'}</p>}{section === 'reports' && <p className="help-text">{item.resolved ? 'Đã xử lý' : 'Chờ xử lý'}</p>}{section !== 'audit' && <button className="secondary-button" disabled={!app.features.moderate || saving || (section === 'reports' && item.resolved)} onClick={() => { setTarget({ id: item.id, title: item.title, action: section === 'campaigns' ? item.hidden ? 'restoreCampaign' : 'hideCampaign' : section === 'comments' ? 'deleteComment' : 'resolveReport' }); setReason('') }}>{section === 'campaigns' ? item.hidden ? 'Hiện lại nội dung' : 'Ẩn nội dung' : section === 'comments' ? 'Xóa bình luận' : 'Xử lý báo cáo'}</button>}</article>)}</div>)}
        {target && <form className="form-panel" onSubmit={moderate}><h3>{actions[target.action]}</h3><p>{target.title}</p><label htmlFor="moderation-reason">Lý do xử lý (bắt buộc)</label><textarea id="moderation-reason" minLength={10} maxLength={1000} required rows={3} value={reason} onChange={event => setReason(event.target.value)} /><p className="help-text">Ghi ít nhất 10 ký tự. Thao tác cần được lưu trong lịch sử quản trị.</p><div className="button-row"><button type="button" className="secondary-button" disabled={saving} onClick={() => setTarget(null)}>Hủy</button><button className="primary-button" disabled={saving || reason.trim().length < 10}>{saving ? 'Đang lưu…' : 'Xác nhận xử lý'}</button></div></form>}
      </> }</section>
    </div>
  </section>
}
