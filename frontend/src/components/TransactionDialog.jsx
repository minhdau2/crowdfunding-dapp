import { useEffect, useRef } from 'react'
import { useDemo } from '../lib/useDemo'

export default function TransactionDialog() {
  const { request, phase, outcome, setOutcome, confirm, closeRequest, notice } = useDemo()
  const dialogRef = useRef(null)
  const busy = phase === 'signing' || phase === 'pending'
  useEffect(() => {
    const dialog = dialogRef.current
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])
  return <dialog ref={dialogRef} className="transaction-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) closeRequest() }}>
    {request && <>
      <p className="eyebrow">CHỈ MÔ PHỎNG · KHÔNG CHUYỂN ETH</p>
      <h2>{request.title}</h2>
      <p className="dialog-details">{request.details}</p>
      {phase === 'review' && <>
        <label htmlFor="demo-outcome">Kết quả muốn thử</label>
        <select id="demo-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          <option value="success">Thành công</option><option value="reject">Người dùng từ chối ký</option><option value="error">Giao dịch thất bại</option>
        </select>
        <p className="help-text">Bản thật sẽ mở MetaMask. Góp/rút/hoàn có phí gas riêng; ký đăng nhập không tốn gas.</p>
        <div className="button-row"><button className="secondary-button" onClick={closeRequest}>Quay lại</button><button className="primary-button" onClick={confirm}>Xác nhận mô phỏng</button></div>
      </>}
      {busy && <p className="transaction-state" role="status"><span className="spinner" />{phase === 'signing' ? 'Đang chờ ký mô phỏng…' : 'Đang chờ xác nhận mô phỏng…'}</p>}
      {(phase === 'success' || phase === 'error') && <><p className={`transaction-state ${phase}`} role="status">{notice}</p><button className="primary-button" onClick={closeRequest}>{phase === 'success' ? 'Hoàn tất' : 'Đóng và thử lại'}</button></>}
    </>}
  </dialog>
}
