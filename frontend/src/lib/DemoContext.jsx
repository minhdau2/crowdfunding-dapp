import { useEffect, useRef, useState } from 'react'
import { applyOperation, createDemoData, DEMO_ACCOUNTS } from './demoModel'

import { DemoContext } from './useDemo'
const STORAGE_KEY = 'chung-tay-demo-v1'

export function DemoProvider({ children }) {
  const [initial] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (saved?.version === 1 && Array.isArray(saved.campaigns) && saved.favorites && saved.comments) return saved
    } catch { /* Dữ liệu không đọc được: dùng bộ mẫu mới. */ }
    return createDemoData()
  })
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(true)
  const dataRef = useRef(initial)
  const [account, setAccount] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [notice, setNotice] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [request, setRequest] = useState(null)
  const [phase, setPhase] = useState('review')
  const [outcome, setOutcome] = useState('success')
  const busyRef = useRef(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  function commit(next) {
    dataRef.current = next
    setData(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setStorageWarning('')
    } catch {
      setStorageWarning('Không lưu được vào trình duyệt (có thể do ảnh quá lớn hoặc bộ nhớ bị chặn). Thay đổi hiện chỉ giữ trong phiên này; tải lại trang có thể mất dữ liệu mới.')
    }
  }

  function connect() {
    setAccount(DEMO_ACCOUNTS[0])
    setAuthenticated(false)
    setNotice('Đã chọn ví A mô phỏng. Không kết nối MetaMask thật.')
  }

  function requireWallet() {
    if (!account) { setNotice('Hãy bấm “Kết nối ví mẫu” trước.'); return false }
    if (wrongNetwork) { setNotice('Hãy chuyển về Sepolia mô phỏng trước khi thao tác.'); return false }
    return true
  }

  function transact(operation, title, details, onSuccess) {
    if (!requireWallet() || busyRef.current || request) return
    setRequest({ operation, title, details, onSuccess, account })
    setPhase('review')
    setOutcome('success')
  }

  function login() {
    if (!requireWallet() || request) return
    setRequest({ login: true, title: 'Đăng nhập mô phỏng', details: 'Thử luồng xác thực bằng ví. Không có thông điệp nào được ký thật và không tạo phiên đăng nhập trên server.', account })
    setPhase('review')
    setOutcome('success')
  }

  function confirm() {
    if (busyRef.current || !request) return
    busyRef.current = true
    setPhase('signing')
    timerRef.current = setTimeout(() => {
      if (outcome === 'reject') {
        setPhase('error'); setNotice('Bạn đã từ chối ký trong mô phỏng. Dữ liệu không thay đổi.'); busyRef.current = false; return
      }
      setPhase('pending')
      timerRef.current = setTimeout(() => {
        try {
          if (outcome === 'error') throw new Error('Lỗi giao dịch mô phỏng. Hãy thử lại; dữ liệu chưa thay đổi.')
          if (request.login) setAuthenticated(true)
          else commit(applyOperation(dataRef.current, request.operation, request.account))
          setPhase('success')
          setNotice(request.login ? 'Đã đăng nhập mô phỏng.' : 'Thao tác mô phỏng thành công. Không có ETH thật được chuyển.')
          request.onSuccess?.()
        } catch (error) { setNotice(error.message); setPhase('error') }
        busyRef.current = false
      }, 900)
    }, 700)
  }

  function socialReady() {
    if (!requireWallet()) return false
    if (!authenticated) { login(); return false }
    return true
  }

  function toggleFavorite(id) {
    if (!socialReady()) return
    const ids = dataRef.current.favorites[account] || []
    commit({ ...dataRef.current, favorites: { ...dataRef.current.favorites, [account]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] } })
  }

  function addComment(id, text) {
    if (!socialReady()) return false
    if (!text.trim() || text.trim().length > 1000) { setNotice('Bình luận cần từ 1 đến 1.000 ký tự.'); return false }
    const comment = { id: crypto.randomUUID(), account, text: text.trim(), createdAt: new Date().toISOString() }
    commit({ ...dataRef.current, comments: { ...dataRef.current.comments, [id]: [...(dataRef.current.comments[id] || []), comment] } })
    return true
  }

  function deleteComment(id, commentId) {
    if (!socialReady()) return
    commit({ ...dataRef.current, comments: { ...dataRef.current.comments, [id]: (dataRef.current.comments[id] || []).filter((item) => item.id !== commentId || item.account !== account) } })
  }

  function switchAccount(value) { setAccount(value); setAuthenticated(false); setNotice('Đã đổi ví mô phỏng. Cần đăng nhập lại để bình luận hoặc lưu yêu thích.') }

  function resetDemo() {
    if (request || !window.confirm('Xóa dữ liệu mô phỏng trên trình duyệt này và khôi phục 3 chiến dịch mẫu?')) return
    commit(createDemoData())
    setNotice('Đã khôi phục dữ liệu mẫu. Có thể thử lại rút và hoàn tiền.')
  }

  return <DemoContext.Provider value={{ data, loading, resetDemo, account, authenticated, wrongNetwork, setWrongNetwork, notice, setNotice, storageWarning, connect, switchAccount, logout: () => { setAccount(''); setAuthenticated(false) }, login, transact, toggleFavorite, addComment, deleteComment, request, phase, outcome, setOutcome, confirm, closeRequest: () => { if (!busyRef.current) setRequest(null) } }}>{children}</DemoContext.Provider>
}
