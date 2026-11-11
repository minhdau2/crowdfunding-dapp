# Bàn giao phần tích hợp của Lý Hiền

Ngày lập: 11/11/2026. Múi giờ hướng dẫn: Việt Nam (UTC+7).

## Mã nguồn và trạng thái

- Nhánh: `feat/ly-hien-v3-content-integration`.
- Commit mã nguồn: `f5832a94e72dbc49e78e6d2d28644214893d7635` (`feat: integrate V3 wallet flow and authenticated content APIs`). Commit gồm phần kết nối V3 đã làm trong các lượt trước và API nội dung mới.
- Hồ sơ bằng chứng: [sepolia-2026-11-11T05-41-58.273Z.json](evidence/sepolia-2026-11-11T05-41-58.273Z.json). Thu thập lúc 12:41:58 ngày 11/11/2026, commit trên có working tree sạch khi thu thập; JSON ghi SHA-256 từng file nguồn, anchor block, receipt, log index và block hash.
- Đã commit cục bộ; chưa push GitHub hoặc mở PR. Hồ sơ bàn giao/bằng chứng được lưu trong commit tài liệu sau commit mã nguồn, không sửa mã nguồn đã gắn bằng chứng.
- Đã triển khai và kiểm thử API; **chưa kết luận toàn bộ checklist nghiệp vụ được nghiệm thu qua giao diện thực tế**.

## Phạm vi đã hoàn thành

| Phần | Hành vi hiện có |
| --- | --- |
| Ví và phiên | MetaMask, Sepolia, nonce/chữ ký, cookie HttpOnly, xóa phiên khi đổi ví/mạng, kiểm phiên/quyền định kỳ |
| Contract V3 | Kiểm code/version/hash/workflow và hash bytecode thực thi; đọc cùng block, đối chiếu proposal/decision/approval hash |
| Giao dịch | Tạo/duyệt/từ chối/góp/rút/hoàn, chờ receipt, ID từ event, lỗi sync không gửi lại tiền |
| Backend | ABI V3, RPC snapshot đã kiểm chứng, sync MongoDB có namespace chain/contract/ID và block hash |
| Bình luận | Đăng nhập mới ghi; tác giả tự xóa; admin xóa có lý do/audit; dữ liệu lưu MongoDB |
| Yêu thích | Riêng từng phiên ví, set trạng thái idempotent và danh sách sau tải lại |
| Ảnh/chủ đề | Chỉ chủ on-chain cập nhật; kiểm MIME/nội dung/giới hạn, chuyển WebP, lưu byte MongoDB; URL cùng origin; có form lưu lại nếu sync sau tạo lỗi |
| Báo cáo | Người đăng nhập gửi, chống trùng theo ví/chiến dịch, giới hạn tần suất |
| Quản trị | Danh sách nội dung/bình luận/báo cáo/audit; ẩn/hiện/xóa mềm/xử lý có lý do; thay đổi và audit cùng transaction |
| Phân quyền | Admin nội dung trong MongoDB, kiểm lại mỗi request, độc lập reviewer; client không tự khai quyền |

Ví admin nội dung đã được cấp theo lựa chọn của người dùng:

`0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7` (Nhật Minh).

Ví Lý Hiền: `0x87bDD48964EE07b1c22CD3436D9B1bf4e5e57ca1`.

## Deployment đã kiểm chứng

| Mục | Giá trị |
| --- | --- |
| Mạng / Chain ID | Ethereum Sepolia / 11155111 |
| Contract | `0x407145f033F6e19F21e5118ffCA15f0B3644cD55` |
| Deploy transaction | [0x2d9c5ad3…](https://sepolia.etherscan.io/tx/0x2d9c5ad35ba5b72731cef0884f0410bd37e475b1e0b3c704c9a163b5b2a27b0d) |
| Receipt / block | status 1 / 12109136 |
| initialReviewer | `0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7`, đọc từ constructor argument của giao dịch tạo trực tiếp |
| Reviewer tại snapshot | Cùng địa chỉ Nhật Minh ở trên |
| Version / Hash / Workflow | 3 / 2 / review-v1 |
| ABI | frontend/src/contracts/CrowdfundingV3.json |
| Runtime đã đối chiếu | Source hiện tại, Solidity 0.8.34, EVM cancun, Via IR tắt, **optimizer tắt**; phần thực thi khớp sau bỏ metadata |
| Hash phần thực thi | `0x73d3c75377d5dd3f735d867834a45c789ddbb8c9e865d866890fc2dd18732da8` |

Hồ sơ build lịch sử ghi optimizer bật 200 runs; không coi đó là cấu hình deployment thực tế. Không sửa hồi tố hồ sơ build thành receipt. Metadata compiler đầy đủ chưa đối chiếu tương đương. Bộ 49 test Solidity trước đây chạy optimizer bật, chưa chạy lại với optimizer tắt.

## Bằng chứng giao dịch nghiệp vụ

Snapshot anchor: block **12109737**, hash `0x057e3c5ea0ea04f1f39917d38b403d8fdef8748db3453eaf9492da837eced6f2`. RPC trả finalized block 12109667; các giao dịch trong bảng dưới nằm trước mốc này. Các dữ liệu là kết quả tại thời điểm thu thập, không khẳng định trạng thái hiện tại mãi không đổi.

| Chiến dịch / hành động | Giao dịch thành công | Block |
| --- | --- | --- |
| ID 1 – gửi đề xuất | [0xf5d6de64…](https://sepolia.etherscan.io/tx/0xf5d6de64cda1cdd8ff3ad121c4d03bbc5ce936b223ec2ea4a0e62d8f614457cd) | 12109154 |
| ID 1 – Nhật Minh duyệt | [0x6f8868e8…](https://sepolia.etherscan.io/tx/0x6f8868e85b54b65a7583792e0d2c4e6a97b53f61301595e6a952b04227b58874) | 12109181 |
| ID 2 – Lý Hiền gửi “Mang sách đến vùng cao” | [0xa9b0a411…](https://sepolia.etherscan.io/tx/0xa9b0a4113843d096f451b15b7dceceabe207781bff57c918c261535949bb4057) | 12109559 |
| ID 2 – Nhật Minh duyệt | [0x7fec3e33…](https://sepolia.etherscan.io/tx/0x7fec3e337c4387111447cfab732d2ad499fa0e11af5d8666fe6064951d6009f4) | 12109604 |
| ID 2 – Lý Hiền góp 0,0001 ETH | [0xec3eed7e…](https://sepolia.etherscan.io/tx/0xec3eed7eaad37445279525ad47042e45be391615a3ccfd9eaabd965c4590d9fc) | 12109617 |

ID 2 có mục tiêu 0,001 ETH, tổng góp 0,0001 ETH tại snapshot, trạng thái approved. PaymentReceipt ID 1 thuộc khoản góp này có digest đã tính lại và khớp getter receiptHash. Đề xuất và quyết định của cả hai chiến dịch có hash đã đối chiếu. Agent chỉ đọc các giao dịch có sẵn, không giữ khóa hoặc tự ký thay người dùng.

Hạn chót theo snapshot:

- ID 1: **10:48:24 ngày 12/11/2026** (Việt Nam).
- ID 2: **12:14:36 ngày 12/11/2026** (Việt Nam).

## Kết quả kiểm tra tích hợp

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend `npm.cmd test` | 24 đạt, 0 lỗi |
| Frontend `npm.cmd run build` | Đạt; có cảnh báo bundle lớn hơn 500 KB |
| Frontend `npm.cmd run lint` | Đạt |
| Backend `npm.cmd run test:integration` | 6 đạt, 0 lỗi, 0 bỏ qua; MongoDB thật, collection thử riêng đã dọn |
| Đăng nhập | Từ chối origin lạ, chữ ký sai, nonce lặp/hết hạn; logout hủy cookie |
| Phân quyền nội dung | Chặn chưa đăng nhập, giả account body, xóa bình luận người khác, ảnh khác chiến dịch, ví không phải chủ/admin |
| Quản trị | Thu hồi admin tác động phiên cũ; audit lỗi làm rollback thay đổi; các action có actor/reason/time/target |
| Ảnh | Từ chối file giả và MIME sai; chuyển WebP, thu nhỏ, bỏ metadata; ảnh chỉ công khai sau gắn đúng chiến dịch |
| API server thật | health/deployment/campaigns/social trả 200; admin không có phiên trả 401; role Nhật Minh có trong DB |

Kiểm thử API nội dung dùng ví ngẫu nhiên và fixture đọc contract để cô lập quyền nội dung; kiểm tra Sepolia thật là bước riêng trong evidence JSON. Đây không phải bằng chứng đã bấm toàn bộ màn hình bằng MetaMask.

## Còn thiếu / chưa đạt nghiệm thu

| Mục | Trạng thái và việc cần làm |
| --- | --- |
| Từ chối chiến dịch | Chưa thấy CampaignRejected trong lịch sử deployment đã thu thập. Tạo đề xuất riêng, Nhật Minh từ chối và ghi hash/lý do hiển thị |
| Rút sau hạn | Chưa thấy FundsWithdrawn. Chuẩn bị chiến dịch đủ vốn, chờ đúng hạn, chủ rút một lần và thử rút lại bị chặn |
| Hoàn sau hạn | Chưa thấy RefundClaimed. Với chiến dịch thiếu vốn sau hạn, từng ví tự hoàn một lần; kiểm số tiền và receipt |
| Nghiệm thu giao diện nội dung | API đã đạt kiểm thử tự động; cần thử thủ công thêm/xóa bình luận, yêu thích, ảnh/chủ đề, gửi/xử lý báo cáo và ẩn/hiện bằng hai ví trên web |
| Lỗi ví thực tế | Chưa có bằng chứng đầy đủ hủy ký, thiếu gas, đổi ví/mạng lúc đang ký, mất RPC/sync sau receipt và không gửi lặp |
| Bộ Solidity đúng cấu hình deploy | 49 test lịch sử chưa chạy lại với optimizer tắt; phối hợp Nhật Minh chạy trong Remix |
| Vận hành production | Session/rate limit RAM, một backend; chưa có phân trang/indexer liên tục, lưu trữ chia sẻ phiên, backup/khôi phục và kiểm thử tải |
| Audit bất biến | Transaction bảo đảm state và audit cùng commit; DB operator vẫn sửa được DB. Chưa có log bất biến bên ngoài |
| Lịch sử người góp trên UI | Không nằm trong hai phần vừa yêu cầu; chưa có danh sách tất cả người góp trên trang chi tiết |

## Hướng dẫn nhận bàn giao

1. Nhận nhánh/commit trên; `npm.cmd ci` ở backend và frontend theo lockfile.
2. Backend `.env`: MONGODB_URI, MONGODB_DB, SEPOLIA_RPC_URL, CROWDFUNDING_ADDRESS, APP_ORIGIN, PORT. Chỉ chia sẻ tên biến; không commit URI/key. Mẫu: backend/.env.example.
3. Chạy backend và frontend bằng `npm.cmd run dev` trong hai terminal. Chi tiết: [cách chạy](run-v3-integration.md).
4. Nhật Minh ký đăng nhập lại, mở Quản trị nội dung. Với database khác, người vận hành chạy lệnh cấp admin trong [API nội dung](content-api.md), không tự suy reviewer thành admin.
5. Thực hiện các ca còn thiếu và ghi ID/hash/kết quả hiển thị; cập nhật bằng chứng bằng `npm.cmd run evidence` ở backend. Script đọc deployment từ block tạo đến anchor, không tạo giao dịch mới.
6. Push nhánh và mở PR khi nhóm muốn chia sẻ; chưa tự push trong lần bàn giao này.
