import { useCallback, useEffect, useRef, useState } from 'react'
import { AppContext } from './useApp'
import { address, CHAIN_ID, normalizeCampaign, uintString } from './campaignModel'
import { capabilities, errorMessage, normalizeList, normalizeSession, runConfirmedOperation, unavailableMessage } from './integration'

const emptySession = { account: '', chainId: null, authenticated: false, isAdmin: false, isReviewer: false }
const emptyData = () => ({ campaigns: [], favorites: {}, comments: {} })

export function AppProvider({ adapter, children }) {
  const features = capabilities(adapter)
  const [session, setSession] = useState(emptySession)
  const sessionRef = useRef(emptySession)
  const generation = useRef(0)
  const mounted = useRef(true)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState(emptyData)
  const [loadState, setLoadState] = useState(features.loadCampaigns ? 'loading' : 'unavailable')
  const [loadError, setLoadError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [notice, setNotice] = useState('')
  const [request, setRequest] = useState(null)
  const [phase, setPhase] = useState('review')
  const [transactionHash, setTransactionHash] = useState('')
  const [transactionMessage, setTransactionMessage] = useState('')
  const listSequence = useRef(0)

  const acceptSession = useCallback((value) => {
    const next = normalizeSession(value)
    if (JSON.stringify(next) !== JSON.stringify(sessionRef.current)) {
      generation.current++
      sessionRef.current = next
      setData(emptyData())
      setSession(next)
      if (!busyRef.current) setRequest(null)
    }
    return next
  }, [])

  useEffect(() => {
    mounted.current = true
    let active = true
    const initialEpoch = generation.current
    const invalidate = () => { if (active) acceptSession(emptySession) }
    const unsubscribe = adapter?.subscribeSession?.((next) => {
      try { if (active) acceptSession(next) } catch { invalidate() }
    })
    Promise.resolve().then(() => adapter?.getSession?.()).then(next => {
      if (active && next && initialEpoch === generation.current) acceptSession(next)
    }).catch(() => { if (active) setNotice('Chưa kiểm tra được phiên đăng nhập. Hãy kết nối lại ví.'); invalidate() })
    return () => { active = false; mounted.current = false; unsubscribe?.() }
  }, [adapter, acceptSession])

  const refresh = useCallback(async () => {
    const sequence = ++listSequence.current
    const epoch = generation.current
    const account = sessionRef.current.account
    setData(emptyData())
    setHasMore(false)
    setLoadError('')
    if (!adapter?.loadCampaigns) { setLoadState('unavailable'); return }
    setLoadState('loading')
    try {
      const result = normalizeList(await adapter.loadCampaigns({ account }), account)
      if (!mounted.current || epoch !== generation.current || sequence !== listSequence.current) return
      setData(current => ({ ...current, campaigns: result.campaigns }))
      setHasMore(result.hasMore)
      setLoadState('ready')
    } catch (error) {
      if (!mounted.current || epoch !== generation.current || sequence !== listSequence.current) return
      setLoadError(errorMessage(error)); setLoadState('error')
    }
  }, [adapter])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) return refresh() })
    return () => { active = false }
  }, [refresh, session.account, session.chainId])

  async function walletAction(name) {
    if (busyRef.current) return
    if (!features[name]) { setNotice(unavailableMessage); return }
    busyRef.current = true; setBusy(true)
    try {
      const next = await adapter[name]()
      acceptSession(next || await adapter.getSession())
    } catch (error) { setNotice(errorMessage(error)) }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }

  async function logout() {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try {
      if (sessionRef.current.authenticated && !features.logout) throw new Error(unavailableMessage)
      await adapter?.logout?.()
      acceptSession(emptySession)
      setNotice('Đã đăng xuất khỏi ứng dụng.')
    } catch (error) { setNotice(errorMessage(error)) }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }

  function ready(name) {
    if (busyRef.current) return false
    if (!features[name]) { setNotice(unavailableMessage); return false }
    if (!session.account) { setNotice('Hãy kết nối ví trước.'); return false }
    if (session.chainId !== CHAIN_ID) { setNotice('Hãy chuyển ví sang Ethereum Sepolia.'); return false }
    if (!session.authenticated) { setNotice('Hãy ký đăng nhập trước khi thực hiện.'); return false }
    return true
  }

  function transact(operation, title, details, onSuccess) {
    if (!ready(operation.type) || request) return
    if (['approve', 'reject'].includes(operation.type) && !session.isReviewer) { setNotice('Ví chưa có quyền duyệt chiến dịch.'); return }
    setRequest({ operation, title, details, onSuccess, account: session.account, generation: generation.current })
    setPhase('review'); setTransactionHash(''); setTransactionMessage('')
  }

  async function confirm() {
    if (!request || !ready(request.operation.type)) return
    if (['approve', 'reject'].includes(request.operation.type) && !session.isReviewer) { setRequest(null); return }
    if (request.generation !== generation.current) { setRequest(null); return }
    busyRef.current = true; setBusy(true); setPhase('signing')
    try {
      const receipt = await runConfirmedOperation(adapter, request.operation, request.account, hash => {
        if (mounted.current) { setTransactionHash(hash); setPhase('pending') }
      })
      if (!mounted.current) return
      setTransactionHash(receipt.hash)
      if (request.generation !== generation.current) {
        setPhase('success'); setTransactionMessage('Giao dịch đã xác nhận. Ví đang chọn đã thay đổi; hãy kiểm tra giao dịch bằng đường dẫn bên dưới.')
        return
      }
      setPhase('success'); setTransactionMessage('Giao dịch đã được xác nhận trên Sepolia.')
      // Sync/read failures must not make an already-mined payment appear failed.
      try { await adapter.afterTransaction?.({ receipt, operation: request.operation }) }
      catch { setTransactionMessage('Giao dịch đã xác nhận, nhưng chưa đồng bộ được dữ liệu. Hãy tải lại, không gửi lại giao dịch.') }
      await refresh()
      request.onSuccess?.(receipt)
    } catch (error) {
      if (mounted.current) { setPhase('error'); setTransactionMessage(errorMessage(error)) }
    } finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }

  const loadCampaign = useCallback(async (id) => {
    uintString(id, true)
    if (!adapter?.loadCampaign) throw new Error(unavailableMessage)
    const epoch = generation.current
    const account = sessionRef.current.account
    const campaign = normalizeCampaign(await adapter.loadCampaign({ id, account }))
    if (epoch !== generation.current) throw new Error('Ví đã thay đổi. Hãy tải lại chiến dịch.')
    if (campaign.id !== id || campaign.viewer !== account) throw new Error('Dữ liệu không khớp chiến dịch hoặc ví đang chọn.')
    return campaign
  }, [adapter])

  const loadSocial = useCallback(async (id) => {
    if (!adapter?.loadSocial) return
    const epoch = generation.current
    const result = await adapter.loadSocial({ id, account: session.account })
    if (epoch !== generation.current || !mounted.current) return
    if (!Array.isArray(result?.comments) || typeof result.favorite !== 'boolean') throw new Error('Chưa đọc được thảo luận và yêu thích.')
    const comments = result.comments.map(item => {
      if (typeof item.id !== 'string' || typeof item.text !== 'string' || item.text.length > 1000
        || !Number.isFinite(Date.parse(item.createdAt))) throw new Error('Dữ liệu bình luận không hợp lệ.')
      return { id: item.id, text: item.text, account: address(item.account), createdAt: item.createdAt }
    })
    setData(current => {
      const favorites = current.favorites[session.account] || []
      return { ...current, comments: { ...current.comments, [id]: comments }, favorites: {
        ...current.favorites, [session.account]: result.favorite ? [...new Set([...favorites, id])] : favorites.filter(value => value !== id),
      } }
    })
  }, [adapter, session.account])

  async function socialAction(name, values) {
    if (!ready(name)) return false
    busyRef.current = true; setBusy(true)
    try {
      const epoch = generation.current
      const result = await adapter[name]({ ...values, account: session.account })
      if (epoch !== generation.current) throw new Error('Ví đã thay đổi. Hãy tải lại để kiểm tra kết quả.')
      if (result?.ok !== true) throw new Error('Chưa xác nhận được thay đổi. Hãy tải lại trước khi thử lại.')
      if (name !== 'reportCampaign') await loadSocial(values.id)
      else setNotice('Đã gửi báo cáo để quản trị viên xem xét.')
      return true
    } catch (error) { setNotice(errorMessage(error)); return false }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }

  return <AppContext.Provider value={{
    adapter, ...session, features, data, loadState, loadError, loading: loadState === 'loading', hasMore,
    busy, notice, setNotice, refresh, loadCampaign, loadSocial,
    wrongNetwork: !!session.account && session.chainId !== CHAIN_ID,
    connect: () => walletAction('connect'), login: () => walletAction('login'), logout,
    switchNetwork: () => walletAction('switchNetwork'), transact, request, phase, confirm, transactionHash, transactionMessage,
    closeRequest: () => { if (!busyRef.current) setRequest(null) },
    toggleFavorite: id => socialAction('toggleFavorite', { id }),
    addComment: (id, text) => socialAction('addComment', { id, text: text.trim() }),
    deleteComment: (id, commentId) => socialAction('deleteComment', { id, commentId }),
    reportCampaign: (id, reason) => socialAction('reportCampaign', { id, reason: reason.trim() }),
  }}>{children}</AppContext.Provider>
}
