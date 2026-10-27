import { useState } from 'react'
import { useDemo } from '../lib/useDemo'
import { campaignStatus, parseAmount, shortAddress, statusLabels } from '../lib/demoModel'
import { CampaignArt, FundingProgress } from '../components/CampaignCard'
import { dateFormatter } from '../lib/demoModel'
import { useNow } from '../lib/useNow'

export default function CampaignDetail({ id }) {
  const demo = useDemo()
  const now = useNow()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const campaign = demo.data.campaigns.find((item) => item.id === id)
  if (!campaign) return <section className="empty-state"><h1 className="page-title">Không tìm thấy chiến dịch</h1><a href="#/">Về khám phá</a></section>
  const status = campaignStatus(campaign, now)
  const favorite = (demo.data.favorites[demo.account] || []).includes(id)
  const comments = demo.data.comments[id] || []
  const contribution = campaign.contributions[demo.account] || '0'
  const refunded = campaign.refunded[demo.account]

  function contribute(event) {
    event.preventDefault(); setError('')
    try {
      parseAmount(amount)
      demo.transact({ type: 'contribute', id, amount }, 'Xác nhận góp vốn', `Góp ${amount} ETH mô phỏng cho “${campaign.title}”. Phí gas của giao dịch thật sẽ được tính riêng.`, () => setAmount(''))
    } catch (issue) { setError(issue.message) }
  }

  return <section className="page-section">
    <a className="back-link" href="#/">← Khám phá chiến dịch</a>
    <div className="detail-heading"><div><span className={`status ${status}`}>{statusLabels[status]}</span><h1 className="page-title">{campaign.title}</h1><p className="page-description">Tạo bởi <span title={campaign.owner}>{shortAddress(campaign.owner)}</span> · {campaign.category}</p></div><button className="secondary-button" aria-pressed={favorite} onClick={() => demo.toggleFavorite(id)}>{favorite ? '♥ Đã yêu thích' : '♡ Lưu yêu thích'}</button></div>
    <div className="detail-layout"><div><div className="detail-art"><CampaignArt campaign={campaign} /></div><section className="content-panel"><h2>Câu chuyện chiến dịch</h2><p className="full-description">{campaign.description}</p></section>
      <section className="content-panel"><h2>Bình luận <span className="muted">({comments.length})</span></h2>
        {!demo.account ? <div className="inline-callout">Kết nối ví để tham gia thảo luận. <button className="secondary-button" onClick={demo.connect}>Kết nối ví mẫu</button></div> : !demo.authenticated ? <div className="inline-callout">Xác thực ví để gửi bình luận. <button className="secondary-button" onClick={demo.login}>Ký để đăng nhập (mẫu)</button></div> : <form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (demo.addComment(id, comment)) setComment('') }}><label htmlFor="new-comment">Chia sẻ ý kiến</label><textarea id="new-comment" rows={3} required maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Viết bình luận của bạn…" /><div className="card-bottom"><span>{comment.length}/1.000 ký tự</span><button className="primary-button" disabled={demo.wrongNetwork || !comment.trim()}>Gửi bình luận</button></div></form>}
        {comments.length === 0 && <p className="muted">Chưa có bình luận. Hãy mở đầu cuộc trò chuyện.</p>}
        {comments.map((item) => <article className="comment" key={item.id}><div className="card-bottom"><strong title={item.account}>{shortAddress(item.account)}</strong><time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time></div><p>{item.text}</p>{item.account === demo.account && demo.authenticated && <button className="text-button" onClick={() => { if (window.confirm('Xóa bình luận này?')) demo.deleteComment(id, item.id) }}>Xóa bình luận</button>}</article>)}
      </section></div>
      <aside className="funding-panel"><p className="eyebrow">CÙNG NHAU ĐÓNG GÓP</p><FundingProgress campaign={campaign} /><p className="deadline">Hạn chót: <time dateTime={campaign.deadline}>{dateFormatter.format(new Date(campaign.deadline))}</time> (giờ Việt Nam)</p>
        {status === 'active' && <><p className="help-text">{Number(campaign.totalRaisedEth) >= Number(campaign.goalEth) ? 'Đã đạt mục tiêu và vẫn nhận góp đến hết hạn. Chủ chiến dịch chưa được rút vốn.' : 'Chiến dịch còn hạn và đang nhận góp vốn.'}</p><form onSubmit={contribute}><label htmlFor="contribution-amount">Số ETH muốn góp</label><input id="contribution-amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.01" /><p className="help-text">ETH mô phỏng. Phí gas tính riêng trong bản thật.</p>{error && <p className="field-error" role="alert">{error}</p>}{!demo.account ? <button type="button" className="primary-button full-width" onClick={demo.connect}>Kết nối ví mẫu để góp</button> : <button className="primary-button full-width" disabled={demo.wrongNetwork || !!demo.request}>Góp vốn mô phỏng</button>}</form></>}
        {status === 'successful' && <><p className="inline-callout">{campaign.withdrawn ? 'Chủ chiến dịch đã rút vốn mô phỏng.' : 'Đã kết thúc và đạt mục tiêu. Chỉ chủ chiến dịch được rút vốn.'}</p>{campaign.owner === demo.account && <button className="primary-button full-width" disabled={campaign.withdrawn || demo.wrongNetwork || !!demo.request} onClick={() => demo.transact({ type: 'withdraw', id }, 'Xác nhận rút vốn', `Rút ${campaign.totalRaisedEth} ETH mô phỏng từ “${campaign.title}”. Chỉ rút được một lần.`)}>{campaign.withdrawn ? 'Đã rút vốn' : 'Rút vốn mô phỏng'}</button>}</>}
        {status === 'unsuccessful' && <><p className="inline-callout">Đã kết thúc và chưa đủ mục tiêu. Mỗi người góp tự yêu cầu hoàn khoản của mình.</p>{contribution !== '0' ? <><p>Bạn đã góp: <strong>{contribution} ETH</strong></p><button className="primary-button full-width" disabled={refunded || demo.wrongNetwork || !!demo.request} onClick={() => demo.transact({ type: 'refund', id }, 'Xác nhận hoàn tiền', `Hoàn ${contribution} ETH mô phỏng đã góp cho “${campaign.title}”.`)}>{refunded ? 'Đã hoàn tiền' : 'Yêu cầu hoàn tiền mô phỏng'}</button></> : <p className="help-text">{demo.account ? 'Ví này không có khoản góp để hoàn.' : 'Kết nối ví mẫu để xem khoản được hoàn.'}</p>}</>}
        {status !== 'active' && !demo.account && <button className="secondary-button full-width" onClick={demo.connect}>Kết nối ví mẫu</button>}
        {contribution !== '0' && status !== 'unsuccessful' && <p className="help-text">Khoản bạn đã góp: {contribution} ETH</p>}
        <p className="help-text">Thông tin và số dư tại đây chỉ là dữ liệu mô phỏng, không phải bằng chứng giao dịch blockchain.</p>
      </aside>
    </div>
  </section>
}
