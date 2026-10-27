# Chung Tay frontend

Giao diện React của đồ án Crowdfunding DApp. Bản hiện tại chạy hoàn toàn ở chế độ mô phỏng; chưa kết nối MetaMask, blockchain, backend hoặc dịch vụ upload ảnh.

## Chạy và kiểm tra

Trong thư mục frontend:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

## Thử giao diện

- Khám phá: tìm kiếm, lọc trạng thái, mở chi tiết và yêu thích.
- Bấm Kết nối ví mẫu để chọn ví A. Trong Công cụ thử giao diện có thể đổi ví A/B hoặc mô phỏng sai mạng.
- Ký để đăng nhập (mẫu) trước khi tạo chiến dịch, bình luận hoặc yêu thích. Đây không phải xác thực thật.
- Ví A có chiến dịch Thêm một mầm xanh để rút vốn và khoản góp Bữa cơm cho mái ấm để hoàn tiền.
- Hộp xác nhận cho phép thử thành công, từ chối ký và lỗi. Chỉ cập nhật dữ liệu sau bước xác nhận mô phỏng thành công.
- Form tạo nhận một ảnh JPG/PNG/WebP tối đa 5 MB, kiểm tra nội dung ảnh và hiển thị xem trước. Không bắt buộc ảnh.
- Dữ liệu, bình luận, yêu thích và ảnh lưu trong localStorage theo origin của trình duyệt. Không đồng bộ giữa máy hoặc địa chỉ localhost khác nhau. Đăng nhập mẫu không được giữ sau khi tải lại trang.
- Nếu ảnh vượt hạn mức localStorage, có thông báo thay đổi chỉ giữ trong phiên hiện tại. Đây không phải dịch vụ lưu ảnh thật.
- Dùng Khôi phục dữ liệu mẫu trong Công cụ thử giao diện để chạy lại demo. Thao tác này yêu cầu xác nhận trước khi xóa dữ liệu cục bộ.
- Hạn chót nhập và hiển thị theo giờ Việt Nam (UTC+7). Dữ liệu mẫu mới có một chiến dịch còn hạn 7 ngày và hai chiến dịch đã hết hạn.

## Bàn giao tích hợp cho Lý Hiền

- pages/: khám phá, tạo chiến dịch, chi tiết và trang quản lý của tài khoản.
- components/: thẻ, hiển thị tiến độ và dialog giao dịch.
- lib/DemoContext.jsx: điều phối toàn bộ dữ liệu mẫu và trạng thái giao dịch. Thay việc mô phỏng bằng lớp wallet/crowdfunding thật; không dùng trạng thái authenticated trong React làm bằng chứng đăng nhập.
- lib/demoModel.js: dữ liệu khởi tạo và quy tắc mô phỏng để thử UI. Contract phải tự kiểm tra lại quyền, tiền và thời hạn. Bản giao diện mặc định cho phép chủ chiến dịch góp vào chiến dịch của mình; cần đối chiếu contract nhóm chốt.
- Đọc dữ liệu qua ABI và địa chỉ Sepolia do nhóm bàn giao. Giao dịch ghi cần signer, chờ receipt trước khi báo thành công và tải lại dữ liệu. Không tạo transaction hash giả trong giao diện mẫu.
- Tiền thật dùng wei/bigint và parseEther/formatEther của ethers; không dùng Number để tính khoản góp. Number hiện chỉ phục vụ phần trăm hiển thị.
- Bình luận/yêu thích đồng bộ cần API và xác thực chữ ký SIWE phía server. Đổi tài khoản ví phải hủy phiên tài khoản cũ.
- Upload ảnh cần API hoặc dịch vụ lưu file, trả URL ổn định; thống nhất liên kết ảnh với campaign ID. Chủ đề cũng là metadata cần thống nhất với nhóm.
- Mục tiêu và thời hạn không có chức năng sửa sau khi tạo. Hoàn tiền vẫn giữ tổng góp lịch sử để hiển thị.

## Kiểm tra thủ công khi tích hợp thật

Thử chưa có ví, sai mạng, đổi ví, từ chối ký, giao dịch lỗi, đang chờ xác nhận, tạo chiến dịch có/không ảnh, góp nhiều lần, đạt vốn sớm, rút/hoàn đúng quyền và không lặp. Kiểm tra lại bằng dữ liệu Sepolia thực; test mô phỏng không thay thế kiểm thử contract.
