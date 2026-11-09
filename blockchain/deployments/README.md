# Ghi nhận triển khai

V1 đã được deploy trên Ethereum Sepolia (11155111):

- Địa chỉ: `0xCe15C87F7D03325D9fcE8190f04Fcbc6a2a366F3`.
- Transaction hash: `0x1ecf1eaf7a02824aeac88de495717c5b7b09aef4122b665bd4adc3d90fdc0c0f`.
- V1 không có hàm hash/biên lai mới. Chưa có bản ghi đầy đủ compiler settings/commit cho V1; không áp dụng ngược cấu hình biên dịch V2 cho bản đã deploy.

Source và ABI hiện tại là V2, **chưa deploy**. Deploy V2 tạo contract mới, không chuyển tiền hoặc dữ liệu từ V1. Khi deploy để cả nhóm dùng chung, thêm một bản ghi cho mỗi mạng/phiên bản với:

- Tên mạng và chain ID.
- Tên contract, địa chỉ và transaction hash đã xác nhận.
- Commit nguồn tương ứng và các tham số constructor.
- Phiên bản compiler, EVM target và optimizer settings.
- Người thực hiện và thời điểm triển khai.
- Đường dẫn ABI bàn giao cho frontend.

Không ghi private key, seed phrase hoặc RPC URL chứa API key. Địa chỉ trong Remix VM chỉ có ý nghĩa trong phiên mô phỏng tương ứng, không phải địa chỉ dùng chung cho MetaMask trên một mạng khác.
