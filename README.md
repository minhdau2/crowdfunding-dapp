# Crowdfunding DApp

Đồ án nhóm ba người dùng **Remix Desktop** cho smart contract và **React + Vite + ethers v6** cho giao diện. GitHub quản lý mã nguồn và Pull Request.

## Trạng thái hiện tại

Hồ sơ mới nhất: [bàn giao tích hợp Lý Hiền](docs/ly-hien-integration-handoff.md), gồm commit, bằng chứng Sepolia và checklist chưa nghiệm thu.

- Frontend đã nối MetaMask, đăng nhập chữ ký, giao dịch V3 và API bình luận/yêu thích/ảnh/báo cáo/quản trị nội dung. Xem [cách chạy bản tích hợp](docs/run-v3-integration.md) và [API nội dung](docs/content-api.md). Kiểm thử tự động không thay thế nghiệm thu MetaMask thực tế.
- Đã có `blockchain/contracts/Crowdfunding.sol`, ABI và 49 ca test Remix cho nghiệp vụ tạo/góp/rút/hoàn vốn. Kết quả chạy runner: 49 passed, 0 failed; xem [kiểm thử contract](blockchain/tests/README.md).
- Mạng tích hợp: **Ethereum Sepolia (11155111)**, V3 tại `0x407145f033F6e19F21e5118ffCA15f0B3644cD55`. Backend/frontend dùng ABI V3; bytecode thực thi đã đối chiếu source với optimizer **tắt**, khác cấu hình bộ 49 test cũ. Không dùng lại địa chỉ V1/V2.
- Thư mục `blockchain` là workspace Solidity mở trực tiếp bằng Remix Desktop, không cần npm install ở thư mục này.

Workflow: gửi đề xuất → reviewer duyệt/từ chối → góp → hết hạn → chủ rút hoặc người góp hoàn. Quyền quản trị nội dung backend được cấp riêng, không suy từ reviewer. [Bàn giao contract gốc](docs/ly-hien-contract-handoff.md) ghi trạng thái trước tích hợp; ưu tiên hướng dẫn chạy và hồ sơ nghiệm thu mới.

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
3. Đọc [hướng dẫn blockchain](blockchain/README.md), [giao diện contract](docs/contract-interface.md) và [quy trình nhóm](docs/remix-desktop.md).
4. Chạy frontend trong terminal riêng:

```powershell
cd E:\BlockChain\crowdfunding-dapp\frontend
npm ci
npm run dev
```

Hai bạn còn lại thay đường dẫn bằng vị trí clone trên máy mình. Thư mục gốc và `blockchain` không có npm package; các lệnh npm chạy ở `frontend`.

## Chọn mạng cho đúng mục đích

- **Thử contract trong Remix:** dùng Remix VM, có tài khoản và ETH mô phỏng để bấm thử các hàm. Chạy 8 file `_test.sol` bằng plugin Solidity Unit Testing. Compiler 0.8.34, EVM cancun, optimizer 200 runs.
- **Tích hợp React và MetaMask:** triển khai từ Remix Desktop qua ví lên **Ethereum Sepolia**, chain ID **11155111**. Remix VM không tự cung cấp RPC cho ứng dụng React bên ngoài. Không lấy địa chỉ contract trên Remix VM để nhập vào cấu hình frontend của một mạng khác.
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
npm test
npm run build
npm run lint
```

Contract được biên dịch và kiểm thử trong Remix Desktop. Build frontend thành công chưa chứng minh logic smart contract đã đúng.
