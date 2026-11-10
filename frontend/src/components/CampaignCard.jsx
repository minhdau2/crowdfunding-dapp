import { campaignStatus, campaignTiming, fundingPercent, shortAddress, statusLabels } from '../lib/campaignModel'

export function CampaignArt({ campaign }) {
  return <div className="campaign-art community">{campaign.image ? <img src={campaign.image} alt={`Ảnh bìa ${campaign.title}`} loading="lazy" referrerPolicy="no-referrer" /> : <><span className="art-category">{campaign.category}</span><span className="art-symbol" aria-hidden="true">♡</span><span className="art-number" aria-hidden="true">{campaign.id}</span></>}</div>
}
export function FundingProgress({ campaign }) {
  const progress = fundingPercent(campaign)
  const displayed = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(progress)
  return <><div className="funding"><strong>{campaign.totalRaisedEth} ETH</strong><span>/ {campaign.goalEth} ETH</span></div><progress value={Math.min(progress, 100)} max="100" aria-label={`${campaign.title}: đạt ${displayed}% mục tiêu`} /><div className="card-meta"><span>Đạt {progress >= 10000 ? 'ít nhất ' : ''}{displayed}% mục tiêu</span><span>Mục tiêu {campaign.goalEth} ETH</span></div></>
}
export default function CampaignCard({ campaign }) {
  const status = campaignStatus(campaign)
  return <article className="campaign-card"><a className="art-link" href={`#/campaign/${campaign.id}`} aria-label={`Xem ${campaign.title}`}><CampaignArt campaign={campaign} /></a><div className="card-content"><span className={`status ${status}`}>{statusLabels[status]}</span><h3><a className="title-link" href={`#/campaign/${campaign.id}`}>{campaign.title}</a></h3><p className="campaign-description">{campaign.description}</p><FundingProgress campaign={campaign} /><p className="deadline">Hạn chót: {campaignTiming(campaign)}</p><div className="card-bottom"><span>Tạo bởi {shortAddress(campaign.owner)}</span><a href={`#/campaign/${campaign.id}`}>Xem chi tiết ↗</a></div></div></article>
}
