import { useRef, useState } from 'react'
import { useDemo } from '../lib/useDemo'
import { validateCampaign } from '../lib/demoModel'

export default function CreateCampaign() {
  const { account, authenticated, wrongNetwork, connect, login, transact, request } = useDemo()
  const [values, setValues] = useState({ title: '', description: '', goalEth: '', deadlineLocal: '', category: 'Cộng đồng' })
  const [image, setImage] = useState('')
  const [imageName, setImageName] = useState('')
  const [reading, setReading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const readerRef = useRef(null)
  const inputRef = useRef(null)
  const generation = useRef(0)

  function change(event) { setCreated(false); setValues({ ...values, [event.target.name]: event.target.value }) }

  function removeImage() {
    generation.current += 1
    readerRef.current?.abort()
    setReading(false); setImage(''); setImageName(''); setImageError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    removeImage()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setImageError('Chọn ảnh JPG, PNG hoặc WebP có dung lượng tối đa 5 MB.'); return
    }
    const token = generation.current
    const reader = new FileReader()
    readerRef.current = reader
    setReading(true)
    reader.onerror = () => { if (token === generation.current) { setReading(false); setImageError('Không đọc được ảnh. Hãy chọn lại.') } }
    reader.onload = () => {
      const preview = new Image()
      preview.onload = () => { if (token === generation.current) { setImage(String(reader.result)); setImageName(file.name); setReading(false) } }
      preview.onerror = () => { if (token === generation.current) { setImageError('File không phải ảnh hợp lệ hoặc ảnh bị hỏng.'); setReading(false) } }
      preview.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const payload = { title: values.title, description: values.description, goalEth: values.goalEth, category: values.category, deadline: `${values.deadlineLocal}:00+07:00`, image }
      validateCampaign(payload)
      transact({ type: 'create', values: payload }, 'Tạo chiến dịch', `${payload.title} · Mục tiêu ${payload.goalEth} ETH · Hạn ${values.deadlineLocal.replace('T', ' ')} (giờ Việt Nam). Mục tiêu và thời hạn không thể sửa sau khi tạo.`, () => { setCreated(true); setValues({ title: '', description: '', goalEth: '', deadlineLocal: '', category: 'Cộng đồng' }); removeImage() })
    } catch (issue) { setError(issue.message) }
  }

  return <section className="page-section narrow-page"><p className="eyebrow">BẮT ĐẦU MỘT ĐIỀU Ý NGHĨA</p><h1 className="page-title">Tạo chiến dịch</h1><p className="page-description">Chia sẻ ý tưởng và mục tiêu của bạn với cộng đồng.</p>
    {!account && <div className="inline-callout">Kết nối ví mẫu trước khi tạo chiến dịch. <button className="secondary-button" onClick={connect}>Kết nối ví mẫu</button></div>}
    {account && !authenticated && <div className="inline-callout">Đăng nhập mẫu để thử luồng tạo chiến dịch và lưu ảnh. <button className="secondary-button" onClick={login}>Ký để đăng nhập (mẫu)</button></div>}
    {created && <div className="success-callout" role="status">Đã tạo chiến dịch mô phỏng. <a href="#/mine">Xem chiến dịch của tôi →</a></div>}
    <form className="form-panel" onSubmit={submit}>
      <label htmlFor="campaign-title">Tên chiến dịch <span>*</span></label><input id="campaign-title" name="title" maxLength={100} required value={values.title} onChange={change} placeholder="Ví dụ: Mang sách đến vùng cao" /><p className="help-text">{values.title.length}/100 ký tự</p>
      <label htmlFor="campaign-description">Mô tả <span>*</span></label><textarea id="campaign-description" name="description" rows={7} maxLength={5000} required value={values.description} onChange={change} placeholder="Giới thiệu mục đích, người được hỗ trợ và cách bạn dự định sử dụng khoản góp…" /><p className="help-text">{values.description.length}/5.000 ký tự</p>
      <div className="form-columns"><div><label htmlFor="campaign-goal">Mục tiêu (ETH) <span>*</span></label><input id="campaign-goal" name="goalEth" inputMode="decimal" required value={values.goalEth} onChange={change} placeholder="0.01" /><p className="help-text">Lớn hơn 0. Dùng dấu chấm cho phần thập phân.</p></div><div><label htmlFor="campaign-deadline">Hạn chót (giờ Việt Nam) <span>*</span></label><input id="campaign-deadline" name="deadlineLocal" type="datetime-local" required value={values.deadlineLocal} onChange={change} /><p className="help-text">UTC+7, không phụ thuộc múi giờ máy.</p></div></div>
      <label htmlFor="campaign-category">Chủ đề</label><select id="campaign-category" name="category" value={values.category} onChange={change}><option>Cộng đồng</option><option>Giáo dục</option><option>Môi trường</option><option>Y tế</option><option>Sáng tạo</option><option>Khác</option></select>
      <label htmlFor="campaign-image">Ảnh bìa (không bắt buộc)</label><div className="image-upload"><input ref={inputRef} id="campaign-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /><p className="help-text">Một ảnh JPG/PNG/WebP, tối đa 5 MB. Chỉ lưu cục bộ trong bản mô phỏng.</p>{reading && <p role="status">Đang đọc ảnh…</p>}{image && <div className="image-preview"><img src={image} alt="Xem trước ảnh bìa" /><p>{imageName}</p><button type="button" className="secondary-button" onClick={removeImage}>Xóa ảnh</button></div>}{imageError && <p className="field-error" role="alert">{imageError}</p>}</div>
      <p className="inline-callout">Kiểm tra kỹ trước khi tạo. Mục tiêu và hạn chót sẽ không được sửa sau khi tạo chiến dịch. Chưa đủ mục tiêu khi hết hạn thì người góp yêu cầu hoàn tiền.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={!account || !authenticated || wrongNetwork || reading || !!request}>Xem lại và tạo chiến dịch</button>
    </form>
  </section>
}
