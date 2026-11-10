# Bàn giao giao diện và lớp tích hợp

Kim Ba phụ trách giao diện; Lý Hiền triển khai adapter trong `frontend/src/lib/integrationAdapter.js`. Bản mặc định xuất `null`, không chứa dữ liệu hoặc kết quả giao dịch giả. Không có thay đổi contract/backend trong lần bàn giao UI này.

## Cập nhật luồng duyệt chiến dịch

Nhóm chọn duyệt on-chain trước khi nhận góp. Yêu cầu contract dành cho Nhật Minh ở [nhat-minh-campaign-approval.md](nhat-minh-campaign-approval.md). Đây là giao diện chuẩn bị cho contract tương lai, không xác nhận source/ABI/backend hiện có đã hỗ trợ.

Adapter chỉ khai báo `campaignWorkflow: 'review-v1'` sau khi kiểm chứng đúng địa chỉ/ABI và các hàm duyệt của contract mới. Các capability create/approve/reject/loadPendingCampaigns bị khóa nếu thiếu khai báo này; runConfirmedOperation cũng chặn create/approve/reject để tránh truyền thời lượng vào deadline của contract cũ.

Session bổ sung `isReviewer: boolean`, lấy từ quyền thật trên contract, độc lập isAdmin của backend. isAdmin không tự cấp quyền duyệt. subscribeSession phải cập nhật khi quyền reviewer thay đổi.

Record mới thêm `approvalStatus: 'pending' | 'approved' | 'rejected'`, `durationSeconds: string`, `approvedAtSeconds: string`, `rejectionReason?: string`. Pending/Rejected có deadlineSeconds và approvedAtSeconds bằng '0', không có khoản góp/hoàn/rút. Rejected có lý do công khai đọc/đối chiếu từ blockchain. Approved có approvedAtSeconds > 0 và deadlineSeconds = approvedAtSeconds + durationSeconds. Snapshot vẫn phải được adapter xác minh ở cùng block. Record cũ thiếu approvalStatus được đánh dấu legacy, giữ quy tắc cũ; không coi nó là Pending hoặc tự áp quy tắc duyệt mới cho địa chỉ cũ.

Trang khám phá chỉ hiển thị chiến dịch approved (gồm đang gọi vốn và đã kết thúc). Chủ thấy pending/rejected trong Chiến dịch của tôi, có bộ lọc và lý do từ chối. Pending không bị hiểu thành thất bại để hoàn tiền. Giao diện nhập thời lượng nguyên 1–90 ngày, mặc định 7; cần Nhật Minh xác nhận giới hạn contract trước khi mở tích hợp.

Khi có account, loadCampaigns phải bao gồm các pending/rejected của chính account bên cạnh danh sách chiến dịch công khai; UI tự tách chúng khỏi trang khám phá. Không chỉ trả các chiến dịch approved rồi làm mất đề xuất trong mục của chủ.

- `loadPendingCampaigns({account})` trả `{campaigns: record[], hasMore?: boolean}`, chỉ có pending thuộc contract duyệt. Backend/RPC/adapter phải kiểm quyền và tải toàn bộ danh sách phù hợp; không giả định 20 bản ghi MongoDB là toàn bộ.
- `approve({type:'approve',account,id})` và `reject({type:'reject',account,id,reason})` trả TransactionResponse có hash/wait(). reason 10–1000 ký tự theo UI, cần khớp giới hạn contract. Không cập nhật MongoDB để giả lập kết quả duyệt.
- Admin có mục Duyệt chiến dịch riêng. Mọi quyết định đều qua transaction dialog và receipt; afterTransaction đồng bộ rồi refresh. Các thao tác nội dung vẫn đi qua moderate/API riêng.

## Nguyên tắc

- Adapter là mã được tin cậy trong ứng dụng, không phải đối tượng lấy trực tiếp từ HTTP/window/localStorage. Giao diện kiểm tra hình dạng dữ liệu; adapter phải xác minh dữ liệu và quyền thực sự.
- Cấu hình Sepolia `11155111`, địa chỉ contract đã xác nhận và ABI tương ứng. Tránh chuyển địa chỉ âm thầm từ dữ liệu MongoDB. Kiểm tra bytecode và các hàm hash của phiên bản mới.
- `getSession()` và mọi phương thức ví trả `{account, chainId, authenticated, isAdmin, isReviewer}`. account dùng địa chỉ thật hoặc chuỗi rỗng. Không coi kết nối ví là đăng nhập.
- Đăng nhập dùng nonce ngẫu nhiên, hết hạn, dùng một lần; thông điệp có domain/URI/chain ID. Backend kiểm chữ ký rồi tạo phiên cookie HttpOnly, SameSite và Secure trên HTTPS. Quyền admin do backend cấp theo phiên; frontend không có nút chọn vai trò hoặc allowlist cấp quyền.
- `subscribeSession(callback)` trả hàm unsubscribe. Đổi ví/mạng, hết hạn hoặc đăng xuất phải vô hiệu phiên cũ và phát session mới. Adapter phải bỏ kết quả đăng nhập cũ nếu ví đổi trong lúc ký. Không đưa token vào localStorage.
- Backend bắt buộc xác thực phiên, kiểm quyền chủ sở hữu/admin, chống CSRF và kiểm tra input cho thao tác dữ liệu phụ. Ẩn nút không phải cơ chế phân quyền.

## Đọc dữ liệu

| Phương thức | Đầu vào | Đầu ra |
| --- | --- | --- |
| `getSession()` | không | session như trên |
| `connect()`, `login()`, `switchNetwork()`, `logout()` | không | session mới; logout phải hủy phiên server trước khi resolve |
| `loadCampaigns({account})` | địa chỉ lowercase hoặc rỗng | `{campaigns: record[], hasMore: boolean}` |
| `loadCampaign({id, account})` | ID chuỗi uint256 dương | một `record`; phải đọc độc lập, không phụ thuộc trang danh sách đã tải |
| `loadFavorites({account})` | ví đã đăng nhập | `{campaigns: record[]}` gồm toàn bộ yêu thích của tài khoản; phân trang trong adapter khi cần |
| `loadSocial({id, account})` | chiến dịch, ví hoặc rỗng | `{favorite: boolean, comments: [{id, account, text, createdAt}]}` |

Một record:

```ts
type CampaignRecord = {
  campaignId: string; owner: string; title: string; description: string;
  goalWei: string; deadlineSeconds: string; totalRaisedWei: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  durationSeconds?: string; approvedAtSeconds?: string; rejectionReason?: string;
  totalRefundedWei: string; withdrawn: boolean;
  viewer?: string; contributionWei?: string; hasRefunded?: boolean;
  category?: string; image?: string; // image chỉ nhận URL https ổn định
  snapshot: {
    verified: true; chainId: 11155111; contractAddress: string;
    blockNumber: number; blockTimestamp: number;
  };
}
```

Tiền/ID dùng chuỗi nguyên, không Number. Khi có account, viewer phải khớp account và khoản góp/refund phải đọc cho đúng ví. Khi chưa có account, không trả dữ liệu riêng ví. Các record trong một danh sách thuộc cùng contract; không trộn bản deploy cũ/mới.

Adapter đọc các trường tài chính, khoản góp, refund và hash tại cùng blockTag từ RPC tin cậy. Tính lại hash điều khoản để so với `campaignHash`; kiểm biên lai bằng `receiptHash` nếu trả lịch sử giao dịch. Tham khảo schema ở `contract-interface.md`. Hash cố định không bao gồm tổng tiền động; lấy các tổng trực tiếp on-chain tại block đó. Tên/mô tả hiện cũng nằm on-chain. Dữ liệu HTTP thô từ `/api/campaigns` hiện tại chưa đáp ứng hợp đồng này.

`snapshot.verified` do adapter đặt sau khi hoàn tất kiểm tra, không tin giá trị cùng tên trong MongoDB/API. Nếu không đọc/đối chiếu được thì throw; không trả dữ liệu demo, danh sách rỗng thay lỗi, hoặc snapshot cũ gắn nhãn mới. Giao diện hiển thị trạng thái theo blockTimestamp, cần tải lại trước thao tác; contract vẫn quyết định quyền cuối cùng. Danh sách bị giới hạn phải trả hasMore để tránh hiểu nhầm là toàn bộ hệ thống. Bản UI chưa có phân trang, adapter có thể tải đầy đủ theo lô phù hợp.

## Ghi và xác nhận giao dịch

`create`, `contribute`, `withdraw`, `refund` nhận object và trả TransactionResponse ethers v6 có `{hash, wait()}`. Adapter kiểm mạng/account/code lần nữa ngay trước ký. Chỉ dùng signer trên ví; backend không giữ private key.

```js
create({ type: 'create', account, values: { title, description, goalEth, durationDays, durationSeconds, category?, imageFile? } })
contribute({ type: 'contribute', account, id, amount })
withdraw({ type: 'withdraw', account, id })
refund({ type: 'refund', account, id })
```

Gọi parseEther cho số ETH. create map sang hàm gửi đề xuất của contract mới với durationSeconds. Không tự tính hoặc gửi deadline từ đồng hồ máy; deadline chính thức lấy sau giao dịch duyệt. Không dùng Number tính wei. Không gọi create lần hai khi đồng bộ metadata lỗi.

Giao diện chờ `wait()` có receipt status 1 và hash hợp lệ rồi mới báo thành công, xử lý transaction replacement thành công, giữ mã giao dịch nếu RPC lỗi. Adapter/wallet xử lý mất kết nối và không cho một lần click gửi nhiều giao dịch.

Sau receipt, `afterTransaction({receipt, operation})` là hook tùy chọn: parse event đúng địa chỉ để lấy ID mới, đồng bộ API, và lưu metadata. Nếu hook throw, UI vẫn ghi nhận giao dịch đã thành công nhưng cảnh báo chưa đồng bộ. Thao tác tạo không nhận được ID từ receipt phải có thông báo để người dùng tra cứu, không tạo lại.

Ảnh/chủ đề chỉ mở khi adapter có cả `uploadImage` và `saveMetadata`; adapter dùng chúng trong `afterTransaction` sau khi có ID. Phải upload file thật, kiểm MIME/nội dung/kích thước ở server, xác thực ví chủ và lưu URL ổn định. URL xem trước objectURL không được gửi/lưu làm ảnh lâu dài. Nếu chỉ hỗ trợ contract, bỏ cả hai hàm để UI khóa ảnh/chủ đề.

`toggleFavorite({id, account})`, `addComment({id, account, text})`, `deleteComment({id, account, commentId})` phải trả `{ok:true}` sau khi server xác nhận thao tác; phải có loadSocial để tải lại kết quả. Quyền xóa bình luận do server xác định theo phiên, không tin account trong request body. `reportCampaign({id, account, reason})` trả `{ok:true}` sau khi lưu báo cáo, reason 10–1000 ký tự; backend chống gửi trùng/spam và gắn phiên người báo cáo, không dùng nội dung báo cáo để tự thay đổi tiền on-chain.

## Admin

`loadAdmin({section})` với section `campaigns | comments | reports | audit` trả:

```ts
{ items: Array<{
  id: string; title: string; text: string; createdAt?: string;
  hidden?: boolean;   // bắt buộc ở section campaigns
  resolved?: boolean; // bắt buộc ở section reports
}> }
```

Chỉ load sau khi session đã đăng nhập, đúng mạng và isAdmin. API vẫn phải kiểm tra quyền cho mỗi request; trả 401/403 và adapter cập nhật phiên khi mất quyền. `moderate({section,id,action,reason})` trả `{ok:true}` sau khi backend ghi thay đổi và audit log. Các action: hideCampaign, restoreCampaign, deleteComment, resolveReport; reason bắt buộc ít nhất 10 ký tự, tối đa 1000. ID backend phải gắn chain ID/contract/campaign khi phù hợp.

Không có API thay đổi điều khoản hoặc rút tiền admin. Hành động ẩn chỉ tác động website và phải có audit actor/time/reason/target. Phần audit trong UI chỉ đọc, không có nút xóa lịch sử. Không trả danh sách ví/email riêng tư nếu không cần cho quản trị nội dung.

## Nghiệm thu sau khi tích hợp

Thử MetaMask chưa cài/chưa mở khóa, sai mạng, đổi ví trong lúc ký, phiên hết hạn, từ chối ký, không đủ gas; pending/receipt lỗi/thay thế giao dịch; sync lỗi sau mined; số chênh 1 wei; campaign ID lớn; deep link ngoài danh sách; lỗi RPC không hiển thị cache giả là đã xác minh. Thử MongoDB sửa mục tiêu/số tiền và xác nhận không lọt lên UI. Hai ví chạy đủ/thiếu vốn, rút/hoàn một lần. Admin không có quyền thì API phải từ chối dù gọi trực tiếp; ẩn/hiện có audit và không đổi tiền on-chain.
