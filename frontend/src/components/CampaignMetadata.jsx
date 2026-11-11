import { useRef, useState } from 'react'
import { useApp } from '../lib/useApp'
import { errorMessage } from '../lib/integration'

export default function CampaignMetadata({ campaign, onSaved }) {
  const app = useApp()
  const [category, setCategory] = useState(campaign.category)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const sending = useRef(false)
  const input = useRef(null)
  async function save(event) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true; setBusy(true); setMessage('')
    try {
      let image
      if (file) image = (await app.adapter.uploadImage({ id: campaign.id, account: app.account, file })).image
      await app.adapter.saveMetadata({ id: campaign.id, account: app.account, category, image })
      setMessage('Đã lưu ảnh/chủ đề.'); setFile(null)
      if (input.current) input.current.value = ''
      onSaved()
    } catch (error) { setMessage(errorMessage(error)) }
    finally { sending.current = false; setBusy(false) }
  }
  return <details className="content-panel"><summary>Cập nhật ảnh và chủ đề</summary><form onSubmit={save}>
    <label htmlFor="metadata-category">Chủ đề</label><select id="metadata-category" value={category} onChange={e => setCategory(e.target.value)}>
      {['Cộng đồng', 'Giáo dục', 'Môi trường', 'Y tế', 'Sáng tạo', 'Khác'].map(value => <option key={value}>{value}</option>)}
    </select>
    <label htmlFor="metadata-image">Ảnh mới (không bắt buộc)</label><input ref={input} id="metadata-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
    <p className="help-text">PNG, JPEG hoặc WebP, tối đa 5 MB. Bạn có thể thử lưu lại ảnh/chủ đề nếu bước đồng bộ sau tạo chiến dịch bị lỗi; không cần tạo chiến dịch mới.</p>
    {message && <p role="status">{message}</p>}
    <button className="secondary-button" disabled={busy || app.busy || !app.authenticated || app.wrongNetwork}>{busy ? 'Đang lưu…' : 'Lưu ảnh/chủ đề'}</button>
  </form></details>
}
