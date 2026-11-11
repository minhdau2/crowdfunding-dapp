import { useEffect, useRef, useState } from 'react'
import CampaignList from './pages/CampaignList'
import CreateCampaign from './pages/CreateCampaign'
import CampaignDetail from './pages/CampaignDetail'
import AccountCampaigns from './pages/AccountCampaigns'
import Login from './pages/Login'
import Admin from './pages/Admin'
import TransactionDialog from './components/TransactionDialog'
import { AppProvider } from './lib/AppProvider'
import { useApp } from './lib/useApp'
import { shortAddress } from './lib/campaignModel'
import integrationAdapter from './lib/integrationAdapter'
import './App.css'
import './ui-additions.css'

function Site() {
  const [route, setRoute] = useState(window.location.hash || '#/')
  const [menuOpen, setMenuOpen] = useState(false)
  const app = useApp()
  const mainRef = useRef(null)
  useEffect(() => {
    const update = () => { setRoute(window.location.hash || '#/'); setMenuOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const path = route.replace(/^#/, '').split('?')[0]
  const detailId = /^\/campaign\/[1-9]\d{0,77}$/.test(path) ? path.split('/')[2] : null
  const links = [['/', 'Khám phá'], ['/create', 'Tạo chiến dịch'], ['/mine', 'Chiến dịch của tôi'], ['/contributions', 'Khoản đã góp']]
  async function copyAddress() {
    try { await navigator.clipboard.writeText(app.account); app.setNotice('Đã sao chép địa chỉ ví.') }
    catch { app.setNotice(`Địa chỉ ví: ${app.account}`) }
  }
  return <div className="app">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); mainRef.current?.focus(); mainRef.current?.scrollIntoView({ block: 'start' }) }}>Đến nội dung chính</a>
    <header className="site-header">
      <a className="brand" href="#/"><span aria-hidden="true">C</span> Chung Tay</a>
      <button className="mobile-menu secondary-button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      <nav id="main-nav" className={menuOpen ? 'nav open' : 'nav'} aria-label="Điều hướng chính">{links.map(([href, label]) => <a href={`#${href}`} key={href} aria-current={path === href ? 'page' : undefined}>{label}</a>)}</nav>
      {!app.account ? <a className="primary-button" href="#/login">Kết nối ví / Đăng nhập</a> : <details className="account-menu"><summary>{shortAddress(app.account)} <span aria-hidden="true">⌄</span></summary><div className="account-dropdown">
        <p>{app.authenticated ? 'Đã đăng nhập' : 'Chưa đăng nhập'} · Ethereum Sepolia</p>
        {!app.authenticated && <a href="#/login">Đăng nhập bằng ví</a>}
        <button onClick={copyAddress}>Sao chép địa chỉ</button><a href="#/favorites">Đã yêu thích</a>
        {(app.isAdmin || app.isReviewer) && <a href="#/admin">Quản trị nội dung</a>}
        <button disabled={app.busy} onClick={app.logout}>Đăng xuất</button>
      </div></details>}
    </header>
    {app.wrongNetwork && <div className="network-warning" role="alert">Ví đang ở sai mạng. Hãy chọn Ethereum Sepolia.<button disabled={!app.features.switchNetwork || app.busy} onClick={app.switchNetwork}>Chuyển sang Sepolia</button></div>}
    {app.notice && <div className="notice" role="status"><span>{app.notice}</span><button aria-label="Đóng thông báo" onClick={() => app.setNotice('')}>×</button></div>}
    <main ref={mainRef} id="main-content" tabIndex="-1">
      {path === '/' ? <><section className="hero"><p className="eyebrow">GỌI VỐN CỘNG ĐỒNG</p><h1>Ý tưởng nhỏ.<br />Thay đổi lớn.</h1><p className="hero-description">Khám phá những dự án ý nghĩa và cùng nhau tạo nên giá trị cho cộng đồng.</p><div className="hero-actions"><a className="primary-link" href="#/create">Bắt đầu một chiến dịch <span aria-hidden="true">↗</span></a><a className="secondary-button" href="#/" onClick={event => { event.preventDefault(); document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' }) }}>Khám phá dự án</a></div><p className="help-text">Một ví để góp vốn và tạo chiến dịch · Ethereum Sepolia</p></section><CampaignList /></>
        : path === '/login' ? <Login /> : path === '/create' ? <CreateCampaign />
          : detailId !== null ? <CampaignDetail key={`${detailId}:${app.account}`} id={detailId} />
            : ['/mine', '/contributions', '/favorites'].includes(path) ? <AccountCampaigns key={`${path}:${app.account}`} mode={path.slice(1)} />
              : path === '/admin' ? <Admin key={`${app.account}:${app.authenticated}:${app.isAdmin}:${app.isReviewer}`} />
                : <section className="empty-state"><h1 className="page-title">Không tìm thấy trang</h1><a href="#/">Về khám phá</a></section>}
    </main>
    <footer><span>Chung Tay · Crowdfunding DApp</span><div className="footer-links"><span>Ethereum Sepolia · ETH thử nghiệm</span><a href="#/admin">Quản trị nội dung</a></div></footer>
    <TransactionDialog />
  </div>
}
export default function App({ adapter = integrationAdapter }) { return <AppProvider adapter={adapter}><Site /></AppProvider> }
