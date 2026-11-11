import { randomBytes } from 'node:crypto'
import { getAddress, verifyMessage } from 'ethers'

export function installAuth(app, { origin = 'http://localhost:5173', now = Date.now, isAdmin = async () => false } = {}) {
  const challenges = new Map(), sessions = new Map(), attempts = new Map()
  const token = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('chungtay_session='))?.slice(17)
  const cookie = (value, age) => `chungtay_session=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${origin.startsWith('https://') ? '; Secure' : ''}`
  const sweep = () => {
    for (const map of [challenges, sessions, attempts]) for (const [key, value] of map) if (value.expires <= now()) map.delete(key)
  }
  app.use('/api', async (req, res, next) => {
    sweep()
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.headers.origin !== origin) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' })
    const session = sessions.get(token(req))
    req.user = session ? { account: session.account, isAdmin: await isAdmin(session.account) } : null
    next()
  })
  app.post('/api/auth/nonce', (req, res) => {
    sweep()
    const rate = attempts.get(req.ip) || { count: 0, expires: now() + 60000 }
    attempts.set(req.ip, rate)
    if (++rate.count > 20 || challenges.size >= 5000) return res.status(429).json({ error: 'Hãy chờ trước khi đăng nhập lại.' })
    try {
      const account = getAddress(req.body?.account).toLowerCase()
      const nonce = randomBytes(24).toString('hex'), expires = now() + 300000
      const message = `${new URL(origin).host} yêu cầu đăng nhập Chung Tay bằng ví:\n${account}\n\nChỉ xác nhận đăng nhập, không chuyển tiền.\nURI: ${origin}\nChain ID: 11155111\nNonce: ${nonce}\nIssued At: ${new Date(now()).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`
      challenges.set(nonce, { account, message, expires })
      res.json({ nonce, message })
    } catch { res.status(400).json({ error: 'Địa chỉ ví không hợp lệ.' }) }
  })
  app.post('/api/auth/verify', async (req, res) => {
    sweep()
    const challenge = challenges.get(req.body?.nonce)
    challenges.delete(req.body?.nonce)
    try {
      if (!challenge || verifyMessage(challenge.message, req.body?.signature).toLowerCase() !== challenge.account) throw new Error('signature')
      sessions.delete(token(req))
      const sessionToken = randomBytes(32).toString('hex')
      sessions.set(sessionToken, { account: challenge.account, expires: now() + 3600000 })
      res.setHeader('Set-Cookie', cookie(sessionToken, 3600))
      res.json({ account: challenge.account, authenticated: true, isAdmin: await isAdmin(challenge.account) })
    } catch { res.status(401).json({ error: 'Chữ ký sai hoặc nonce đã hết hạn/được sử dụng.' }) }
  })
  app.get('/api/auth/session', (req, res) => {
    sweep()
    res.json({ account: req.user?.account || '', authenticated: !!req.user, isAdmin: req.user?.isAdmin === true })
  })
  app.post('/api/auth/logout', (req, res) => {
    sessions.delete(token(req))
    res.setHeader('Set-Cookie', cookie('', 0))
    res.json({ ok: true })
  })
}
