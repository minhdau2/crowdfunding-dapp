# Contract Crowdfunding V3 với duyệt on-chain

Mở thư mục `blockchain` bằng Remix Desktop. Source production là `contracts/Crowdfunding.sol`; không dùng bản sao nằm trong thư mục dự án lồng nhau. Không có npm project/Hardhat trong workspace này.

## Cấu hình biên dịch

| Mục | Giá trị |
| --- | --- |
| Compiler | 0.8.34+commit.80d5c536 |
| EVM target | cancun |
| Optimizer | Enabled, 200 runs |
| Via IR | Tắt |
| Contract deploy | Crowdfunding |
| Constructor | initialReviewer: địa chỉ ví thật sẽ được quyền duyệt, khác 0 |
| Mạng tích hợp | Ethereum Sepolia, chain ID 11155111 |
| Phiên bản | CONTRACT_VERSION 3, CAMPAIGN_WORKFLOW review-v1, HASH_VERSION 2 |

Source V3 đã compile và qua 49 ca Solidity trong runner Remix, chưa deploy lên Sepolia trong lần bàn giao này. ABI đã xuất lại từ source V3. Bản build được ghi tại `deployments/review-v1.build.json`; địa chỉ/source commit chưa có thì để null, không coi là bản ghi triển khai.

## Quy tắc

- submitCampaign gửi đề xuất không kèm ETH, mục tiêu > 0, thời lượng nguyên 1–90 ngày. Pending chưa nhận góp, chưa có deadline.
- approveCampaign chỉ reviewer, chỉ Pending; deadline bắt đầu tại thời điểm duyệt và không sửa sau đó. rejectCampaign chỉ Pending, có lý do công khai, không được duyệt lại đề xuất bị từ chối.
- Góp/rút/hoàn chỉ cho Approved. Trước deadline còn được góp, kể cả vượt mục tiêu. Sau hạn, đủ mục tiêu thì chủ rút một lần; thiếu vốn thì từng ví tự gọi refund một lần.
- Reviewer có thể tự duyệt đề xuất của mình, nhưng không có quyền lấy tiền của chủ khác. Chuyển quyền reviewer bằng đề nghị + ví mới chấp nhận; có thể hủy đề nghị chưa nhận.
- Không admin rút tiền, không phí, hủy Approved, sửa goal/duration/deadline hoặc tự chạy thanh toán theo đồng hồ.
- Giữ proposalHash lúc gửi, decisionHash khi duyệt/từ chối, receiptHash cho thanh toán. Hash dùng Keccak-256/abi.encode, không mã hóa thông tin và không thay kiểm tra quyền nghiệp vụ.

Đọc [đặc tả đầy đủ](../docs/contract-interface.md), [bàn giao Lý Hiền](../docs/ly-hien-contract-handoff.md) và [test](tests/README.md).

## Thử trong Remix

1. Compile với cấu hình trên. Deploy **Crowdfunding**, nhập initialReviewer là tài khoản mô phỏng A. Không deploy CrowdfundingHarness làm ứng dụng.
2. Dùng ví B submitCampaign với title/description, goal 10000000000000000 (0.01 ETH), durationSeconds 86400. Để Value 0. Xem ID từ CampaignSubmitted; getCampaign cho Pending, deadline 0.
3. Đổi ví C, thử contribute có Value phải bị từ chối trước khi duyệt. Đưa Value về 0 khi gọi hàm không payable.
4. Đổi ví A approveCampaign(id). getCampaign hiển thị Approved, approvedAt và deadline = approvedAt + 86400. Ví B/C thử góp; đọc PaymentReceipt và contributions.
5. Chưa hết hạn, owner không được rút. Dùng bộ test để thử các nhánh tại deadline; khi demo Sepolia phải chuẩn bị chiến dịch đã được duyệt ít nhất 1 ngày trước. Production không có cách rút ngắn thời gian để demo.
6. Gửi đề xuất khác và A rejectCampaign với lý do. getCampaignStatus = 4, deadline 0; góp/rút/hoàn đều bị chặn. Rejected không phải chiến dịch Unsuccessful.

## Deploy và bàn giao

Chọn initialReviewer cẩn thận; nó có thể khác ví deploy. Deploy V3 qua MetaMask trên Sepolia là bước do người dùng thực hiện, chưa được tự động làm. Lưu địa chỉ, tx hash, compiler settings, ví reviewer và source commit thật sau khi giao dịch thành công. Đổi source không cập nhật contract cũ; dữ liệu/tiền ở địa chỉ cũ không tự chuyển sang V3.

ABI V3 và hash schema V3 phải đi cùng đúng địa chỉ V3. Backend hiện chỉ có API sync cơ bản, chưa đồng bộ đầy đủ trạng thái duyệt/hash; Lý Hiền cần hoàn thiện adapter/API theo checklist trước khi mở chức năng. Không đưa khóa ví, seed phrase hoặc URI MongoDB vào Git.

Nguồn chính thức: [Remix Desktop](https://remix-ide.readthedocs.io/en/latest/desktop.html), [Solidity Unit Testing](https://remix-ide.readthedocs.io/en/latest/unittesting.html), [ABI Solidity](https://docs.soliditylang.org/en/v0.8.34/abi-spec.html).
