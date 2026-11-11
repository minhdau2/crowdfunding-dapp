# Giao diện contract V3 cho Lý Hiền

Source chính: `blockchain/contracts/Crowdfunding.sol`. ABI là mảng JSON tại `frontend/src/contracts/CrowdfundingV3.json`. Contract V3 dùng workflow `review-v1`, HASH_VERSION = 2, đã kiểm tra deployment Sepolia (11155111) tại `0x407145f033F6e19F21e5118ffCA15f0B3644cD55`. Cấu hình build/test lịch sử bên dưới bật optimizer; bản deploy thực tế khớp source khi optimizer tắt. Xem [hồ sơ tích hợp](run-v3-integration.md); không dùng địa chỉ V1/V2.

## Thay đổi bắt buộc so với V1/V2

- Constructor mới: `Crowdfunding(address initialReviewer)`, bắt buộc ví khác địa chỉ 0. Người deploy không tự có quyền nếu initialReviewer là ví khác.
- Bỏ `createCampaign` và `CampaignCreated`. Dùng `submitCampaign` và lấy ID từ `CampaignSubmitted` trong receipt thành công. Không truyền duration vào deadline của hàm cũ.
- Đề xuất Pending chưa nhận tiền, deadline/approvedAt = 0. Approved mới nhận góp; deadline cố định một lần khi duyệt. Rejected không phải chiến dịch thiếu vốn cần hoàn.
- Giữ 8 trường đầu của tuple getCampaign, nối thêm các trường duyệt. Dùng ABI V3 để giải mã đủ tuple, không ghép tay ABI cũ/mới.
- `campaignHash` trong V3 là alias của proposalHash, có schema khác V2. Thêm decisionHash/approvalHash. Hash schema version tăng từ 1 lên 2, kể cả biên lai. Không so hash V3 bằng công thức V2.

## Cấu hình và phạm vi quyền

Compiler 0.8.34+commit.80d5c536, EVM cancun, optimizer enabled 200 runs, Via IR tắt. CONTRACT_VERSION = 3, CAMPAIGN_WORKFLOW = review-v1. Reviewer được duyệt hoặc từ chối Pending; không được sửa điều khoản, hủy chiến dịch Approved hoặc rút thay chủ. Một ví có thể vừa là reviewer vừa là chủ chiến dịch và tự duyệt; không có cơ chế bắt buộc người duyệt độc lập.

| Hàm quản lý reviewer | Điều kiện |
| --- | --- |
| `reviewer()` / `pendingReviewer()` | Ví đang có quyền / ví đang được đề nghị chuyển quyền |
| `isReviewer(address)` | Kiểm tra ví có quyền duyệt hiện tại |
| `proposeReviewer(address next)` | Chỉ reviewer hiện tại; next khác 0 và khác ví hiện tại. Có thể thay đề nghị cũ |
| `acceptReviewer()` | Chỉ pendingReviewer; chuyển quyền, xóa đề nghị, thu hồi quyền reviewer cũ |
| `cancelReviewerTransfer()` | Chỉ reviewer hiện tại; hủy đề nghị chưa nhận |

Không có renounce hoặc quyền thu hồi tiền admin. Nếu mất khóa reviewer trước khi chuyển quyền, không có cơ chế khôi phục trong contract; chiến dịch đã Approved vẫn góp/rút/hoàn bình thường, đề xuất Pending chờ người duyệt. isAdmin trên backend và isReviewer on-chain là hai quyền riêng.

## Hàm nghiệp vụ

| Hàm | Đơn vị và điều kiện |
| --- | --- |
| `submitCampaign(string title,string description,uint256 goal,uint256 durationSeconds)` | Không payable. goal > 0 wei; duration là **nguyên ngày từ 1 đến 90 ngày**: 86400–7776000 giây và chia hết 86400. Người gọi thành chủ, trả ID, trạng thái Pending |
| `approveCampaign(uint256 id)` | Chỉ reviewer; chỉ Pending. approvedAt = decidedAt = block.timestamp, deadline = approvedAt + durationSeconds, decidedBy = msg.sender |
| `rejectCampaign(uint256 id,string reason)` | Chỉ reviewer, chỉ Pending. Lý do công khai 10–3000 byte UTF-8, không chỉ gồm byte khoảng trắng/control ASCII. Ghi decidedBy/decidedAt; deadline/approvedAt giữ 0 |
| `contribute(uint256 id)` payable | Chỉ Approved, timestamp < deadline, msg.value > 0. Cho phép góp nhiều lần, vượt mục tiêu và chủ tự góp |
| `withdraw(uint256 id)` | Chỉ Approved, đúng chủ, timestamp >= deadline, totalRaised >= goal, chưa rút. Trả toàn bộ tổng đã góp một lần, kể cả vượt mục tiêu |
| `refund(uint256 id)` | Chỉ Approved, timestamp >= deadline, totalRaised < goal, ví có góp và chưa hoàn. Hoàn toàn bộ khoản lịch sử của ví một lần |

Tên/mô tả không rỗng, tối đa 300/15000 byte UTF-8. UI trim và dùng giới hạn 100/5000 UTF-16 code units. Lý do ở UI yêu cầu 10–1000 UTF-16 code units; contract kiểm tra byte để tiết kiệm mã và hỗ trợ UTF-8, hai giới hạn độ dài không đồng nhất. Backend/frontend vẫn trim/kiểm tra input; contract không xác thực nội dung hoặc tính đúng sự thật của dự án.

Không có hàm sửa title/description/goal/duration/deadline, thu phí, hủy Approved hoặc tự động hoàn tiền theo đồng hồ. Muốn gửi lại đề xuất Rejected thì submit mới, ID mới. Tiền/ID giữ bigint hoặc chuỗi; không đổi wei sang Number.

## Tuple và trạng thái

`getCampaign(id)` trả theo thứ tự:

| Index | Tên | Kiểu và ý nghĩa |
| --- | --- | --- |
| 0 | owner | address payable, ví chủ |
| 1 | title | string công khai, bất biến |
| 2 | description | string công khai, bất biến |
| 3 | goal | uint256 wei |
| 4 | deadline | uint256 Unix seconds; 0 nếu chưa được duyệt |
| 5 | totalRaised | uint256, tổng lịch sử đã góp, không giảm sau rút/hoàn |
| 6 | totalRefunded | uint256, tổng đã hoàn thành công |
| 7 | withdrawn | bool |
| 8 | durationSeconds | uint256, thời lượng nguyên ngày đã chốt lúc submit |
| 9 | submittedAt | uint256, thời điểm gửi đề xuất |
| 10 | approvedAt | uint256, thời điểm duyệt, hoặc 0 |
| 11 | approvalStatus | uint8: 0 Pending, 1 Approved, 2 Rejected |
| 12 | rejectionReason | string, rỗng nếu chưa bị từ chối |
| 13 | decidedBy | address reviewer đã quyết định; 0 nếu Pending |
| 14 | decidedAt | uint256 thời điểm quyết định; 0 nếu Pending |

`getCampaignStatus(id)` có enum riêng: **0 Active, 1 Successful, 2 Unsuccessful, 3 Pending, 4 Rejected**. Không dùng giá trị enum approvalStatus để giải mã CampaignStatus. Approved còn hạn luôn Active dù đã đạt mục tiêu. Kết quả Successful/Unsuccessful không đổi sau khi rút/hoàn; đọc các cờ thanh toán riêng.

| Getter | Kết quả |
| --- | --- |
| `campaignCount()` | Tổng đề xuất, gồm Pending/Approved/Rejected; ID từ 1, không tái sử dụng |
| `contributions(id,wallet)` | Tổng lịch sử ví đã góp, không xóa sau hoàn |
| `refunded(id,wallet)` | Đã hoàn hay chưa |
| `getRefundableAmount(id,wallet)` | 0 nếu chưa đủ điều kiện, Pending hoặc Rejected |
| `getAvailableFunds(id)` | 0 nếu Pending/Rejected/đã rút; còn lại totalRaised - totalRefunded. Không có nghĩa ví hiện tại được rút |
| `proposalHash(id)` / `campaignHash(id)` | Cùng commitment đề xuất bất biến |
| `decisionHash(id)` | Commitment duyệt/từ chối, hoặc bytes32(0) khi Pending |
| `approvalHash(id)` | Bằng decisionHash chỉ khi Approved; 0 khi Pending/Rejected |
| `receiptCount()` / `receiptHash(receiptId)` | Biên lai thanh toán toàn cục, ID từ 1; ID không tồn tại revert |

Contract không có getter trả toàn bộ danh sách. Adapter đọc campaignCount rồi tải theo lô/phân trang hoặc dùng indexer có kiểm chứng. Một campaign ID chỉ có ý nghĩa cùng chainId và contractAddress; không gộp dữ liệu deploy cũ/mới. Không dùng balance toàn contract làm tiền từng chiến dịch; ETH ép chuyển vào không được hạch toán cho bất kỳ chiến dịch nào.

## Event

| Event | Trường |
| --- | --- |
| `CampaignSubmitted` | id indexed, owner indexed, title, goal, durationSeconds |
| `CampaignApproved` | id indexed, reviewer indexed, approvedAt, deadline |
| `CampaignRejected` | id indexed, reviewer indexed, reason, decidedAt |
| `ProposalHashRecorded` | campaignId indexed, digest |
| `DecisionHashRecorded` | campaignId indexed, status uint8, digest |
| `ContributionReceived` | id indexed, contributor indexed, amount, totalRaised |
| `FundsWithdrawn` / `RefundClaimed` | id indexed, owner/contributor indexed, amount |
| `PaymentReceipt` | receiptId indexed, campaignId indexed, account indexed, kind uint8, amountWei, digest |
| `ReviewerTransferStarted` | previousReviewer indexed, proposedReviewer indexed |
| `ReviewerTransferCancelled` | reviewer indexed, cancelledReviewer indexed |
| `ReviewerTransferred` | previousReviewer indexed, newReviewer indexed |

Filter log theo đúng địa chỉ contract trước khi parse event. Submit/duyệt/từ chối không làm tăng receiptCount: biên lai riêng chỉ cho góp/rút/hoàn. Giao dịch revert thì toàn bộ state, event và bộ đếm của giao dịch đó hoàn tác.

## Hash schema V3

Tất cả dùng **keccak256(abi.encode(...))**, không encodePacked. HASH_VERSION = uint256(2). Domain là keccak256 của chuỗi UTF-8 ghi dưới đây. Các ví và số tiền lấy từ msg.sender/msg.value hoặc quyền thanh toán thực trong contract, không từ MongoDB.

| Hash | Kiểu ABI theo thứ tự | Giá trị theo thứ tự |
| --- | --- | --- |
| Proposal | bytes32,uint256,uint256,address,uint256,address,uint256,uint256 | keccak256("CHUNG_TAY_PROPOSAL"), 2, chainId, contractAddress, campaignId, owner, goalWei, durationSeconds |
| Decision | bytes32,uint256,uint256,address,uint256,bytes32,uint8,address,uint256,uint256,uint256,bytes32 | keccak256("CHUNG_TAY_DECISION"), 2, chainId, contractAddress, campaignId, proposalHash, approvalStatus, decidedBy, decidedAt, approvedAt, deadlineSeconds, keccak256(bytes(rejectionReason)) |
| Payment | bytes32,uint256,uint256,address,uint256,uint8,uint256,address,uint256 | keccak256("CHUNG_TAY_RECEIPT"), 2, chainId, contractAddress, receiptId, kind, campaignId, account, amountWei |

Decision status chỉ là 1 Approved hoặc 2 Rejected. Approved dùng reason rỗng (hash chuỗi rỗng, không phải bytes32(0)); Rejected dùng approvedAt/deadline = 0. Payment kind: 0 góp, 1 rút, 2 hoàn. Proposal không bị ghi đè lúc duyệt/từ chối; Decision gắn thêm mốc thời gian và reviewer thực tế. Sau chuyển reviewer, decidedBy cũ vẫn là lịch sử hợp lệ.

`frontend/src/contracts/financialHashes.js` cung cấp proposalDigest, decisionDigest, receiptDigest đã đối chiếu bytecode production trong simulator. Đây là **hàm mã hóa thuần**, không tự gọi RPC, không chứng minh MongoDB đúng và không tự bật các nút UI. Lý Hiền đọc dữ liệu/hash tại cùng blockTag từ đúng địa chỉ/mạng, tính lại rồi so sánh. Khi không xác minh được thì báo lỗi; không lấy một hash trong MongoDB làm nguồn chuẩn để kiểm chính dữ liệu MongoDB.

Hash không mã hóa dữ liệu công khai và không chốt các tổng tiền biến động. totalRaised, totalRefunded, contributions và trạng thái thanh toán phải đọc trực tiếp on-chain cùng block, hoặc kiểm chứng bằng event đã xác nhận. Ghi tx hash/log index/block hash để xử lý xác nhận và reorg; receipt mined chưa đồng nghĩa finalized.

## Lỗi cần hiển thị

| Nhóm | Custom errors |
| --- | --- |
| Reviewer | InvalidReviewer, NotReviewer(caller), NotPendingReviewer(caller) |
| Duyệt | CampaignNotPending(id), CampaignNotApproved(id), InvalidRejectionReason |
| Input | EmptyTitle, EmptyDescription, TitleTooLong, DescriptionTooLong, InvalidGoal, InvalidDuration |
| ID | CampaignNotFound(id), ReceiptNotFound(receiptId) |
| Góp/thời gian | ZeroContribution, CampaignClosed(id), CampaignStillActive(id) |
| Rút | NotCampaignOwner(id,caller), GoalNotReached(id), AlreadyWithdrawn(id) |
| Hoàn | GoalAlreadyReached(id), NoContribution(id,wallet), AlreadyRefunded(id,wallet) |
| ETH/bảo vệ | TransferFailed, ReentrantCall, DirectTransfersDisabled |

Từ chối ký, thiếu gas, mất mạng là lỗi ví/provider. Không báo thành công trước receipt status 1. Nếu receipt thành công nhưng sync MongoDB lỗi, báo đã thực hiện nhưng chưa đồng bộ; không đề nghị gửi lại giao dịch thanh toán.

## Ví dụ tích hợp tối thiểu

```js
import { BrowserProvider, Contract, parseEther } from 'ethers'
import abi from './contracts/CrowdfundingV3.json'
const provider = new BrowserProvider(window.ethereum)
await provider.send('eth_requestAccounts', [])
if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Chọn Ethereum Sepolia')
if (await provider.getCode(contractAddress) === '0x') throw new Error('Không có contract')
const signer = await provider.getSigner()
const contract = new Contract(contractAddress, abi, signer)
if (await contract.CONTRACT_VERSION() !== 3n || await contract.CAMPAIGN_WORKFLOW() !== 'review-v1') {
  throw new Error('Sai phiên bản contract')
}
const tx = await contract.submitCampaign(title.trim(), description.trim(), parseEther(goalEth), BigInt(durationDays) * 86400n)
const receipt = await tx.wait()
let campaignId
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
  try {
    const event = contract.interface.parseLog(log)
    if (event?.name === 'CampaignSubmitted') campaignId = event.args.id
  } catch { /* unrelated log */ }
}
if (campaignId === undefined) throw new Error('Giao dịch đã mined; kiểm tra event trước khi gửi lại')
// Dành cho ví có quyền reviewer, chờ receipt và tải lại:
// await (await contract.approveCampaign(campaignId)).wait()
// await (await contract.rejectCampaign(campaignId, reason)).wait()
```

Lớp adapter trả TransactionResponse cho UI tự chờ receipt, nên không bọc tx.wait() trong create/approve/reject rồi trả object thành công giả. Tách parse event/sync vào afterTransaction. Hướng dẫn giao diện ở `frontend-integration.md`, checklist thực hiện ở `ly-hien-contract-handoff.md`.
