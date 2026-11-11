# Chung Tay frontend

Giao diện cho người góp vốn, người tạo chiến dịch và quản trị nội dung. Một ví có thể vừa góp vốn vừa tạo chiến dịch. Đã bỏ tài khoản, chiến dịch và giao dịch mô phỏng khỏi ứng dụng.

## Trạng thái bàn giao

Đây là phần giao diện của Kim Ba, chờ Lý Hiền tích hợp ví/API. `src/lib/integrationAdapter.js` hiện xuất `null`: không kết nối MetaMask, không gửi giao dịch, không gọi API MongoDB chưa xác minh, không có quyền admin mặc định. Khi thiếu dịch vụ, màn hình báo chưa sẵn sàng và khóa thao tác liên quan. Không suy luận danh sách trống từ lỗi tải dữ liệu.

Không còn đọc/ghi dữ liệu demo trong localStorage. Dữ liệu demo cũ trên trình duyệt không được sử dụng và không bị tự xóa.

## Chạy và kiểm tra

```powershell
cd E:\BlockChain\crowdfunding-dapp\frontend
npm ci
npm run dev
npm test
npm run lint
npm run build
```

## Các màn hình

| Đường dẫn | Nội dung |
| --- | --- |
| `#/` | Khám phá, tìm/lọc trong danh sách đã tải, trạng thái tải/lỗi/chưa sẵn sàng/trống |
| `#/login` | Kết nối MetaMask, đổi mạng, ký đăng nhập; hai bước độc lập |
| `#/create` | Form, kiểm tra ETH/thời lượng 1–90 ngày và xem lại đề xuất; chỉ gửi khi dịch vụ, ví và phiên đăng nhập sẵn sàng |
| `#/campaign/:id` | Đọc chi tiết độc lập với danh sách, góp/rút/hoàn, bình luận, yêu thích |
| `#/mine`, `#/contributions`, `#/favorites` | Dữ liệu theo ví hiện tại, quản lý chiến dịch/khoản góp/yêu thích |
| `#/admin` | Cổng quản trị: duyệt chiến dịch on-chain và các mục quản lý nội dung/bình luận/báo cáo/lịch sử |

Phần duyệt chiến dịch đã có source/ABI V3 và đang chờ deploy/tích hợp theo [yêu cầu](../docs/nhat-minh-campaign-approval.md). UI có mục Duyệt chiến dịch, cần isReviewer độc lập quyền isAdmin. Chưa có adapter campaignWorkflow review-v1 thì nút gửi/duyệt/từ chối bị khóa. Mục tiêu, chủ, thời lượng được chốt lúc gửi; deadline chỉ xác lập khi duyệt.

Phần quản lý nội dung admin tác động ngoài chain. Không có giao diện sửa goal/deadline/số góp, hủy chiến dịch on-chain hoặc rút thay chủ. Khi chưa có phiên admin, khu vực này chỉ hiển thị yêu cầu đăng nhập/quyền và danh mục chức năng, không tải dữ liệu quản trị. Backend phải kiểm tra quyền thật ở mọi API; giao diện không tạo ra quyền truy cập.

Ảnh và chủ đề bị khóa cho tới khi có dịch vụ lưu metadata/upload. Form có thể xem lại khi chưa kết nối ví, nhưng không lưu hoặc tạo chiến dịch. Không hiển thị thành công giả.

## Bàn giao Lý Hiền

Đọc [hợp đồng tích hợp](../docs/frontend-integration.md). Viết adapter cho các phương thức đã chốt thay vì sửa từng màn hình. Kiểm tra chain ID, bytecode, ABI và địa chỉ deploy; đọc/đối chiếu blockchain trước khi trả snapshot. Không dùng boolean `verified` từ API không tin cậy làm bằng chứng mật mã.

Transaction dialog đi từ xem lại → chờ ký → chờ receipt → thành công/lỗi. Mã giao dịch thật được giữ để tra cứu khi RPC lỗi hoặc đổi ví. Đồng bộ thất bại sau receipt thành công phải báo chưa đồng bộ, không làm người dùng hiểu giao dịch chưa thực hiện.

20 test hiện tại kiểm tra chuẩn hóa dữ liệu, độ chính xác tiền/ID, điều kiện snapshot và receipt. Trong đó 4 test hash dùng vector đã đối chiếu bytecode V3 cục bộ. Chúng không chứng minh ví, xác thực server, phân quyền admin hoặc giao dịch Sepolia đã được tích hợp. Các luồng đó cần kiểm thử end-to-end sau khi nối adapter.
