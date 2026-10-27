# Smart contract với Remix Desktop

Đây là workspace Solidity. Hiện chưa có contract gọi vốn hoặc bài test nghiệp vụ. Không chạy npm install trong thư mục này.

## Mở workspace

1. Cài [Remix Desktop bản Windows](https://remix.live/desktop).
2. Dùng chức năng mở thư mục/workspace của ứng dụng và chọn chính thư mục `blockchain` trong repository.
3. Nhật Minh tạo `contracts/Crowdfunding.sol`. Các thành viên dùng file này từ bản clone Git, không duy trì một bản code khác chỉ nằm trong trình duyệt.

## Biên dịch khi có mã Solidity

1. Mở file contract và bật plugin Solidity Compiler.
2. Chọn compiler phù hợp với `pragma solidity` trong source. Nhóm ghi số phiên bản chính xác, EVM target, trạng thái optimizer và số runs vào phần cấu hình bên dưới.
3. Bấm Compile và xử lý hết lỗi trước khi deploy.
4. Nếu cần làm offline, tải compiler khi còn có mạng trước.

## Cấu hình contract

Chưa chốt cấu hình vì nhóm chưa viết contract. Người thêm contract đầu tiên cần điền đầy đủ các trường sau trong cùng Pull Request:

| Trường | Giá trị |
| --- | --- |
| Solidity compiler | Chưa chọn |
| EVM target | Chưa chọn |
| Optimizer bật hay tắt | Chưa chọn |
| Optimizer runs nếu bật | Chưa chọn |

## Thử bằng Remix VM

1. Mở Deploy & Run Transactions.
2. Chọn Remix VM tương thích với EVM target của contract.
3. Chọn contract, nhập constructor arguments nếu có, để Value bằng 0 nếu constructor không payable, rồi Deploy.
4. Trong Deployed Contracts, thử các hàm bằng tài khoản mô phỏng. Để góp ETH, nhập Value và đúng đơn vị trước khi gọi hàm payable; sau đó đưa Value về 0 khi gọi hàm không nhận tiền.
5. Ghi lại kết quả thực tế. Chưa có bài test thì không đánh dấu đã kiểm thử thành công.

Remix VM là môi trường thử trong IDE. Frontend React + MetaMask không tự nhìn thấy contract ở môi trường này.

## Kiểm thử tự động trong IDE

Bật Solidity Unit Testing ở Plugin Manager, chọn thư mục `/tests` và viết các file kết thúc bằng `_test.sol`. Plugin cung cấp thư viện assert `remix_tests.sol`. Chi tiết nhiệm vụ test nằm trong [tests/README.md](tests/README.md).

## Triển khai để kết nối React

1. Nhóm thống nhất một mạng EVM mà MetaMask truy cập được, ví dụ testnet. Chỉ thêm một node local có RPC nếu thực sự cần chạy hoàn toàn trên máy.
2. Trong Remix Desktop chọn provider qua ví trình duyệt. Tùy phiên bản, nhãn có thể là Browser Extension hoặc Injected Provider. Ứng dụng có thể mở trình duyệt để nối với MetaMask.
3. Kiểm tra đúng mạng trong ví, deploy bằng ETH thử nghiệm và chờ giao dịch xác nhận.
4. Xuất ABI tại Solidity Compiler > Compilation Details. Lưu mảng ABI vào `../frontend/src/contracts/Crowdfunding.json` theo hướng dẫn trong thư mục đó.
5. Ghi mạng, chain ID, địa chỉ contract, transaction hash, compiler settings và commit source trong `deployments/`.
6. Lý Hiền dùng đúng ABI và địa chỉ trên cùng mạng để viết phần tích hợp ethers.

Thay đổi code rồi compile lại không cập nhật contract đã deploy. Phải triển khai phiên bản mới nếu cần và bàn giao lại địa chỉ cùng ABI tương ứng.

## Tài liệu chính thức

- [Remix Desktop](https://remix-ide.readthedocs.io/en/latest/desktop.html)
- [Deploy và môi trường chạy](https://remix-ide.readthedocs.io/en/latest/run.html)
- [Solidity Unit Testing](https://remix-ide.readthedocs.io/en/latest/unittesting.html)
