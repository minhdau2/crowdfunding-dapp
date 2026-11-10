import { useApp } from '../lib/useApp'
export default function WalletGate() {
  const app = useApp()
  if (!app.account) return <div className="inline-callout"><strong>Kết nối ví để tiếp tục.</strong><p>Dùng cùng một ví để góp vốn và quản lý chiến dịch của bạn.</p><a className="secondary-button" href="#/login">Kết nối ví / Đăng nhập</a></div>
  if (app.wrongNetwork) return <div className="inline-callout" role="alert">Hãy chuyển ví sang Ethereum Sepolia trước khi thực hiện.</div>
  if (!app.authenticated) return <div className="inline-callout"><strong>Ví đã kết nối, bạn chưa đăng nhập.</strong><p>Ký thông điệp để xác thực tài khoản. Đăng nhập không chuyển ETH.</p><a className="secondary-button" href="#/login">Đăng nhập bằng ví</a></div>
  return null
}
