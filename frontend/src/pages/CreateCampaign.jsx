import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/useApp'
import { validateCampaign } from '../lib/campaignModel'
import WalletGate from '../components/WalletGate'

const initial = { title: '', description: '', goalEth: '', durationDays: '7', category: 'Cộng đồng' }
export default function CreateCampaign() {
  const app = useApp()
  const [values, setValues] = useState(initial)
  const [file, setFile] = useState(null)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const [review, setReview] = useState(false)
  const input = useRef(null)
  const previewUrl = useRef('')
  const metadataReady = typeof app.adapter?.uploadImage === 'function' && typeof app.adapter?.saveMetadata === 'function'
  const canCreate = app.features.create && app.account && app.authenticated && !app.wrongNetwork && !app.busy && !app.request
  useEffect(() => () => URL.revokeObjectURL(previewUrl.current), [])
  function selectImage(value) {
    URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = value ? URL.createObjectURL(value) : ''
    setFile(value); setImage(previewUrl.current)
  }
  function change(event) { setCreated(false); setReview(false); setValues({ ...values, [event.target.name]: event.target.value }) }
  function payload() {
    const result = { title: values.title.trim(), description: values.description.trim(), goalEth: values.goalEth,
      durationDays: values.durationDays, durationSeconds: (BigInt(values.durationDays || '0') * 86400n).toString(), ...(metadataReady ? { category: values.category, imageFile: file } : {}) }
    validateCampaign(result)
    return result
  }
  function preview(event) {
    event.preventDefault(); setError('')
    try { payload(); setReview(true) } catch (issue) { setError(issue.message) }
  }
  function create() {
    try {
      const values = payload()
      app.transact({ type: 'create', values }, 'Gửi chiến dịch chờ duyệt', `${values.title} · Mục tiêu ${values.goalEth} ETH · Gọi vốn ${values.durationDays} ngày kể từ lúc được duyệt. Chưa nhận góp trong thời gian chờ duyệt.`, () => {
        setCreated(true); setValues(initial); selectImage(null); setReview(false)
        if (input.current) input.current.value = ''
      })
    } catch (issue) { setError(issue.message) }
  }
  return <section className="page-section narrow-page"><p className="eyebrow">BẮT ĐẦU MỘT ĐIỀU Ý NGHĨA</p><h1 className="page-title">Tạo chiến dịch</h1><p className="page-description">Gửi đề xuất để được xem xét. Thời gian gọi vốn chỉ bắt đầu sau khi được duyệt.</p>
    <WalletGate />
    {!app.features.create && <p className="inline-callout">Gửi chiến dịch chờ duyệt hiện chưa sẵn sàng. Bạn có thể điền và xem lại thông tin; thông tin chưa được lưu hoặc gửi đi.</p>}
    {created && <div className="success-callout" role="status">Đề xuất đã được ghi nhận, đang chờ duyệt. Chiến dịch chưa nhận góp. <a href="#/mine">Xem chiến dịch của tôi →</a></div>}
    <form className="form-panel" onSubmit={preview}>
      <label htmlFor="campaign-title">Tên chiến dịch <span>*</span></label><input id="campaign-title" name="title" maxLength={100} required value={values.title} onChange={change} placeholder="Ví dụ: Mang sách đến vùng cao" /><p className="help-text">{values.title.length}/100 ký tự</p>
      <label htmlFor="campaign-description">Mô tả <span>*</span></label><textarea id="campaign-description" name="description" rows={7} maxLength={5000} required value={values.description} onChange={change} placeholder="Giới thiệu mục đích, người được hỗ trợ và kế hoạch sử dụng khoản góp…" /><p className="help-text">{values.description.length}/5.000 ký tự</p>
      <div className="form-columns"><div><label htmlFor="campaign-goal">Mục tiêu (ETH) <span>*</span></label><input id="campaign-goal" name="goalEth" inputMode="decimal" required value={values.goalEth} onChange={change} placeholder="0.01" /><p className="help-text">Lớn hơn 0. Dùng dấu chấm cho phần thập phân.</p></div><div><label htmlFor="campaign-duration">Thời lượng gọi vốn (ngày) <span>*</span></label><input id="campaign-duration" name="durationDays" type="number" min="1" max="90" step="1" required value={values.durationDays} onChange={change} /><p className="help-text">Từ 1 đến 90 ngày, tính từ lúc được duyệt. Chưa xác định hạn chót trong thời gian chờ.</p></div></div>
      <label htmlFor="campaign-category">Chủ đề</label><select id="campaign-category" name="category" disabled={!metadataReady} value={values.category} onChange={change}>{['Cộng đồng', 'Giáo dục', 'Môi trường', 'Y tế', 'Sáng tạo', 'Khác'].map(item => <option key={item}>{item}</option>)}</select>
      <label htmlFor="campaign-image">Ảnh bìa (không bắt buộc)</label><div className="image-upload"><input ref={input} id="campaign-image" type="file" disabled={!metadataReady} accept="image/jpeg,image/png,image/webp" onChange={event => {
        setReview(false); setError(''); const imageFile = event.target.files?.[0]
        if (!imageFile) { selectImage(null); return }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) { setError('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.'); event.target.value = ''; selectImage(null); return }
        selectImage(imageFile)
      }} /><p className="help-text">{metadataReady ? 'Một ảnh JPG/PNG/WebP, tối đa 5 MB.' : 'Ảnh bìa và chủ đề chưa sẵn sàng để lưu.'}</p>{image && <div className="image-preview"><img src={image} alt="Xem trước ảnh bìa" /><button type="button" className="secondary-button" onClick={() => { selectImage(null); setReview(false); input.current.value = '' }}>Xóa ảnh</button></div>}</div>
      <p className="inline-callout">Chờ duyệt → bắt đầu gọi vốn → kết thúc. Chưa duyệt hoặc bị từ chối thì không nhận tiền. Khi hết hạn: đủ mục tiêu thì chủ rút, thiếu mục tiêu thì người góp yêu cầu hoàn.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="secondary-button" type="submit" disabled={app.busy || !!app.request}>Xem lại thông tin</button>
      {review && <section className="review-panel" aria-label="Xem lại chiến dịch"><h2>Kiểm tra trước khi tạo</h2><dl><dt>Tên chiến dịch</dt><dd>{values.title}</dd><dt>Mục tiêu</dt><dd>{values.goalEth} ETH</dd><dt>Thời lượng</dt><dd>{values.durationDays} ngày kể từ lúc được duyệt</dd><dt>Trạng thái ban đầu</dt><dd>Chờ duyệt · Chưa nhận góp</dd></dl><p className="help-text">Phí gas tính riêng. Gửi đề xuất thành công không đồng nghĩa đã được duyệt. Hạn chót chính thức được ghi khi giao dịch duyệt thành công.</p><button className="primary-button" type="button" disabled={!canCreate} onClick={create}>Gửi chiến dịch chờ duyệt</button>{!canCreate && <p className="help-text">Cần kết nối ví, đăng nhập và chức năng tạo chiến dịch sẵn sàng.</p>}</section>}
    </form>
  </section>
}
