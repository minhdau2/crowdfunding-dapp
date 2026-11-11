# Bàn giao contract V3 cho Lý Hiền

> Tài liệu bàn giao contract gốc, giữ lại để đối chiếu. Sau tích hợp đã có RPC/receipt/bytecode verification và API V3; xem [cách chạy mới](run-v3-integration.md), [API nội dung](content-api.md) và hồ sơ nghiệm thu mới trong docs/evidence.

Ngày cập nhật: 11/11/2026. Người bàn giao: Nhật Minh. Người tiếp nhận tích hợp: Lý Hiền. Giao diện do Kim Ba phụ trách.

Nhật Minh đã hoàn thiện source duyệt on-chain, ABI, kiểm thử và cấu trúc hash; bổ sung chú thích tiếng Việt trong hợp đồng. Người triển khai báo đã deploy bản mới và cung cấp kết quả đọc `getCampaign(1)` từ Remix ở địa chỉ bên dưới. Chưa có transaction hash deploy hoặc xác minh RPC độc lập trong lần cập nhật tài liệu này. Lý Hiền cần xác minh deployment trước khi mở adapter thật.

## Thông tin deployment tiếp nhận

| Mục | Thông tin |
| --- | --- |
| Mạng dự kiến | Ethereum Sepolia |
| Chain ID phải kiểm tra | `11155111` |
| Địa chỉ contract mới người triển khai cung cấp | `0x407145f033F6e19F21e5118ffCA15f0B3644cD55` |
| Transaction hash deploy | Chưa được cung cấp; bổ sung từ lịch sử deploy của ví/Remix |
| Ví reviewer | Chưa xác nhận; đọc `reviewer()` trực tiếp, không suy từ ví tạo chiến dịch |
| ABI cần dùng | `frontend/src/contracts/CrowdfundingV3.json` |
| Phiên bản cần đọc lại | `CONTRACT_VERSION() = 3`, `HASH_VERSION() = 2`, `CAMPAIGN_WORKFLOW() = review-v1` |

Thông tin chiến dịch thử đã đọc được từ Remix: ID `1`, chủ `0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7`, tên “Chiến dịch thử nghiệm”, mục tiêu `10000000000000000` wei (0,01 ETH), thời lượng `86400` giây (1 ngày). Ở lần đọc được gửi trong chat: `approvalStatus = 0`, `deadline = 0`, `totalRaised = 0`, tức đang chờ duyệt. Chưa có bằng chứng giao dịch duyệt/góp vốn tiếp theo; đọc lại trạng thái hiện tại trước khi thử, không coi giá trị này là trạng thái mới nhất.

Không sử dụng lại địa chỉ deployment V1/V2. ID `1` chỉ xác định một chiến dịch khi đi kèm mạng và địa chỉ contract.

## Nhận đúng bộ file

- blockchain/contracts/Crowdfunding.sol: source chính, constructor initialReviewer.
- blockchain/tests/: 8 suite, 49 test đã chạy đạt, cấu hình và bằng chứng trong README/results-review-v1.json.
- frontend/src/contracts/CrowdfundingV3.json: ABI V3 vừa xuất, tuple mới 15 trường.
- frontend/src/contracts/financialHashes.js: helper ethers mã hóa thuần cho hash schema 2.
- docs/contract-interface.md: hàm, enum, event, errors, tuple và hash schema chính thức.
- blockchain/deployments/review-v1.build.json: dấu vết build; không phải receipt deploy.

## Xác minh deployment đã nhận

1. Kết nối RPC Sepolia, kiểm chain ID `11155111` và `getCode` tại địa chỉ tiếp nhận phải khác `0x`.
2. Đọc ba getter phiên bản và `reviewer()`; đối chiếu đúng phiên bản/quyền đã thống nhất. Reviewer có thể khác ví deploy và ví chủ chiến dịch.
3. Nhận transaction hash deploy từ Nhật Minh; kiểm receipt thành công, contractAddress trùng địa chỉ tiếp nhận, lấy block/thời điểm deploy và constructor reviewer. Ghi thông tin thực tế vào một hồ sơ deployment riêng.
4. Đối chiếu source/build với bytecode thực tế. Cấu hình build đã kiểm thử: Solidity `0.8.34+commit.80d5c536`, EVM `cancun`, optimizer bật `200` runs, Via IR tắt. Chú thích/path/settings ảnh hưởng metadata; không tuyên bố bytecode khớp nếu chưa kiểm tra. `review-v1.build.json` vẫn là hồ sơ build, không phải bằng chứng deploy.
5. Khi xác minh đạt, cập nhật `CROWDFUNDING_ADDRESS` trong `backend/.env` và cấu hình adapter frontend, đồng thời đổi import sang ABI V3; khởi động lại tiến trình. Dữ liệu MongoDB phải có chain ID + địa chỉ contract + ID, không lẫn deployment cũ.

## Công việc Lý Hiền cần làm theo thứ tự

1. **Nhận source từ Git:** lấy nhánh/commit Nhật Minh đã push, cài dependencies theo lockfile trong frontend/backend. Không tạo dự án Hardhat; hợp đồng dùng Remix Desktop. Không commit `.env`, URI MongoDB chứa mật khẩu, private key hoặc seed phrase. Nếu source chưa push, Nhật Minh phải hoàn tất bước Git trước khi bạn pull.
2. **Cấu hình dịch vụ:** backend dùng MongoDB Atlas và RPC Sepolia; URI MongoDB chỉ ở backend. Frontend gọi API backend và dùng MetaMask ký giao dịch. Không đưa tài khoản/mật khẩu database vào biến `VITE_*` hoặc mã trình duyệt.
3. **Xác minh contract và đổi ABI:** thực hiện checklist deployment phía trên. Backend hiện dùng ABI V2, nên chỉ thay địa chỉ trong `.env` là chưa đủ.
4. **Kết nối ví và đăng nhập:** nối adapter trong `frontend/src/lib/integrationAdapter.js`; xin kết nối ví khi người dùng bấm nút. Đăng nhập bằng nonce do backend cấp và chữ ký ví, kiểm nonce dùng một lần/hạn sử dụng, domain/URI và địa chỉ ký; tạo session backend. Kết nối ví đơn thuần chưa phải đăng nhập. Khi đổi ví/mạng hoặc đăng xuất, xóa dữ liệu phiên cũ và tải lại quyền.
5. **Đọc và hiển thị dữ liệu:** bổ sung backend sync V3 và adapter đọc; trình bày từng trường bằng nhãn tiếng Việt, ETH từ wei, ngày giờ từ Unix giây. Đọc tiền/trạng thái từ blockchain, không lấy bản MongoDB chưa đối chiếu làm dữ liệu đã xác minh.
6. **Nối luồng tạo và duyệt:** `submitCampaign` → chờ receipt → lấy ID từ event `CampaignSubmitted` → sync → hiện “Chờ duyệt”; reviewer duyệt/từ chối → chờ receipt → sync và tải lại. Chiến dịch chỉ mở góp sau khi duyệt; danh sách công khai chỉ hiển thị chiến dịch đã duyệt.
7. **Nối thanh toán:** góp vốn, chủ rút và người góp hoàn tiền qua signer MetaMask. Chỉ báo thành công sau receipt thành công; nếu sync lỗi sau khi giao dịch đã thành công thì cho thử đồng bộ lại, không tự gửi lại tiền.
8. **Hoàn thiện dữ liệu ngoài chuỗi:** nối bình luận, yêu thích, ảnh, báo cáo, quản trị nội dung theo khả năng API đã triển khai. Quyền admin backend cần được xác thực riêng; không tự suy thành quyền reviewer. Chưa có API thì hiển thị chưa khả dụng.
9. **Kiểm thử và bàn giao lại:** chạy checklist nghiệm thu bên dưới; ghi commit, cấu hình không chứa bí mật, cách chạy và các tình huống chưa đạt. Phối hợp Kim Ba nếu cần sửa phần trình bày.

Hiện frontend đã có các màn hình và cổng adapter, nhưng adapter mặc định chưa nối dịch vụ thật. Backend đã có đồng bộ chiến dịch phiên bản cũ; chưa hoàn tất đăng nhập bằng chữ ký, phân quyền backend, đồng bộ V3 và các API nội dung. Không coi các phần này là đã triển khai chỉ vì giao diện đã có nút.

## Map adapter với contract

| Adapter frontend | Lệnh thực tế |
| --- | --- |
| create({values}) | submitCampaign(title,description,parseEther(goalEth),BigInt(durationDays)*86400n) |
| approve({id}) | approveCampaign(id), signer là reviewer |
| reject({id,reason}) | rejectCampaign(id,reason), signer là reviewer |
| contribute({id,amount}) | contribute(id,{value:parseEther(amount)}) |
| withdraw({id}) / refund({id}) | withdraw(id) / refund(id) |
| session.isReviewer | isReviewer(account) đọc trực tiếp on-chain; không lấy từ role admin MongoDB |

Các hàm ghi trả TransactionResponse có hash/wait(), UI tự chờ receipt. afterTransaction lấy ID submit từ CampaignSubmitted, sync chain rồi refresh. Không còn CampaignCreated/createCampaign. Đừng nhầm getCampaignStatus (0–4) với approvalStatus (0–2). Pending/Rejected deadline 0 phải hiển thị chưa bắt đầu/không mở, không hiển thị 01/01/1970.

## Backend và dữ liệu

API sync hiện tại cần bổ sung durationSeconds, submittedAt, approvedAt, approvalStatus, rejectionReason, decidedBy, decidedAt, proposalHash, decisionHash và block hash. Các trường tài chính/trạng thái/hash phải đọc từ RPC cùng blockTag; không nhận kết quả duyệt/số tiền do client khai.

Đọc các getter, tính lại hash qua financialHashes.js rồi so với hash đọc trực tiếp. Hash tổng động không có: lấy totalRaised/totalRefunded/contributions/refunded trực tiếp cùng block. Lưu log/tx/block để xử lý reorg và tránh biên lai trùng. Phiên ví vẫn cần nonce/chữ ký/backend; contract reviewer role không thay cho đăng nhập web hoặc quyền ẩn/xóa nội dung.

Adapter loadCampaigns trả record như frontend-integration.md. approvalStatus map 0→pending, 1→approved, 2→rejected; durationSeconds/approvedAtSeconds/deadlineSeconds là chuỗi. Khi account có ví thì trả khoản góp/refund đúng ví; bao gồm Pending/Rejected của chủ trong mục cá nhân. loadPendingCampaigns phục vụ reviewer. Chỉ khai báo campaignWorkflow = review-v1 sau khi địa chỉ đã kiểm chứng thật. Không nối thẳng response MongoDB thô vào UI và tự gắn verified=true.

## Checklist nghiệm thu

Đánh dấu theo giao dịch/kết quả thực tế. Hiện đã nhận kết quả đọc chiến dịch thử đang chờ duyệt; các mục dưới chưa được xác nhận đầy đủ trên deployment mới.

- Chưa duyệt: gửi đề xuất → đọc Pending → contribute trực tiếp Remix và web đều bị chặn.
- Duyệt: ví ngoài không duyệt; đúng reviewer duyệt một lần → approvedAt/deadline chính xác → góp được.
- Từ chối: lý do hiển thị khớp chain, không góp/duyệt lại; chủ gửi đề xuất mới với ID mới.
- Đủ vốn: chờ hết hạn, đúng chủ rút một lần; reviewer không được rút thay. Thiếu vốn: từng ví hoàn đúng khoản một lần.
- Thử chuyển reviewer bằng hai bước, quyền cũ mất sau accept, hủy nominee trước accept; session cập nhật.
- Đổi ví/mạng, từ chối ký, thiếu gas, mất RPC và sync lỗi sau receipt không dẫn đến gửi lặp.
- Sửa dữ liệu MongoDB không làm thay số tiền/trạng thái duyệt hiển thị như đã xác minh.

Thời lượng production tối thiểu 1 ngày: chuẩn bị chiến dịch trước ngày demo, không thêm hàm bỏ qua hạn để demo. Build/test frontend không thay kiểm thử giao dịch Sepolia. Chưa mở tính năng khi các mục deploy/xác thực/đối chiếu còn thiếu.

Lịch sử kiểm thử source: 49 test Solidity trên local Remix Simulator đạt trước khi bổ sung chú thích tiếng Việt. Sau khi sửa chú thích, compile thành công, ABI và runtime thực thi (không tính metadata compiler) giống bản đã test; không chạy lại 49 test cho lần sửa chú thích. Chi tiết hash và phạm vi bằng chứng nằm trong `blockchain/tests/results-review-v1.json`.

## Kết quả cần gửi lại cho nhóm

- Nhánh/commit tích hợp; hướng dẫn chạy frontend/backend và danh sách tên biến môi trường (không gửi giá trị bí mật).
- Hồ sơ deployment đã xác minh: chain ID, địa chỉ, transaction hash deploy, block deploy, reviewer và ABI/source tương ứng.
- Bằng chứng luồng gửi → duyệt/từ chối → góp → rút/hoàn: ID chiến dịch, hash giao dịch và kết quả hiển thị/sync.
- Danh sách còn thiếu hoặc lỗi; đặc biệt hai kịch bản rút/hoàn sau hạn chót phải có trạng thái kiểm thử rõ ràng.

## Tương thích ABI backend cũ

Backend hiện nhập frontend/src/contracts/Crowdfunding.json (V2). File này được giữ nguyên; ABI V3 xuất riêng thành CrowdfundingV3.json. Khi dùng địa chỉ V3, phải đổi import backend/adapter sang file V3 và bổ sung mapping trạng thái. Không chỉ đổi .env rồi tiếp tục dùng ABI V2.
