import { useEffect, useState } from 'react'
import { useApp } from '../lib/useApp'
import { campaignTiming, dateFormatter, durationLabel, hasReachedGoal, parseAmount, shortAddress, statusLabels } from '../lib/campaignModel'
import { errorMessage } from '../lib/integration'
import { CampaignArt, FundingProgress } from '../components/CampaignCard'
import WalletGate from '../components/WalletGate'
import CampaignMetadata from '../components/CampaignMetadata'

export default function CampaignDetail({ id }) {
  const app = useApp()
  const { loadCampaign, loadSocial } = app
  const [campaign, setCampaign] = useState(null)
  const [state, setState] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [socialState, setSocialState] = useState(app.features.loadSocial ? 'loading' : 'unavailable')
  const [socialError, setSocialError] = useState('')
  const [report, setReport] = useState('')
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return null
      setState('loading'); setCampaign(null)
      return loadCampaign(id)
    }).then(item => { if (active) { setCampaign(item); setState('ready') } })
      .catch(issue => { if (active) { setLoadError(errorMessage(issue)); setState('error') } })
    return () => { active = false }
  }, [id, loadCampaign, app.account, revision, app.data.campaigns])
  useEffect(() => {
    let active = true
    if (!app.features.loadSocial) return
    Promise.resolve().then(() => {
      if (!active) return
      setSocialState('loading')
      return loadSocial(id)
    }).then(() => { if (active) setSocialState('ready') }).catch(issue => {
      if (active) { setSocialState('error'); setSocialError(errorMessage(issue)) }
    })
    return () => { active = false }
  }, [id, loadSocial, app.features.loadSocial, app.authenticated, revision])
  const refresh = () => setRevision(value => value + 1)
  if (state !== 'ready') return <section className="page-section"><a href="#/">← Khám phá chiến dịch</a><div className="empty-state" role={state === 'error' ? 'alert' : 'status'}><h1 className="page-title">{state === 'loading' ? 'Đang tải chiến dịch…' : 'Chưa đọc được chiến dịch'}</h1><p>{state === 'loading' ? 'Đang kiểm tra thông tin trên Sepolia.' : loadError}</p>{state === 'error' && <button className="secondary-button" disabled={!app.features.loadCampaign} onClick={refresh}>Thử lại</button>}</div></section>
  const status = campaign.status
  const contribution = campaign.contributions[app.account] || '0'
  const refunded = campaign.refunded[app.account]
  const favorite = (app.data.favorites[app.account] || []).includes(id)
  const comments = app.data.comments[id] || []
  const blocked = !app.account || !app.authenticated || app.wrongNetwork || app.busy || !!app.request
  function contribute(event) {
    event.preventDefault(); setError('')
    try {
      parseAmount(amount)
      app.transact({ type: 'contribute', id, amount }, 'Xác nhận góp vốn', `Góp ${amount} ETH cho “${campaign.title}”. Phí gas được tính riêng.`, () => { setAmount(''); refresh() })
    } catch (issue) { setError(issue.message) }
  }
  return <section className="page-section"><a className="back-link" href="#/">← Khám phá chiến dịch</a><div className="detail-heading"><div><span className={`status ${status}`}>{statusLabels[status]}</span><h1 className="page-title">{campaign.title}</h1><p className="page-description">Tạo bởi <span title={campaign.owner}>{shortAddress(campaign.owner)}</span> · {campaign.category}</p></div><div className="list-actions"><button className="secondary-button" onClick={refresh} disabled={app.busy}>Tải lại</button><button className="secondary-button" aria-pressed={favorite} disabled={blocked || !app.features.toggleFavorite || socialState !== 'ready'} onClick={() => app.toggleFavorite(id)}>{favorite ? '♥ Đã yêu thích' : '♡ Lưu yêu thích'}</button></div></div>
    {campaign.contentHidden && <p className="inline-callout">Nội dung đã được ẩn trên website. Bạn vẫn có thể kiểm tra khoản góp và thực hiện rút/hoàn khi đủ điều kiện.</p>}
    <div className="detail-layout"><div><div className="detail-art"><CampaignArt campaign={campaign} /></div><section className="content-panel"><h2>Câu chuyện chiến dịch</h2><p className="full-description">{campaign.description}</p></section>
      {campaign.owner === app.account && app.authenticated && <CampaignMetadata key={`${campaign.id}:${app.account}`} campaign={campaign} onSaved={() => { refresh(); void app.refresh() }} />}
      <section className="content-panel"><h2>Bình luận {socialState === 'ready' && <span className="muted">({comments.length})</span>}</h2><WalletGate />
        {socialState !== 'ready' && <p className="inline-callout" role="status">{socialState === 'loading' ? 'Đang tải bình luận…' : socialState === 'error' ? socialError : 'Bình luận và yêu thích hiện chưa sẵn sàng.'}</p>}
        <form className="comment-form" onSubmit={async event => { event.preventDefault(); if (await app.addComment(id, comment)) setComment('') }}><label htmlFor="new-comment">Chia sẻ ý kiến</label><textarea id="new-comment" rows={3} required maxLength={1000} disabled={blocked || !app.features.addComment || socialState !== 'ready'} value={comment} onChange={event => setComment(event.target.value)} placeholder="Viết bình luận của bạn…" /><div className="card-bottom"><span>{comment.length}/1.000 ký tự</span><button className="primary-button" disabled={blocked || !app.features.addComment || socialState !== 'ready' || !comment.trim()}>Gửi bình luận</button></div></form>
        {socialState === 'ready' && comments.length === 0 && <p className="muted">Chưa có bình luận.</p>}
        {socialState === 'ready' && comments.map(item => <article className="comment" key={item.id}><div className="card-bottom"><strong title={item.account}>{shortAddress(item.account)}</strong><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time></div><p>{item.text}</p>{item.account === app.account && app.authenticated && <button className="text-button" disabled={app.busy || !app.features.deleteComment} onClick={() => { if (window.confirm('Xóa bình luận này?')) void app.deleteComment(id, item.id) }}>Xóa bình luận</button>}</article>)}
      </section></div>
      <aside className="funding-panel"><p className="eyebrow">CÙNG NHAU ĐÓNG GÓP</p><FundingProgress campaign={campaign} /><p className="deadline">Hạn chót: {campaignTiming(campaign)}</p><WalletGate />
        {status === 'pending' && <div className="inline-callout"><strong>Chiến dịch đang chờ duyệt.</strong><p>Chưa nhận góp, rút hoặc hoàn tiền. Thời lượng gọi vốn: {durationLabel(campaign.durationSeconds)}, tính từ khi được duyệt.</p></div>}
        {status === 'rejected' && <div className="inline-callout"><strong>Chiến dịch đã bị từ chối.</strong><p>Lý do: {campaign.rejectionReason}</p><p>Chiến dịch không nhận góp. Chủ chiến dịch có thể tạo đề xuất mới.</p></div>}
        {status === 'active' && <><p className="help-text">{hasReachedGoal(campaign) ? 'Đã đủ mục tiêu, vẫn nhận góp đến hạn chót. Chủ chiến dịch chưa được rút.' : 'Chiến dịch còn hạn và đang nhận góp vốn.'}</p><form onSubmit={contribute}><label htmlFor="contribution-amount">Số ETH muốn góp</label><input id="contribution-amount" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.01" /><p className="help-text">Sepolia ETH thử nghiệm. Phí gas tính riêng.</p>{error && <p className="field-error" role="alert">{error}</p>}<button className="primary-button full-width" disabled={blocked || !app.features.contribute}>Góp vốn</button>{!app.features.contribute && <p className="help-text">Góp vốn hiện chưa sẵn sàng.</p>}</form></>}
        {status === 'successful' && <><p className="inline-callout">{campaign.withdrawn ? 'Chủ chiến dịch đã rút vốn.' : 'Đã hết hạn và đủ mục tiêu. Chỉ chủ chiến dịch được rút vốn.'}</p>{campaign.owner === app.account && <button className="primary-button full-width" disabled={blocked || !app.features.withdraw || campaign.withdrawn} onClick={() => app.transact({ type: 'withdraw', id }, 'Xác nhận rút vốn', `Rút ${campaign.totalRaisedEth} ETH từ “${campaign.title}”. Chỉ rút được một lần.`, refresh)}>{campaign.withdrawn ? 'Đã rút vốn' : 'Rút vốn'}</button>}</>}
        {status === 'unsuccessful' && <><p className="inline-callout">Đã hết hạn và chưa đủ mục tiêu. Mỗi ví tự yêu cầu hoàn khoản đã góp.</p>{contribution !== '0' ? <><p>Bạn đã góp: <strong>{contribution} ETH</strong></p><button className="primary-button full-width" disabled={blocked || !app.features.refund || refunded} onClick={() => app.transact({ type: 'refund', id }, 'Xác nhận hoàn tiền', `Hoàn ${contribution} ETH đã góp cho “${campaign.title}”.`, refresh)}>{refunded ? 'Đã hoàn tiền' : 'Yêu cầu hoàn tiền'}</button></> : <p className="help-text">{app.account ? 'Ví này chưa có khoản góp để hoàn.' : 'Kết nối ví để xem khoản được hoàn.'}</p>}</>}
        {contribution !== '0' && status !== 'unsuccessful' && <p className="help-text">Khoản bạn đã góp: {contribution} ETH</p>}
        <p className="help-text">Dữ liệu tại block {campaign.snapshot.blockNumber}. Trạng thái tính theo thời gian blockchain tại lần tải này. Hãy tải lại trước khi giao dịch.</p><a className="help-text" href={`https://sepolia.etherscan.io/address/${campaign.snapshot.contractAddress}`} target="_blank" rel="noreferrer">Xem contract trên Sepolia ↗</a>
        <details className="report-form"><summary>Báo cáo nội dung vi phạm</summary><form onSubmit={async event => { event.preventDefault(); if (await app.reportCampaign(id, report)) setReport('') }}><label htmlFor="report-reason">Lý do báo cáo</label><textarea id="report-reason" minLength={10} maxLength={1000} required rows={3} disabled={blocked || !app.features.reportCampaign} value={report} onChange={event => setReport(event.target.value)} /><p className="help-text">Báo cáo giúp quản trị viên xem xét nội dung trên website. Không tự hủy chiến dịch hoặc hoàn tiền.</p><button className="secondary-button" disabled={blocked || !app.features.reportCampaign || report.trim().length < 10}>Gửi báo cáo</button>{!app.features.reportCampaign && <p className="help-text">Gửi báo cáo hiện chưa sẵn sàng.</p>}</form></details>
      </aside>
    </div>
  </section>
}
