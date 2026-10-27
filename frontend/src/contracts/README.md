# ABI cho frontend

Chưa có ABI gọi vốn. Sau khi biên dịch contract thật trong Remix Desktop, xuất ABI từ Solidity Compiler > Compilation Details và lưu `Crowdfunding.json` với toàn bộ mảng ABI hợp lệ, ví dụ cấu trúc file là một JSON array (không sao chép các dấu ba chấm làm dữ liệu).

Khi tích hợp, import mảng ABI này và truyền vào `new Contract(address, abi, signerOrProvider)` của ethers v6. Địa chỉ và chain ID lấy từ cấu hình public của ứng dụng; ABI phải khớp contract đang triển khai trên đúng mạng.

Không chép bytecode, private key hoặc seed phrase vào đây. Bản ghi triển khai nằm ở `blockchain/deployments/`. Mỗi lần đổi giao diện hàm, xuất ABI lại và cập nhật cùng thay đổi tích hợp.
