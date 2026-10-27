# Ghi nhận triển khai

Chưa có contract được triển khai cho ứng dụng. Khi deploy để cả nhóm dùng chung, thêm một bản ghi cho mỗi mạng/phiên bản với:

- Tên mạng và chain ID.
- Tên contract, địa chỉ và transaction hash đã xác nhận.
- Commit nguồn tương ứng và các tham số constructor.
- Phiên bản compiler, EVM target và optimizer settings.
- Người thực hiện và thời điểm triển khai.
- Đường dẫn ABI bàn giao cho frontend.

Không ghi private key, seed phrase hoặc RPC URL chứa API key. Địa chỉ trong Remix VM chỉ có ý nghĩa trong phiên mô phỏng tương ứng, không phải địa chỉ dùng chung cho MetaMask trên một mạng khác.
