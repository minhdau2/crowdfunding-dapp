# API nội dung và cách nghiệm thu

Backend dùng Express + MongoDB Atlas. Frontend gọi cùng origin qua proxy `/api`. Không đưa MongoDB/RPC secret vào biến VITE. Danh tính tác giả/chủ/admin lấy từ cookie HttpOnly sau chữ ký ví; trường account do client khai không cấp quyền. POST bắt buộc Origin khớp APP_ORIGIN. Trên HTTPS cookie có Secure; session/nonce và rate limit đang trong RAM, phù hợp một backend demo.

## Chạy

```powershell
cd C:\BlockChain\crowdfunding-dapp\backend
npm.cmd ci
npm.cmd run dev
```

Sharp là dependency mới, cần `npm.cmd ci` khi nhận commit. Frontend khởi động ở terminal riêng bằng `npm.cmd run dev` trong frontend. Mở http://localhost:5173 bằng trình duyệt có MetaMask, chuyển Sepolia, kết nối và ký đăng nhập.

## Các endpoint

| Method và đường dẫn | Quyền / body | Kết quả |
| --- | --- | --- |
| GET /api/campaigns/:id/social | Công khai nếu đã duyệt và chưa ẩn; chủ/admin có thể xem nội dung chưa công khai | favorite theo phiên hiện tại, comments gồm id/account/text/createdAt |
| POST /api/campaigns/:id/comments | Đăng nhập; `{text}` 1–1000 ký tự sau trim | `{ok:true}` |
| POST /api/campaigns/:id/comments/:commentId/delete | Đúng tác giả; admin xóa qua API quản trị với lý do | Xóa mềm và audit trong một transaction |
| POST /api/campaigns/:id/favorite | Đăng nhập; `{favorite:boolean}` | Set trạng thái idempotent, không tạo trùng |
| GET /api/favorites | Đăng nhập | Toàn bộ danh sách của phiên; bỏ chiến dịch đã ẩn |
| POST /api/campaigns/:id/reports | Đăng nhập; `{reason}` 10–1000 ký tự | Mỗi ví một báo cáo/chiến dịch; gửi trùng trả 409 |
| POST /api/campaigns/:id/image | Chỉ chủ on-chain; body binary JPEG/PNG/WebP, đúng Content-Type | `{ok:true,image:"/api/images/<uuid>"}` |
| GET /api/images/:imageId | Theo quyền công khai/chủ/admin của chiến dịch | WebP; nosniff; không cho đọc ảnh chưa gắn nếu không phải chủ |
| POST /api/campaigns/:id/metadata | Chỉ chủ; `{category,image?}` | Ảnh phải do cùng ví tải cho cùng chiến dịch; bỏ image giữ ảnh cũ, chuỗi rỗng xóa ảnh |
| GET /api/admin/:section | Admin backend; section campaigns/comments/reports/audit | `{items:[...]}` đúng giao diện |
| POST /api/admin/moderate | Admin; `{section,id,action,reason}` | hideCampaign/restoreCampaign/deleteComment/resolveReport; lý do 10–1000 ký tự |

ID chiến dịch là chuỗi uint256 dương. Dữ liệu phụ có namespace chainId + contractAddress + campaignId, không trộn deployment cũ. Endpoint đọc tài chính tiếp tục đọc/đối chiếu RPC, không nhận tiền/trạng thái/hash do client khai.

Ảnh: tối đa 5 MB, 20 triệu pixel, chỉ ảnh tĩnh. Server giải mã lại, kiểm định dạng thực và MIME, xoay theo hướng ảnh, thu về tối đa 1600×1600, chuyển WebP và bỏ metadata. Không lưu tên file/đường dẫn do client cung cấp, không tải ảnh từ URL bên ngoài. Byte ảnh nằm trong MongoDB, không mất khi restart backend. Upload chưa gắn và ảnh được thay thế sẽ có TTL 24 giờ; ảnh đang dùng không hết hạn. URL `/api/images/<uuid>` cùng origin hoạt động cả localhost và HTTPS; frontend chỉ chấp nhận dạng UUID chính xác hoặc URL HTTPS.

Metadata hash chỉ là checksum dữ liệu phụ do backend tính, không phải commitment on-chain hay bằng chứng tài chính. Chủ đề: Cộng đồng/Giáo dục/Môi trường/Y tế/Sáng tạo/Khác.

Ẩn chiến dịch loại khỏi danh sách công khai và ẩn ảnh/bình luận. Deep link vẫn cho xem tình trạng tài chính để người góp không mất đường rút/hoàn; UI thay tên/mô tả bằng thông báo ẩn. Dữ liệu gốc trên blockchain vẫn công khai. Admin không có API sửa số tiền, mục tiêu, deadline hoặc rút thay chủ. State quản trị và audit được commit cùng MongoDB transaction; audit lỗi thì state rollback. Không có endpoint sửa/xóa audit. Quản trị viên database vẫn là bên được tin cậy, audit chưa phải log bất biến ngoài DB.

Rate limit theo phiên ví/một phút: 10 bình luận, 30 yêu thích, 5 báo cáo, 5 ảnh, 10 cập nhật metadata, 30 thao tác quản trị. Bộ đếm trong RAM reset khi restart; chưa thay thế hệ thống chống spam ở quy mô production. Danh sách nội dung hiện tải đầy đủ, cần phân trang khi mở rộng.

## Quyền admin

Ví Nhật Minh được người dùng chọn cấp quyền nội dung:

`0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7`

Quyền nằm trong collection admins, không có nút client tự chọn. Backend kiểm lại mỗi request và phiên; thu hồi có hiệu lực request kế tiếp. Cấp quyền không cấp reviewer và ngược lại. Công cụ chỉ chạy từ máy vận hành backend có credentials DB:

```powershell
npm.cmd run admin -- 0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7
# Thu hồi nếu cần:
npm.cmd run admin -- 0x9E24Cbc8a02D3435C2fb774cD6Cc22724cf29ea7 --revoke
```

Mỗi lần cấp/thu hồi có audit actor local-operator. Không commit .env. Để thử giao diện, Nhật Minh ký đăng nhập rồi mở `#/admin`; quyền nội dung hiện được cập nhật định kỳ hoặc khi đăng nhập lại.

## Checklist thủ công trên web

1. Người dùng đăng nhập, vào chiến dịch đã duyệt: thêm/xóa bình luận của mình; thử ví khác không được xóa.
2. Lưu yêu thích, mở Đã yêu thích, tải lại trang và đăng nhập lại: dữ liệu còn đúng ví. Bỏ yêu thích thì biến mất khỏi danh sách sau tải lại.
3. Chủ tạo chiến dịch có ảnh/chủ đề; sau receipt ảnh hiện sau đồng bộ. Nếu upload/sync lỗi, vào chi tiết → Cập nhật ảnh và chủ đề để thử lại, không tạo lại giao dịch.
4. Gửi báo cáo đủ lý do; gửi trùng bị chặn. Nhật Minh xem báo cáo, xử lý kèm lý do; audit có actor/time/reason/target.
5. Nhật Minh ẩn/hiện nội dung: biến mất/xuất hiện ở Khám phá sau tải lại. Deep link vẫn cho người góp thực hiện hoàn/rút đúng điều kiện. Kiểm tra số tiền on-chain không đổi.
6. Thử ảnh sai định dạng, SVG giả PNG, quá 5 MB, ảnh của chiến dịch khác và người khác sửa metadata: bị từ chối.
7. Thu hồi quyền admin rồi gọi API trực tiếp bằng phiên cũ: 403. Kết nối ví hoặc là reviewer chưa đủ quyền admin.

## Kiểm thử tự động

```powershell
cd C:\BlockChain\crowdfunding-dapp\backend
npm.cmd test
npm.cmd run test:integration
```

Lệnh thứ hai dùng cấu hình MongoDB trong .env, tạo collection `codex_test_<random>_*`, dùng ví ngẫu nhiên và fixture contract để thử phân quyền nội dung; xóa đúng collection thử sau khi chạy. Không gửi giao dịch blockchain, không sửa chiến dịch thật. Kiểm tra rollback state khi audit lỗi bằng transaction MongoDB thật. Kiểm thử RPC/bằng chứng giao dịch chạy riêng bằng `npm.cmd run evidence`.
