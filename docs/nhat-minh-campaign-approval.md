# Nhật Minh bổ sung duyệt chiến dịch trên contract

## Trạng thái ngày 2026-11-11

Đã thực hiện source V3, 49 ca test Solidity đạt và ABI V3 riêng; chưa deploy. Đặc tả chính thức: [contract-interface.md](contract-interface.md), checklist tích hợp: [ly-hien-contract-handoff.md](ly-hien-contract-handoff.md). Đã chốt thời lượng nguyên 1–90 ngày, một reviewer chuyển quyền hai bước và cho phép tự duyệt. Hash quyết định gắn proposalHash, trạng thái, reviewer, thời điểm, hạn chót và hash lý do; HASH_VERSION 2. Các đoạn bên dưới lưu yêu cầu ban đầu, không thay thế đặc tả đã thực hiện.

## Quyết định và phạm vi

Nhóm chọn duyệt có hiệu lực on-chain: chưa được duyệt thì contract không nhận góp, kể cả gọi trực tiếp từ Remix. Kim Ba chỉ chuẩn bị frontend. Tài liệu này là yêu cầu cho lần sửa tiếp theo của Nhật Minh, không xác nhận contract hiện tại đã có tính năng này. Không sửa hoặc deploy contract trong nhiệm vụ giao diện.

## Luồng cần triển khai

1. Chủ gửi đề xuất có title, description, goalWei và durationSeconds. Không nộp tiền lúc gửi. ID giữ nguyên trong suốt vòng đời đề xuất/chiến dịch.
2. Trạng thái ban đầu Pending. Chưa có thời điểm bắt đầu/hạn chót chính thức: approvedAt = 0, deadline = 0. Không được góp/rút/hoàn.
3. Ví được cấp quyền duyệt mới gọi approveCampaign(id). Chỉ chuyển từ Pending một lần. Ghi approvedAt = block.timestamp và deadline = approvedAt + durationSeconds; sau đó chiến dịch bắt đầu nhận góp.
4. rejectCampaign(id, reason) chỉ dùng khi Pending, bắt buộc có lý do. Chuyển sang Rejected, không nhận góp và không tính deadline. Muốn nộp lại thì tạo đề xuất mới.
5. Khi đã Approved, không duyệt/từ chối lại, không sửa goal/duration/deadline hoặc hủy tùy ý. Góp/rút/hoàn giữ điều kiện và bảo vệ hiện tại, nhưng tất cả phải xét trạng thái duyệt trước.

Frontend hiện đề xuất thời lượng nguyên từ **1 đến 90 ngày**, mặc định 7 ngày; một ngày = 86400 giây. Nhật Minh cần chốt giới hạn tương ứng trong contract và báo Lý Hiền/Kim Ba nếu khác. Thời gian chờ duyệt không tính vào thời lượng gọi vốn. Không cho góp khi rejected/pending ngay cả khi dữ liệu frontend bị sửa.

## Quyền duyệt

- Chốt ví/role người duyệt và cách cấp/chuyển quyền. Ghi rõ constructor/role management, chặn địa chỉ 0. Không tự dùng một địa chỉ ví giả trong source.
- Quyền nội dung trên backend và quyền duyệt on-chain là hai quyền riêng. API không có quyền biến Pending thành Approved thay blockchain; chỉ đồng bộ trạng thái đã xác nhận.
- Người duyệt không có quyền rút tiền thay chủ hoặc sửa khoản góp. Nếu muốn cấm tự duyệt chiến dịch do chính mình tạo, cần thống nhất và thêm test; đây chưa phải quy tắc nhóm đã chốt.
- Lý do từ chối trên chain sẽ công khai. Không chứa thông tin riêng tư. Nếu thay bằng reason hash/URI, cần đặc tả thêm nguồn chứng minh và cập nhật frontend/adapter; không đánh đồng dữ liệu MongoDB tự khai là trạng thái on-chain.

## Dữ liệu và API contract đề xuất

- ApprovalStatus: Pending, Approved, Rejected. Tách khỏi kết quả gọi vốn Active/Successful/Unsuccessful; Pending/Rejected không được hiểu là chiến dịch thất bại cần hoàn.
- Thêm durationSeconds, approvedAt, approvalStatus và rejectionReason; deadline chỉ được xác lập khi duyệt.
- Hàm tên đề xuất: submitCampaign(title, description, goalWei, durationSeconds), approveCampaign(id), rejectCampaign(id, reason). Nhật Minh chốt chính thức, cập nhật ABI và contract-interface.md trước khi Lý Hiền nối.
- Event đề xuất: CampaignSubmitted, CampaignApproved (kèm approvedAt/deadline/người duyệt), CampaignRejected (kèm người duyệt/lý do). Giữ event thanh toán và biên lai hiện có khi phù hợp.
- Frontend giữ adapter.create(...) làm tên hàm giao diện, adapter sẽ map sang submitCampaign của contract mới. Không truyền durationSeconds nhầm vào tham số deadline của createCampaign bản cũ.

## Hash cần thiết kế lại

- Hash đề xuất chốt chainId, contractAddress, schema version/domain, campaignId, owner, goalWei, durationSeconds.
- Khi duyệt tạo thêm commitment chứa proposalHash và approvedAt/deadline, không ghi đè mất dấu vết điều khoản ban đầu. Lưu bằng storage/event để đối chiếu.
- Trạng thái quyết định và lý do từ chối phải có bằng chứng đọc được trên chain; nội dung phụ ở MongoDB không được tự thay kết quả duyệt.
- Giữ hash biên lai cho mỗi lần góp/rút/hoàn, ID toàn cục, ví thật và số wei thật. Không đưa tổng tiền biến động vào hash điều khoản cố định.
- Chốt schema/types/version chính xác, rồi cập nhật đặc tả và test ethers tính lại hash. Các ý trên là yêu cầu thiết kế, chưa phải ABI/hash schema đã triển khai.

## Kiểm thử và bàn giao

Kiểm tra tối thiểu: gửi đề xuất hợp lệ/sai; Pending không góp/rút/hoàn; chỉ đúng ví duyệt; approve/reject một lần; không approve sau reject hoặc reject sau approve; thời gian tính từ duyệt; mốc đúng deadline; duration vượt giới hạn; lý do rỗng/quá dài; đủ/thiếu vốn; tách chiến dịch; reentrancy; payout lỗi rollback; hash đề xuất/duyệt/biên lai đúng; gọi trực tiếp Remix vẫn không vượt duyệt.

Lưu kết quả thực tế và ảnh Remix, không đổi tên bộ test cũ thành đã đạt cho source mới. Compile cùng cấu hình đã chốt, xuất ABI mới; deploy Sepolia mới bằng ví người thực hiện và lưu địa chỉ/tx hash/settings/source commit. Không giả định tiền hoặc dữ liệu bản cũ tự chuyển sang. Bản cũ tiếp tục tuân thủ quy tắc cũ; frontend/adapter phải phân biệt địa chỉ/phiên bản.

## Bàn giao cho Kim Ba và Lý Hiền

Frontend đã chuẩn bị form thời lượng, trạng thái Pending/Approved/Rejected và mục admin duyệt. Chỉ mở gửi đề xuất/duyệt/từ chối khi adapter khai báo campaignWorkflow = review-v1 sau khi đã kiểm chứng contract mới. Cần thêm isReviewer vào session để hiển thị quyền duyệt, lấy từ quyền thật on-chain. isAdmin của backend không tự cấp quyền reviewer.

Nhật Minh bàn giao source + test + ABI + đặc tả/hash schema + bản ghi deploy. Lý Hiền nối signer cho duyệt/từ chối, chờ receipt, đồng bộ rồi tải lại. Kim Ba không triển khai contract, backend auth hoặc phân quyền on-chain trong phần này.
