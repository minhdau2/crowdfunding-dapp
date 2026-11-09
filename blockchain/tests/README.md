# Kiểm thử contract trong Remix

Bộ test có **25 ca** trong bốn file:

| File | Số ca | Nội dung |
| --- | --- | --- |
| `Crowdfunding_test.sol` | 7 | Tạo/đánh ID, đầu vào sai, giới hạn chuỗi, ID không tồn tại, góp nhiều lần/nhiều ví, cách ly chiến dịch, chặn góp 0/đúng hạn, chặn chuyển ETH trực tiếp |
| `CrowdfundingSettlement_test.sol` | 6 | Chặn rút sớm, rút một lần, đúng chủ, không lấy tiền chiến dịch khác, hoàn từng ví một lần, giữ lịch sử, chặn hoàn sai điều kiện, thiếu đúng 1 wei vẫn thất bại |
| `CrowdfundingSecurity_test.sol` | 4 | Chuyển ETH lỗi thì hoàn tác trạng thái và cho thử lại; chống tái nhập lúc rút và hoàn |
| `CrowdfundingHash_test.sol` | 8 | Schema hash chiến dịch; phân biệt ID; gắn biên lai với ví, số tiền, chiến dịch và loại thao tác; biên lai rút/hoàn; rollback khi rút/hoàn lỗi và thử lại; ID không tồn tại |

## Cách chạy trong Remix Desktop

1. Mở workspace là thư mục `blockchain` của repo.
2. Trong Solidity Compiler chọn **0.8.34**, EVM **cancun**, optimizer bật **200 runs**, Via IR tắt.
3. Bật plugin **Solidity Unit Testing** trong Plugin Manager.
4. Chọn thư mục `tests`, chọn bốn file kết thúc bằng `_test.sol` rồi bấm Run. Giữ compiler/optimizer giống cấu hình ở bước 2 nếu plugin có thiết lập riêng.
5. Kết quả mong đợi: **25 passing, 0 failing**. Các annotation `#value` cấp số wei mô phỏng cho test payable; không cần chuyển ETH thật.

Các import `remix_tests.sol` do Remix cung cấp. Không chạy các bài test này trên Sepolia. Test tự tạo contract mới cho từng ca qua `beforeEach()`.

## Phạm vi và kết quả đã chạy

Ngày **2026-11-04**, mã này được biên dịch bằng `solc 0.8.34+commit.80d5c536`, optimizer 200/cancun và chạy qua runner chính thức `@remix-project/remix-tests@0.2.91` cùng Remix Simulator trong môi trường kiểm tra tạm ngoài repo: **25 passed, 0 failed**. Không thêm framework hoặc npm project vào workspace `blockchain`.

Đây là kết quả chạy runner, chưa phải xác nhận đã bấm Run trên Remix Desktop của từng thành viên. Simulator có thông báo trace `dumpStorage ... existing account` khi theo dõi contract con vừa tạo; các giao dịch test vẫn hoàn tất và assertion được runner ghi nhận. Kết quả compile không có lỗi hoặc cảnh báo Solidity.

Đã kiểm tra thêm tính tương thích ethers v6 trên contract production deploy vào Remix Simulator cục bộ: tính lại hash chiến dịch/biên lai bằng `AbiCoder`, đối chiếu getter và event sau khi tạo/góp thành công. RPC chain ID của simulator được đặt khớp EVM nội bộ (1); đây là mô phỏng cục bộ, không phải giao dịch Mainnet hoặc Sepolia.

`helpers/CrowdfundingTestHelpers.sol` chỉ phục vụ kiểm thử:

- `CrowdfundingHarness` kế thừa contract thật, thêm `setDeadlineForTest` để đặt deadline tại `block.timestamp` trong cùng giao dịch. Điều này giúp test chính xác nhánh trước/tại hạn mà không phải chờ nhiều phút. Setter chỉ phục vụ test và không cập nhật hash đã chốt lúc tạo; không dùng nó để mô phỏng khả năng sửa hạn trên production.
- `FundingActor` mô phỏng ví hợp đồng nhận ETH, từ chối ETH và cố gọi lại lúc nhận tiền.
- Contract production `contracts/Crowdfunding.sol` không có hàm sửa deadline. **Chỉ deploy Crowdfunding khi chạy ứng dụng.**

Bộ test này không mô phỏng việc thời gian mạng thực trôi qua, kết nối MetaMask, gas Sepolia hoặc giao diện React. Khi demo thủ công, cần thử ít nhất một chiến dịch đủ vốn và một chiến dịch thiếu vốn sau khi chờ deadline thật, theo [blockchain/README.md](../README.md).
