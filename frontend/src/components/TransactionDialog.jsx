import { useEffect, useRef } from 'react'
import { useApp } from '../lib/useApp'
export default function TransactionDialog() {
  const { request, phase, confirm, closeRequest, transactionHash, transactionMessage, busy: working } = useApp()
  const dialogRef = useRef(null)
  const busy = phase === 'signing' || phase === 'pending'
  useEffect(() => {
    const dialog = dialogRef.current
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])
  return <dialog ref={dialogRef} className="transaction-dialog" aria-labelledby="transaction-title" onCancel={event => { event.preventDefault(); if (!busy) closeRequest() }}>
    {request && <><p className="eyebrow">GIAO DỊCH ETHEREUM SEPOLIA</p><h2 id="transaction-title">{request.title}</h2><p className="dialog-details">{request.details}</p>
      {phase === 'review' && <><p className="help-text">Kiểm tra thông tin trước khi ký trong MetaMask. Phí gas được ví hiển thị riêng.</p><div className="button-row"><button className="secondary-button" onClick={closeRequest}>Quay lại</button><button className="primary-button" onClick={confirm}>Tiếp tục với MetaMask</button></div></>}
      {busy && <p className="transaction-state" role="status"><span className="spinner" />{phase === 'signing' ? 'Đang chờ xác nhận trong ví…' : 'Đã gửi giao dịch. Đang chờ xác nhận trên Sepolia…'}</p>}
      {transactionHash && <p className="help-text">Mã giao dịch: <a className="hash-link" href={`https://sepolia.etherscan.io/tx/${transactionHash}`} target="_blank" rel="noreferrer">{transactionHash}</a></p>}
      {(phase === 'success' || phase === 'error') && <><p className={`transaction-state ${phase}`} role="status">{transactionMessage}</p>{transactionHash && phase === 'error' && <p className="help-text">Kiểm tra trạng thái giao dịch trước khi gửi lại.</p>}<button className="primary-button" disabled={working} onClick={closeRequest}>{working ? 'Đang cập nhật…' : phase === 'success' ? 'Hoàn tất' : 'Đóng'}</button></>}
    </>}
  </dialog>
}
