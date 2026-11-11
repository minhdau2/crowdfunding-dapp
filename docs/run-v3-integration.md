# Chạy bản tích hợp V3

## Khởi động

Backend cần Node hỗ trợ `--env-file` và JSON import attributes (đã kiểm tra với Node 24). Cài dependencies cả frontend và backend bằng `npm.cmd ci`. Giữ nguyên backend/.env hiện có; mẫu tên biến nằm trong backend/.env.example. Không commit file bí mật.

Terminal 1:

```powershell
cd C:\BlockChain\crowdfunding-dapp\backend
npm.cmd run dev
```

Terminal 2:

```powershell
cd C:\BlockChain\crowdfunding-dapp\frontend
npm.cmd run dev
```

Mở http://localhost:5173 bằng Chrome có MetaMask. Dùng đúng localhost, không đổi sang 127.0.0.1 khi APP_ORIGIN vẫn là localhost. Vite chuyển tiếp /api đến backend, không cần đưa MongoDB hoặc RPC key vào frontend. Nếu đổi domain/cổng phải đổi APP_ORIGIN và khởi động lại backend. Production cần HTTPS; cookie tự thêm Secure khi APP_ORIGIN là HTTPS. Phiên/nonce lưu trong RAM, khởi động lại backend sẽ đăng xuất mọi phiên; chưa dành cho nhiều backend cùng lúc.

## Kiểm tra

- /api/health: MongoDB phản hồi.
- /api/deployment: kiểm tra RPC đúng Sepolia, có code, CONTRACT_VERSION=3, HASH_VERSION=2, workflow review-v1; đọc reviewer hiện tại.
- /api/campaigns: dữ liệu đọc trực tiếp cùng block, đối chiếu proposal/decision/campaign/approval hash; không dùng MongoDB làm nguồn số tiền.
- Bấm Kết nối ví, chọn Sepolia, rồi ký đăng nhập. Chữ ký đăng nhập không chuyển tiền; nonce ngẫu nhiên dùng một lần, hết hạn 5 phút; phiên 1 giờ, cookie HttpOnly/SameSite. Không lưu token trong localStorage.
- Lý Hiền dùng ví 0x87bDD48964EE07b1c22CD3436D9B1bf4e5e57ca1 tạo đề xuất; Nhật Minh dùng reviewer hiện tại để duyệt trong mục quản trị. Vai trò luôn đọc từ chain, không cố định theo hai địa chỉ này.
- Khi đổi ví/mạng, phiên bị vô hiệu và phải đăng nhập lại. Quyền reviewer/phiên được làm mới định kỳ và kiểm tra trước giao dịch.
- Mỗi thao tác ghi trả TransactionResponse cho giao diện chờ receipt. Sau tạo, lấy ID từ CampaignSubmitted; sync thất bại sau receipt không gửi lại giao dịch.
- Bình luận/yêu thích/ảnh/báo cáo/quản trị nội dung đã nối API MongoDB; xem [API và checklist](content-api.md). Quyền admin nội dung của Nhật Minh được cấp riêng trong database; reviewer vẫn đọc từ contract.

## Phạm vi đã kiểm tra

Ngày 11/11/2026 đã đọc RPC thật: đúng phiên bản V3/hash2/review-v1, reviewer 0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7; chiến dịch 1 đã approved và hash khớp, khoản góp ví Lý Hiền bằng 0 ở block 12109501. Đây là snapshot, không phải trạng thái vĩnh viễn.

Giao dịch deploy được kiểm lại qua RPC: 0x2d9c5ad35ba5b72731cef0884f0410bd37e475b1e0b3c704c9a163b5b2a27b0d, status 1, block 12109136, contractAddress khớp. Source hiện tại đã compile lại bằng Solidity 0.8.34/cancun/Via IR tắt và **optimizer TẮT**: bytecode thực thi khớp deployment sau khi bỏ metadata Solidity. Runtime gồm metadata dài 15791 byte. Hash phần thực thi: 0x73d3c75377d5dd3f735d867834a45c789ddbb8c9e865d866890fc2dd18732da8. Adapter/backend kiểm tra hash này trước khi đọc/ghi.

Điểm khác hồ sơ build cũ: review-v1.build.json ghi optimizer bật 200 runs (8931 byte), không khớp bản deploy thực tế. Không sửa hồ sơ build cũ để giả thành receipt deployment. Metadata đầy đủ không khớp bản compile lại; chưa kết luận cùng metadata/path. initialReviewer đã được đọc lại từ input giao dịch deploy trong [hồ sơ mới](ly-hien-integration-handoff.md). Bộ 49 test cũ chạy với optimizer bật, chưa chạy lại bộ Solidity cho cấu hình optimizer tắt.

Agent không tự ký giao dịch MetaMask. Hồ sơ mới đã ghi nhận giao dịch tạo/duyệt/góp của người dùng qua RPC; còn cần nghiệm thu từ chối/rút/hoàn và giao diện nội dung. Script evidence xuất lịch sử receipt/log với block hash; chưa có indexer liên tục xử lý reorg. Danh sách hiện tải toàn bộ theo lô nhỏ, phù hợp demo ít chiến dịch; quy mô lớn cần phân trang/indexer.

## Kiểm thử

```powershell
cd C:\BlockChain\crowdfunding-dapp\frontend
npm.cmd test
npm.cmd run build
npm.cmd run lint
cd ..\backend
npm.cmd test
npm.cmd run test:integration
```

Các bài kiểm thử đăng nhập dùng ví ngẫu nhiên và server cục bộ; không chuyển ETH. Build có cảnh báo kích thước bundle ethers, không chặn chạy.
