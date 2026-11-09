# Smart contract với Remix Desktop

`contracts/Crowdfunding.sol` là contract gọi vốn của ứng dụng Chung Tay. Một lần deploy quản lý nhiều chiến dịch; không có tham số constructor. Mở trực tiếp thư mục `blockchain` bằng Remix Desktop; không cần chạy npm trong thư mục này.

## Cấu hình biên dịch

| Trường | Giá trị |
| --- | --- |
| Solidity compiler | **0.8.34** (`0.8.34+commit.80d5c536`) |
| EVM target | **cancun** |
| Optimizer | **Enabled** |
| Optimizer runs | **200** |
| Via IR | **Tắt** |
| Contract để deploy | **Crowdfunding**, file `contracts/Crowdfunding.sol` |
| Constructor arguments | Không có |
| Mạng tích hợp | **Ethereum Sepolia**, chain ID **11155111** |

Trong Solidity Compiler, chọn các giá trị trên, mở `contracts/Crowdfunding.sol` rồi bấm Compile. Các thiết lập EVM/optimizer nằm trong Advanced Configurations. Nếu dùng offline, cần tải compiler trước khi mất mạng.

## Quy tắc nghiệp vụ đã cài đặt

- `createCampaign(title, description, goal, deadline)`: người gọi là chủ chiến dịch; mục tiêu > 0 wei, hạn chót ở tương lai.
- `contribute(id)`: góp ETH dương trước hạn, được góp nhiều lần và vượt mục tiêu. Chủ chiến dịch cũng được góp.
- `withdraw(id)`: chỉ chủ chiến dịch, khi **đã hết hạn và đủ mục tiêu**, rút toàn bộ tiền chiến dịch một lần, gồm phần vượt mục tiêu.
- `refund(id)`: khi **đã hết hạn và thiếu mục tiêu**, mỗi ví tự gửi giao dịch nhận lại toàn bộ khoản mình đã góp một lần.
- Không có phí nền tảng, admin, hủy chiến dịch hay sửa nội dung/hạn chót sau khi tạo.
- Tổng tiền đã góp và lịch sử từng ví được giữ sau khi thanh toán. `totalRefunded`, `withdrawn`, `refunded` ghi nhận phần đã xử lý.

Contract không tự gửi tiền khi đồng hồ hết hạn. Chủ chiến dịch hoặc người góp cần gọi hàm rút/hoàn và trả phí gas. Mô tả và tên chiến dịch lưu công khai trên blockchain; danh mục, ảnh, bình luận và yêu thích thuộc lớp giao diện/dữ liệu ngoài chain.

## Hash tài chính và biên lai (bản source V2)

- Khi tạo chiến dịch, contract tự lưu hash của chain ID, địa chỉ contract, ID chiến dịch, ví chủ, mục tiêu và hạn chót, có domain và phiên bản schema. Đọc bằng `campaignHash(id)`.
- Mỗi lần góp/rút/hoàn thành công có một receipt ID toàn cục, hash riêng và event `PaymentReceipt` chứa ID chiến dịch, ví thực hiện, loại thao tác và số wei thực tế. Đọc bằng `receiptHash(receiptId)`.
- Hash dùng `keccak256(abi.encode(...))`, không nhận hash, ID người dùng MongoDB hay số tiền tự khai từ frontend. Giao dịch revert thì biên lai và bộ đếm cũng hoàn tác.
- Tổng tiền và số góp từng ví vẫn là trạng thái on-chain, thay đổi sau các giao dịch hợp lệ. Hash cố định của chiến dịch không chứa các tổng này. Tên/mô tả vẫn chưa có hàm sửa.

Xem schema và cách đối chiếu trong [contract-interface.md](../docs/contract-interface.md). Hash không mã hóa dữ liệu và không thay thế việc xác minh API/giao diện với blockchain; bước này mới bổ sung nền tảng contract và ABI.

## Thử thủ công trong Remix VM

1. Chạy bộ test theo [tests/README.md](tests/README.md).
2. Mở lại `contracts/Crowdfunding.sol`, compile, vào Deploy & Run Transactions. Chọn Remix VM hỗ trợ Cancun hoặc mới hơn.
3. Chọn đúng **Crowdfunding**, để Value = **0**, bấm Deploy. Không deploy `CrowdfundingHarness` hoặc các contract test làm contract ứng dụng.
4. Lấy deadline bằng terminal JavaScript: `Math.floor(Date.now() / 1000) + 300` (5 phút sau). Gọi `createCampaign` với tên, mô tả, goal = `10000000000000000` (0.01 ETH), deadline vừa tính. ID đầu tiên là `1`.
5. Đổi tài khoản mô phỏng, đặt Value = `0.01`, đơn vị **ether**, gọi `contribute(1)`. Đưa Value về **0** sau đó. Đọc `getCampaign(1)` và `contributions(1, địa_chỉ_ví)`.
6. Chưa hết hạn thì `withdraw(1)` phải bị chặn dù đã đủ vốn. Sau hạn, đổi về tài khoản chủ chiến dịch để rút; kiểm tra `withdrawn = true` và `getAvailableFunds(1) = 0`.
7. Tạo chiến dịch khác có mục tiêu cao hơn số góp. Sau hạn, ví đã góp gọi `refund(id)`; lần gọi thứ hai phải bị chặn. `totalRaised` và `contributions` vẫn là lịch sử ban đầu.

Thời gian quyết định là `block.timestamp` của blockchain, theo giây Unix. Tại đúng deadline: đóng góp bị chặn, rút/hoàn được xét điều kiện. Remix VM không tự cung cấp RPC để React + MetaMask bên ngoài kết nối.

## Bàn giao và triển khai Sepolia

ABI đã xuất từ source hiện tại tại `../frontend/src/contracts/Crowdfunding.json`. Quy ước hàm, dữ liệu và ví dụ ethers ở [contract-interface.md](../docs/contract-interface.md).

Bản V1 trên Sepolia: `0xCe15C87F7D03325D9fcE8190f04Fcbc6a2a366F3`, giao dịch deploy `0x1ecf1eaf7a02824aeac88de495717c5b7b09aef4122b665bd4adc3d90fdc0c0f`. **V1 không có các hàm hash/biên lai mới. Source và ABI hiện tại là V2, chưa deploy.** Thay đổi source không nâng cấp V1; cần deploy mới để dùng chức năng mới, dữ liệu/tiền ở V1 không tự chuyển sang V2. Khi triển khai V2:

1. Chọn **Ethereum Sepolia** trong ví và kiểm tra chain ID **11155111**.
2. Trong Remix Desktop dùng provider kết nối ví. Nhãn có thể là Browser Extension/Injected Provider tùy phiên bản; làm theo luồng kết nối trình duyệt nếu ứng dụng yêu cầu.
3. Chọn **Crowdfunding**, Value = **0**, xác nhận deploy bằng ETH thử nghiệm rồi chờ receipt thành công.
4. Ghi địa chỉ thật, transaction hash, compiler settings và commit source vào `deployments/` theo [mẫu thông tin](deployments/README.md).
5. Lý Hiền dùng đúng địa chỉ trên Sepolia và ABI cùng phiên bản để nối frontend. Các nút UI hiện vẫn chạy bằng dữ liệu mô phỏng.

Thay đổi source không cập nhật contract đã deploy. Nếu deploy phiên bản mới, bàn giao lại ABI và địa chỉ tương ứng. Không lưu private key hoặc seed phrase vào repository.

## Tài liệu chính thức

- [Remix Desktop](https://remix-ide.readthedocs.io/en/latest/desktop.html)
- [Deploy và môi trường chạy](https://remix-ide.readthedocs.io/en/latest/run.html)
- [Solidity Unit Testing](https://remix-ide.readthedocs.io/en/latest/unittesting.html)
