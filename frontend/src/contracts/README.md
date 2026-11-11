# ABI và helper hash V3

CrowdfundingV3.json là mảng ABI xuất từ source blockchain/contracts/Crowdfunding.sol V3, compiler 0.8.34+commit.80d5c536, EVM cancun, optimizer enabled 200 runs, Via IR off. Chưa có deployment V3 trong lần bàn giao này. ABI không chứa địa chỉ.

V3 có constructor initialReviewer, dùng submitCampaign thay createCampaign và CampaignSubmitted thay CampaignCreated. getCampaign nối thêm trường duyệt; getCampaignStatus có thêm Pending/Rejected. Hash schema version 2, campaignHash nay là alias proposalHash. Không dùng công thức hash V2 cho source V3.

financialHashes.js cung cấp proposalDigest/decisionDigest/receiptDigest bằng ethers v6, đã đối chiếu bytecode production cục bộ. Các hàm chỉ tính hash, không xác minh RPC hoặc tạo phiên đăng nhập. Không tự gắn dữ liệu MongoDB là verified dựa trên việc helper trả hash.

ABI V3 không được dùng thay toàn bộ ABI cho contract cũ: các selector cũ có thể còn nhưng tuple và hash schema khác, createCampaign không tồn tại trên V3. Nếu cần đọc lịch sử cũ, giữ riêng ABI/địa chỉ theo từng phiên bản từ lịch sử Git. Địa chỉ V1 đã ghi nhận trong deployments không hỗ trợ luồng duyệt.

Đọc docs/contract-interface.md và docs/ly-hien-contract-handoff.md từ thư mục gốc repo. Không lưu private key, seed phrase hoặc cấu hình MongoDB vào frontend.

Crowdfunding.json bản V2 được giữ nguyên để backend hiện tại tiếp tục đọc deployment cũ. Lý Hiền đổi import sang CrowdfundingV3.json cùng lúc chuyển địa chỉ/API sang V3. Không thay ABI mới vào backend đang dùng địa chỉ cũ.
