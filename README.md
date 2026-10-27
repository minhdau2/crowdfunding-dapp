# Crowdfunding DApp

Đồ án nhóm ba người dùng **Remix Desktop** cho smart contract và **React + Vite + ethers v6** cho giao diện. GitHub quản lý mã nguồn và Pull Request.

## Trạng thái hiện tại

- Frontend đang là giao diện React mẫu, đã cài ethers để tích hợp ví sau này.
- Chưa có `Crowdfunding.sol` và chưa có bộ test nghiệp vụ gọi vốn.
- Thư mục `blockchain` là workspace Solidity mở trực tiếp bằng Remix Desktop, không cần npm install ở thư mục này.

## Phân công

| Thành viên | Công việc |
| --- | --- |
| Nhật Minh | Điều phối GitHub, viết contract và quy tắc tạo/góp/rút/hoàn vốn |
| Bé Ba | Danh sách, form tạo và trang chi tiết chiến dịch |
| Lý Hiền | Kết nối ví bằng ethers, bàn giao ABI/địa chỉ triển khai và tích hợp giao diện |

## Cấu trúc

```text
blockchain/
  contracts/          Mã Solidity của nhóm
  tests/              Bài kiểm thử chạy bằng plugin Solidity Unit Testing
  deployments/        Ghi nhận mạng và địa chỉ triển khai
  README.md           Cách mở, biên dịch và triển khai trong Remix Desktop
frontend/
  src/contracts/      ABI dùng cho giao diện
docs/
  remix-desktop.md    Quy trình làm việc và bàn giao giữa các thành viên
```

## Bắt đầu

1. Cài [Remix Desktop](https://remix.live/desktop) bản Windows.
2. Trong Remix Desktop, mở thư mục `blockchain` của bản clone này, không tạo bản sao mã nguồn ở nơi khác.
3. Đọc [hướng dẫn blockchain](blockchain/README.md) và [quy trình nhóm](docs/remix-desktop.md).
4. Chạy frontend trong terminal riêng:

```powershell
cd E:\BlockChain\crowdfunding-dapp\frontend
npm ci
npm run dev
```

Hai bạn còn lại thay đường dẫn bằng vị trí clone trên máy mình. Thư mục gốc và `blockchain` không có npm package; các lệnh npm chạy ở `frontend`.

## Chọn mạng cho đúng mục đích

- **Thử contract trong Remix:** dùng Remix VM, có tài khoản và ETH mô phỏng để bấm thử các hàm. Khi có test, chạy bằng plugin Solidity Unit Testing.
- **Tích hợp React và MetaMask:** triển khai từ Remix Desktop qua ví lên một testnet EVM đang được nhóm sử dụng, hoặc lên node local có RPC riêng nếu nhóm thiết lập sau. Remix VM không tự cung cấp RPC cho ứng dụng React bên ngoài. Không lấy địa chỉ contract trên Remix VM để nhập vào cấu hình frontend của một mạng khác.
- Chỉ dùng ETH thử nghiệm. Không lưu seed phrase hoặc private key trong repository hay mã frontend.

## Làm việc với GitHub

Mỗi người tạo nhánh theo nhiệm vụ, commit phần mình và mở Pull Request về `main`. Chỉ merge sau khi một bạn khác review. ABI và địa chỉ contract phải khớp cùng một phiên bản và cùng mạng. Git chỉ chia sẻ mã nguồn, không tự chia sẻ trạng thái Remix VM giữa các máy.

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/ten-thanh-vien-ten-cong-viec
```

Trước khi đổi nhánh, commit hoặc cất các thay đổi đang làm. Không commit file `.env`, khóa ví hoặc thư mục `node_modules`.

## Kiểm tra frontend

```powershell
cd frontend
npm run build
npm run lint
```

Contract được biên dịch và kiểm thử trong Remix Desktop. Build frontend thành công chưa chứng minh logic smart contract đã đúng.
