import { useEffect, useState } from 'react'
import CampaignList from './pages/CampaignList'
import CreateCampaign from './pages/CreateCampaign'
import CampaignDetail from './pages/CampaignDetail'
import AccountCampaigns from './pages/AccountCampaigns'
import TransactionDialog from './components/TransactionDialog'
import { DemoProvider } from './lib/DemoContext'
import { useDemo } from './lib/useDemo'
import { DEMO_ACCOUNTS, shortAddress } from './lib/demoModel'
import './App.css'

function Site() {
  const [route, setRoute] = useState(window.location.hash || '#/')
  const [menuOpen, setMenuOpen] = useState(false)
  const demo = useDemo()
  useEffect(() => {
    const update = () => { setRoute(window.location.hash || '#/'); setMenuOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const path = route.replace(/^#/, '').split('?')[0]
  const detailId = /^\/campaign\/\d+$/.test(path) ? Number(path.split('/')[2]) : null
  const links = [['/', 'Khám phá'], ['/create', 'Tạo chiến dịch'], ['/mine', 'Chiến dịch của tôi'], ['/contributions', 'Khoản đã góp']]
  async function copyAddress() {
    try { await navigator.clipboard.writeText(demo.account); demo.setNotice('Đã sao chép địa chỉ ví mẫu.') }
    catch { demo.setNotice(`Không sao chép tự động được. Địa chỉ ví: ${demo.account}`) }
  }
  return <div className="app">
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header className="site-header">
      <a className="brand" href="#/"><span aria-hidden="true">C</span> Chung Tay</a>
      <button className="mobile-menu secondary-button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      <nav id="main-nav" className={menuOpen ? 'nav open' : 'nav'} aria-label="Điều hướng chính">{links.map(([href, label]) => <a href={`#${href}`} key={href} aria-current={path === href ? 'page' : undefined}>{label}</a>)}</nav>
      {!demo.account ? <button className="primary-button" onClick={demo.connect}>Kết nối ví mẫu</button> : <details className="account-menu"><summary>{shortAddress(demo.account)} <span aria-hidden="true">⌄</span></summary><div className="account-dropdown">
        <p>Ví mẫu · {demo.authenticated ? 'Đã đăng nhập mô phỏng' : 'Chưa đăng nhập'}</p>
        {!demo.authenticated && <button onClick={demo.login}>Ký để đăng nhập (mẫu)</button>}
        <button onClick={copyAddress}>Sao chép địa chỉ</button><a href="#/favorites">Đã yêu thích</a><button onClick={demo.logout}>Đăng xuất / ngắt ví mẫu</button>
      </div></details>}
    </header>
    <aside className="demo-notice"><strong>CHẾ ĐỘ MÔ PHỎNG</strong> · Không kết nối MetaMask, không chuyển ETH và không upload lên server. Dữ liệu chỉ lưu trên trình duyệt này.
      <details className="demo-controls"><summary>Công cụ thử giao diện</summary><div className="demo-control-fields"><label htmlFor="demo-account">Ví mô phỏng<select id="demo-account" value={demo.account} onChange={(event) => demo.switchAccount(event.target.value)}><option value="">Chưa kết nối</option>{DEMO_ACCOUNTS.map((address, index) => <option value={address} key={address}>Ví {index === 0 ? 'A' : 'B'} · {shortAddress(address)}</option>)}</select></label><label htmlFor="demo-network">Mạng mô phỏng<select id="demo-network" value={demo.wrongNetwork ? 'wrong' : 'sepolia'} onChange={(event) => demo.setWrongNetwork(event.target.value === 'wrong')}><option value="sepolia">Sepolia · 11155111</option><option value="wrong">Sai mạng (để thử lỗi)</option></select></label><p>Ví A có sẵn chiến dịch để rút và khoản góp để hoàn. Chọn kết quả thành công / từ chối / lỗi trong hộp xác nhận.</p><button className="secondary-button" onClick={demo.resetDemo}>Khôi phục dữ liệu mẫu</button></div></details>
    </aside>
    {demo.wrongNetwork && <div className="network-warning" role="alert">Đang chọn sai mạng mô phỏng. <button onClick={() => demo.setWrongNetwork(false)}>Chuyển về Sepolia mẫu</button></div>}
    {demo.storageWarning && <p className="network-warning" role="alert">{demo.storageWarning}</p>}
    {demo.notice && <div className="notice" role="status"><span>{demo.notice}</span><button aria-label="Đóng thông báo" onClick={() => demo.setNotice('')}>×</button></div>}
    <main id="main-content" tabIndex="-1">
      {path === '/' ? <><section className="hero"><p className="eyebrow">GỌI VỐN CỘNG ĐỒNG</p><h1>Ý tưởng nhỏ.<br />Thay đổi lớn.</h1><p className="hero-description">Khám phá những dự án ý nghĩa và cùng nhau tạo nên giá trị cho cộng đồng.</p><a className="primary-link" href="#/create">Bắt đầu một chiến dịch <span aria-hidden="true">↗</span></a></section><CampaignList /></> : path === '/create' ? <CreateCampaign /> : detailId !== null ? <CampaignDetail key={detailId} id={detailId} /> : ['/mine', '/contributions', '/favorites'].includes(path) ? <AccountCampaigns key={path} mode={path.slice(1)} /> : <section className="empty-state"><h1>Không tìm thấy trang</h1><a href="#/">Về khám phá chiến dịch</a></section>}
    </main>
    <footer><span>Chung Tay · Đồ án Crowdfunding DApp</span><span>Giao diện thử nghiệm · ETH mô phỏng</span></footer>
    <TransactionDialog />
  </div>
}

export default function App() { return <DemoProvider><Site /></DemoProvider> }
