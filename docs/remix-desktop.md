# Quy trình nhóm dùng Remix Desktop

## Công cụ của từng người

- Cả ba người: Git, tài khoản GitHub riêng và Remix Desktop.
- Bé Ba và Lý Hiền: Node.js 24 LTS, npm, trình duyệt và MetaMask để làm frontend.
- Nhật Minh cũng nên chạy frontend để kiểm tra bàn giao. Cả nhóm giữ cùng phiên bản Node/npm, commit package-lock.json của frontend và dùng npm ci khi clone.

## Thao tác sau khi clone

1. Nhận lời mời cộng tác trên repository GitHub rồi clone về máy.
2. Mở thư mục `blockchain` trong Remix Desktop.
3. Tạo nhánh tính năng từ main mới nhất trước khi sửa file.
4. Viết source trong `contracts/`, test trong `tests/` và chạy bằng các plugin Remix tương ứng.
5. Muốn mở React, chạy npm ci và npm run dev ở `frontend` trong terminal riêng.

Contract V3 có duyệt on-chain, hash đề xuất/quyết định/biên lai và 49 ca test đã chạy đạt. V3 chưa deploy; dùng ABI V3 riêng theo [bàn giao Lý Hiền](ly-hien-contract-handoff.md). Frontend đã bỏ luồng mô phỏng, có khu vực người dùng/admin và đang chờ adapter ví/API theo [bàn giao frontend](frontend-integration.md); bước tiếp theo là chạy lại test trong Remix Desktop, triển khai và ghi nhận bản deploy V3 trên Sepolia và tích hợp ví theo [giao diện contract](contract-interface.md).

## Bàn giao theo từng vai trò

**Nhật Minh:** chốt tên hàm tạo, góp, rút, hoàn và các hàm đọc. Ghi kiểu tham số, đơn vị wei/giây, thứ tự trường trả về và cách đánh ID. Viết test các quy tắc và kiểm tra quyền. Trong PR thêm contract, ghi đủ compiler settings vào blockchain/README.md.

**Bé Ba:** dựng màn hình bằng dữ liệu mẫu trước, sau đó gọi các hàm tích hợp do Lý Hiền cung cấp. Hiển thị chờ ký ví, chờ xác nhận, thành công và lỗi. Không sao chép logic rút/hoàn chỉ vào UI; contract vẫn phải tự kiểm tra.

**Lý Hiền:** kết nối MetaMask bằng ethers v6, kiểm tra mạng, dùng parseEther/formatEther, chờ receipt rồi tải lại dữ liệu. Nhận ABI từ Remix và địa chỉ trên mạng ví truy cập được. Chưa có contract thì không tạo địa chỉ giả để đánh dấu tích hợp đã xong.

## Mạng thử và mạng tích hợp

Remix VM dùng để thử contract ngay trong IDE. Ba máy có ba môi trường thử riêng. Frontend bên ngoài không tự kết nối vào VM này qua MetaMask. Khi làm demo React, nhóm triển khai từ Remix qua ví lên **Ethereum Sepolia**, chain ID **11155111**, rồi dùng chung địa chỉ đã xác nhận. Đừng nhập địa chỉ Remix VM sang testnet.

Không cần cài thêm một blockchain framework cho việc biên dịch trong Remix. Việc chọn testnet/node RPC là bước triển khai cho frontend, không phải thay IDE.

## Trước khi mở Pull Request

- Source lưu trong repository, không chỉ trong bộ nhớ ứng dụng.
- Contract đã compile; test ghi rõ kết quả thực tế và các ca chưa bao phủ.
- ABI, địa chỉ và mạng khớp nhau nếu PR có tích hợp.
- Nếu đổi frontend, chạy npm test, npm run build và npm run lint tại frontend.
- Không có khóa ví, .env, compiler output hoặc dependencies được stage.
- Nhờ một bạn khác review rồi mới merge.

## Quy tắc gọi vốn hiện tại

Chỉ góp khi còn hạn. Chờ hết hạn và đủ mục tiêu thì chủ dự án mới rút được một lần. Nếu hết hạn và thiếu mục tiêu thì mỗi người tự gửi giao dịch yêu cầu hoàn khoản đã góp. Contract không tự chạy theo đồng hồ khi không có giao dịch kích hoạt.

## Nguồn hướng dẫn

- https://remix-ide.readthedocs.io/en/latest/desktop.html
- https://remix-ide.readthedocs.io/en/latest/run.html
- https://remix-ide.readthedocs.io/en/latest/unittesting.html
