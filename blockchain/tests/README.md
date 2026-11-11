# Kiểm thử contract duyệt chiến dịch V3

Ngày 2026-11-11, source V3 được compile bằng solc 0.8.34+commit.80d5c536, EVM cancun, optimizer enabled 200 runs, Via IR tắt và chạy bằng runner chính thức @remix-project/remix-tests@0.2.91 với Remix Simulator: **49 passed, 0 failed**. Không dùng kết quả 25 test của V2 để thay cho lần chạy source mới.

| File | Ca | Phạm vi |
| --- | --- | --- |
| Crowdfunding_test.sol | 7 | ID/input/chuỗi, góp đúng, tách chiến dịch, đúng deadline, direct ETH |
| CrowdfundingSettlement_test.sol | 6 | Đủ/thiếu vốn, quyền rút, rút/hoàn một lần, giữ lịch sử, thiếu 1 wei |
| CrowdfundingSecurity_test.sol | 4 | Payout lỗi rollback/retry, chống tái nhập rút/hoàn |
| CrowdfundingHash_test.sol | 8 | Proposal alias/hash, biên lai ví/số tiền/loại/ID, rollback receipt |
| CrowdfundingApproval_test.sol | 7 | Pending/Rejected chặn mọi thanh toán, đúng reviewer, deadline từ duyệt, quyết định một lần |
| CrowdfundingReviewValidation_test.sol | 6 | Thời lượng nguyên 1–90 ngày, lý do rỗng/ngắn/blank/dài/UTF-8, ID sai, chặn selector cũ, submit không payable |
| CrowdfundingReviewer_test.sol | 6 | Chuyển quyền hai bước, thu hồi quyền cũ, hủy/thay nominee, chặn ví ngoài và reviewer lấy tiền chủ khác |
| CrowdfundingDecisionHash_test.sol | 5 | Schema/version, proposal không bị ghi đè, hash duyệt/từ chối, thay reviewer/time/reason/deadline, chống reuse khác chain/contract |

## Chạy lại trong Remix Desktop

Mở workspace blockchain, chọn compiler/settings trên, bật plugin Solidity Unit Testing, chọn 8 file *_test.sol trong tests rồi Run. Kỳ vọng 49 passing, 0 failing. Import remix_tests.sol do Remix cung cấp. Annotation #value là số wei mô phỏng cấp cho test payable, không dùng ETH Sepolia. Một số suite gần giới hạn kích thước runtime của EVM, phải giữ optimizer 200 runs.

beforeEach triển khai harness mới với reviewer là test suite. Helper _create submit rồi approve qua đúng hàm production; helper _submit giữ Pending. Các ca actor-owner cũng phải được reviewer approve trước khi góp. Không có đường bỏ qua duyệt trong contract thật.

CrowdfundingHarness chỉ có setter deadline phục vụ test nhánh tại hạn trong một transaction; không dùng nó làm contract ứng dụng. Setter cố ý làm deadline khác commitment cũ, không mô phỏng khả năng sửa deadline của production. Các test hash xác minh commitment gốc trước setter. Production không có setter thời gian hoặc hàm sửa điều khoản.

## Kiểm tra bytecode production và ethers

Đã deploy bytecode Crowdfunding thật trong simulator cục bộ, không kế thừa harness: constructor từ chối reviewer 0; Pending/Rejected không góp; ví ngoài không duyệt; trì hoãn duyệt qua mốc timestamp rồi kiểm deadline bắt đầu tại block duyệt; các hàm ethers proposalDigest/decisionDigest/receiptDigest khớp getter và event cho gửi/duyệt/từ chối UTF-8/góp.

Các vector hash ghi nhận từ lần chạy bytecode này ở frontend/test/fixtures/review-hash-vectors.json, dùng cho 4 test mã hóa bổ sung. Chúng là fixture test cục bộ, không phải deployment hoặc dữ liệu chiến dịch Sepolia. Simulator có EVM chain ID nội bộ 1; lần kiểm ethers đặt RPC chain ID khớp 1, không kết nối Mainnet.

Runner có thông báo debugger dumpStorage về contract con mới tạo; các transaction và assertion vẫn hoàn tất. Compile source/test không có lỗi/cảnh báo Solidity. Kết quả chi tiết gắn SHA-256 source/test và cấu hình ở results-review-v1.json. Đây là kết quả runner, chưa xác nhận đã bấm Run trên Remix Desktop của từng thành viên.

## Còn cần thử thực tế

MetaMask, RPC Sepolia, hết hạn theo thời gian mạng thật, quyền reviewer của ví deploy đã chọn, luồng UI và backend auth/admin phải được kiểm tra sau deploy/tích hợp. Cần một chiến dịch đủ vốn và một thiếu vốn đã hết hạn, thử rút/hoàn lặp, từ chối ký, đổi ví/mạng, sync lỗi sau mined và đọc/đối chiếu MongoDB cùng block.
