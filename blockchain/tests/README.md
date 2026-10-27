# Kiểm thử contract bằng Remix Desktop

Chưa có mã contract hoặc bộ test. Khi thêm contract, Nhật Minh tạo file `Crowdfunding_test.sol` và chạy trong plugin Solidity Unit Testing, chọn thư mục `/tests` của workspace `blockchain`.

Các ca cần bao phủ:

- Tạo chiến dịch hợp lệ; từ chối mục tiêu 0 và hạn chót không hợp lệ.
- Góp nhiều lần, góp từ nhiều ví và cộng tổng đúng cho từng chiến dịch.
- Từ chối góp 0, góp sau hạn và ID không tồn tại.
- Chủ dự án chỉ rút khi đã kết thúc và đủ mục tiêu; ví khác không rút được; không rút hai lần.
- Hoàn tiền khi thất bại đúng số của từng người; không hoàn hai lần hoặc hoàn khi chiến dịch thành công.
- Cách ly tiền giữa các chiến dịch, cập nhật trạng thái trước chuyển ETH và bảo vệ tái nhập.
- Kiểm tra tại đúng ranh giới deadline bằng cách điều khiển môi trường thử hoặc bố trí test phù hợp. Không đổi logic production để bỏ qua thời hạn.

Đặt tên file kết thúc bằng `_test.sol`. Có thể import `remix_tests.sol` và `remix_accounts.sol` do Remix cung cấp. Không chép nguyên bài test của framework khác vào plugin.

Ghi kết quả thực sự chạy được và hạn chế của bộ test trong PR. Các ca chưa tự động hóa phải có checklist demo riêng; không ghi pass nếu chưa chạy.

[Tài liệu plugin](https://remix-ide.readthedocs.io/en/latest/unittesting.html)
