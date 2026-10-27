import { campaignStatus, shortAddress, statusLabels } from '../lib/demoModel'
import { useDemo } from '../lib/useDemo'

import { dateFormatter } from '../lib/demoModel'

export function CampaignArt({ campaign }) {
  return <div className={`campaign-art ${campaign.theme || 'community'}`}>
    {campaign.image ? <img src={campaign.image} alt={`Ảnh bìa ${campaign.title}`} /> : <><span className="art-category">{campaign.category || 'Cộng đồng'}</span><span className="art-symbol" aria-hidden="true">{campaign.symbol || '♡'}</span><span className="art-number" aria-hidden="true">{String(campaign.id).padStart(2, '0')}</span></>}
  </div>
}

export function FundingProgress({ campaign }) {
  const progress = Number(campaign.totalRaisedEth) / Number(campaign.goalEth) * 100
  const displayed = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(progress)
  return <><div className="funding"><strong>{campaign.totalRaisedEth} ETH</strong><span>/ {campaign.goalEth} ETH</span></div><progress value={Math.min(progress, 100)} max="100" aria-label={`${campaign.title}: đạt ${displayed}% mục tiêu`} /><div className="card-meta"><span>Đạt {displayed}% mục tiêu</span><span>Mục tiêu {campaign.goalEth} ETH</span></div></>
}

export default function CampaignCard({ campaign, now }) {
  const { account, data, toggleFavorite } = useDemo()
  const status = campaignStatus(campaign, now)
  const favorite = (data.favorites[account] || []).includes(campaign.id)
  return <article className="campaign-card">
    <a className="art-link" href={`#/campaign/${campaign.id}`} aria-label={`Xem ${campaign.title}`}><CampaignArt campaign={campaign} /></a>
    <div className="card-content"><div className="card-top"><span className={`status ${status}`}>{statusLabels[status]}</span><button className="favorite-button" aria-label={`${favorite ? 'Bỏ yêu thích' : 'Yêu thích'}: ${campaign.title}`} aria-pressed={favorite} onClick={() => toggleFavorite(campaign.id)}>{favorite ? '♥' : '♡'}</button></div>
      <h3><a className="title-link" href={`#/campaign/${campaign.id}`}>{campaign.title}</a></h3>
      <p className="campaign-description">{campaign.description}</p><FundingProgress campaign={campaign} />
      <p className="deadline">Hạn chót: <time dateTime={campaign.deadline}>{dateFormatter.format(new Date(campaign.deadline))}</time> (VN)</p>
      <div className="card-bottom"><span>Tạo bởi {shortAddress(campaign.owner)}</span><a href={`#/campaign/${campaign.id}`}>Xem chi tiết ↗</a></div>
    </div>
  </article>
}
