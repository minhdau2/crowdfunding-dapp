# Giao diện Crowdfunding cho frontend

Source: `blockchain/contracts/Crowdfunding.sol`. ABI: `frontend/src/contracts/Crowdfunding.json`, là **mảng JSON** trực tiếp, không có lớp bọc `{ abi: ... }`. Mạng dự kiến: **Ethereum Sepolia, chain ID 11155111**. Source/ABI hiện tại là V2 bổ sung hash/biên lai, chưa deploy. V1 tại `0xCe15C87F7D03325D9fcE8190f04Fcbc6a2a366F3` không có các hàm mới; các hàm nghiệp vụ và thứ tự tuple vẫn giữ nguyên. Chỉ dùng địa chỉ V2 lấy từ receipt deploy thật khi tích hợp hash.

## Hàm ghi dữ liệu

| Hàm | Tham số | Ai gọi và điều kiện |
| --- | --- | --- |
| `createCampaign(string title, string description, uint256 goal, uint256 deadline)` | `goal` wei; `deadline` giây Unix | Bất kỳ ví; goal > 0, deadline > block.timestamp. Người gọi thành chủ. Trả ID, phát `CampaignCreated` |
| `contribute(uint256 id)` payable | Gửi tiền trong `{ value: amountWei }` | Ví bất kỳ, kể cả chủ; value > 0, timestamp < deadline; góp lặp và vượt mục tiêu được phép |
| `withdraw(uint256 id)` | Value phải bằng 0 | Chủ chiến dịch, timestamp >= deadline, totalRaised >= goal, chưa rút; nhận toàn bộ totalRaised một lần |
| `refund(uint256 id)` | Value phải bằng 0 | Ví đã góp, timestamp >= deadline, totalRaised < goal, chưa hoàn; nhận toàn bộ khoản ví đã góp một lần |

Tên và mô tả không rỗng; tối đa **300/15000 byte UTF-8** tương ứng. Giới hạn hiện có của UI 100/5000 UTF-16 code units nằm trong giới hạn này. UI cần trim khoảng trắng; contract chỉ kiểm tra độ dài byte. Không gửi ảnh hoặc dữ liệu riêng tư vào hai trường này.

Không có admin, phí nền tảng, sửa chiến dịch, hủy chiến dịch, hoặc chuyển quyền chủ. Người góp không được rút lại tiền khi chiến dịch còn chạy hoặc đã thành công. Hoàn tiền cần người góp chủ động ký giao dịch, không tự chạy khi hết hạn.

## Hàm đọc và thứ tự dữ liệu

`campaignCount()` là tổng số chiến dịch. ID bắt đầu từ **1**, không tái sử dụng và không xóa chiến dịch. Đọc từng ID qua `getCampaign(id)`, tải theo trang ở frontend nếu danh sách lớn; contract không có hàm trả toàn bộ danh sách hoặc toàn bộ người góp.

`getCampaign(id)` trả tuple theo đúng thứ tự:

| Vị trí | Tên | Solidity | Ý nghĩa |
| --- | --- | --- | --- |
| 0 | `owner` | address | Ví chủ chiến dịch |
| 1 | `title` | string | Tên công khai |
| 2 | `description` | string | Mô tả công khai |
| 3 | `goal` | uint256 | Mục tiêu, wei |
| 4 | `deadline` | uint256 | Hạn chót, giây Unix |
| 5 | `totalRaised` | uint256 | Tổng đã góp trong lịch sử, wei; không giảm sau rút/hoàn |
| 6 | `totalRefunded` | uint256 | Tổng đã hoàn thành công, wei |
| 7 | `withdrawn` | bool | Đã rút thành công hay chưa |

| Hàm | Kết quả |
| --- | --- |
| `getCampaignStatus(id)` | `0 = Active` → UI `active`; `1 = Successful` → `successful`; `2 = Unsuccessful` → `unsuccessful` |
| `contributions(id, wallet)` | Tổng lịch sử ví đã góp, wei, không giảm sau hoàn |
| `refunded(id, wallet)` | Ví đã nhận hoàn hay chưa |
| `getRefundableAmount(id, wallet)` | Khoản hiện được phép hoàn; bằng 0 nếu chưa đến hạn, thành công, đã hoàn hoặc chưa góp |
| `getAvailableFunds(id)` | Tiền còn hạch toán cho riêng chiến dịch: 0 khi đã rút, còn lại totalRaised - totalRefunded |
| `MAX_TITLE_BYTES()` / `MAX_DESCRIPTION_BYTES()` | 300 / 15000 |
| `campaignHash(id)` | Hash tài chính cố định; ID sai revert `CampaignNotFound` |
| `receiptCount()` | Tổng số biên lai góp/rút/hoàn thành công, ID toàn cục bắt đầu từ 1 |
| `receiptHash(receiptId)` | Hash biên lai; ID sai revert `ReceiptNotFound` |
| `HASH_VERSION()` | 1 (phiên bản schema hash, không phải số phiên bản deploy) |
| `CAMPAIGN_HASH_DOMAIN()` / `RECEIPT_HASH_DOMAIN()` | bytes32 domain theo schema bên dưới |

Đang còn hạn luôn là `Active` dù đã đủ tiền. `Successful`/`Unsuccessful` là kết quả gọi vốn sau hạn, không đổi khi rút/hoàn xong. Hiển thị trạng thái thanh toán từ `withdrawn`/`refunded` riêng. `getAvailableFunds` khác số tiền có thể rút: muốn rút còn phải đúng chủ, hết hạn và đủ mục tiêu. ETH bị ép chuyển vào contract không thuộc chiến dịch nào.

## Schema hash tài chính và biên lai

Contract tự tính hash từ dữ liệu thật. Không truyền hash từ MongoDB/frontend vào contract. Mọi trường vẫn công khai; hash phục vụ đối chiếu tính toàn vẹn, không phải mã hóa.

Hai schema đều dùng `keccak256(abi.encode(...))` theo đúng thứ tự và kiểu:

| Hash | Kiểu ABI theo thứ tự | Giá trị theo thứ tự |
| --- | --- | --- |
| Chiến dịch | `bytes32,uint256,uint256,address,uint256,address,uint256,uint256` | `keccak256("CHUNG_TAY_CAMPAIGN"), 1, chainId, contractAddress, campaignId, owner, goalWei, deadlineSeconds` |
| Biên lai | `bytes32,uint256,uint256,address,uint256,uint8,uint256,address,uint256` | `keccak256("CHUNG_TAY_RECEIPT"), 1, chainId, contractAddress, receiptId, kind, campaignId, account, amountWei` |

Domain là `keccak256` của chuỗi UTF-8 tương ứng. `kind`: **0 = góp**, **1 = rút**, **2 = hoàn**. `account` là `msg.sender` thật; `amountWei` là `msg.value` khi góp, tổng được rút khi rút, hoặc khoản ví được hoàn khi hoàn. Receipt ID tăng chung cho toàn contract, gồm mọi chiến dịch và cả ba loại thao tác.

Ví dụ tính lại bằng ethers v6, dùng chain ID/địa chỉ từ cấu hình đã kiểm tra mạng và code deploy:

```js
import { AbiCoder, id, keccak256 } from 'ethers'

const coder = AbiCoder.defaultAbiCoder()
const coreDigest = keccak256(coder.encode(
  ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'address', 'uint256', 'uint256'],
  [id('CHUNG_TAY_CAMPAIGN'), 1n, chainId, contractAddress,
    campaignId, campaign.owner, campaign.goal, campaign.deadline],
))
const paymentDigest = keccak256(coder.encode(
  ['bytes32', 'uint256', 'uint256', 'address', 'uint256', 'uint8', 'uint256', 'address', 'uint256'],
  [id('CHUNG_TAY_RECEIPT'), 1n, chainId, contractAddress,
    payment.receiptId, payment.kind, payment.campaignId, payment.account, payment.amountWei],
))
// So sánh với campaignHash(campaignId) / receiptHash(payment.receiptId)
// đọc trực tiếp từ đúng contract, cùng blockTag khi kiểm tra một snapshot.
```

Khi góp tiền, hash chiến dịch giữ nguyên vì nó chỉ chốt các điều khoản cố định. Tổng đã góp/đã hoàn, số góp từng ví và trạng thái thanh toán thay đổi sau các giao dịch hợp lệ; muốn kiểm tra chúng, đọc trực tiếp các getter tại cùng một block, hoặc đối chiếu các event đã xác nhận. Không dùng hash cố định này để xác minh tổng tiền hiện tại.

Giao dịch revert thì cả receipt ID, hash, event và trạng thái tài chính đều hoàn tác. Lấy biên lai từ `PaymentReceipt` trong receipt thành công; lọc đúng địa chỉ contract. Khóa định danh ngoài chain phải gồm `chainId + contractAddress + receiptId`; giữ thêm transaction hash, log index, block number và block hash để theo dõi xác nhận/reorg. Không nhận một hash lưu trong MongoDB làm nguồn chuẩn cho việc đối chiếu chính MongoDB đó.

Phần thay đổi này chỉ thêm contract/ABI và kiểm thử. Backend/frontend hiện chưa tự kiểm tra hash hoặc ngăn hiển thị dữ liệu MongoDB bị sửa. Bước tích hợp tiếp theo cần tính lại hash từ dữ liệu cần kiểm tra, so với hash đọc trực tiếp on-chain, đọc các tổng/trạng thái cùng block và xử lý khi RPC không xác minh được. Tên/mô tả vẫn bất biến ở contract hiện tại; chưa có API sửa metadata có chữ ký ví.

## Ví dụ ethers v6 khi triển khai thật

```js
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers'
import abi from './contracts/Crowdfunding.json'

// contractAddress phải là địa chỉ deploy thật trên Sepolia.
const provider = new BrowserProvider(window.ethereum)
await provider.send('eth_requestAccounts', [])
if ((await provider.getNetwork()).chainId !== 11155111n) {
  throw new Error('Hãy chuyển ví sang Ethereum Sepolia.')
}
const signer = await provider.getSigner()
const contract = new Contract(contractAddress, abi, signer)

const deadline = BigInt(Math.floor(new Date(values.deadline).getTime() / 1000))
const tx = await contract.createCampaign(
  values.title.trim(), values.description.trim(), parseEther(values.goalEth), deadline,
)
const receipt = await tx.wait()
// Với giao dịch ghi, tx không phải giá trị trả về Solidity.
// Đọc ID mới từ event đã xác nhận, tránh đoán campaignCount khi nhiều người cùng tạo.
let createdId
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
  try {
    const event = contract.interface.parseLog(log)
    if (event?.name === 'CampaignCreated') createdId = event.args.id
  } catch { /* Log không thuộc ABI này. */ }
}
if (createdId === undefined) throw new Error('Không tìm thấy event tạo chiến dịch.')

const c = await contract.getCampaign(createdId)
const uiCampaign = {
  id: createdId.toString(), // Giữ chuỗi để không mất độ chính xác ID lớn.
  owner: c.owner, title: c.title, description: c.description,
  goalEth: formatEther(c.goal), totalRaisedEth: formatEther(c.totalRaised),
  totalRefundedEth: formatEther(c.totalRefunded),
  deadline: new Date(Number(c.deadline) * 1000).toISOString(),
  withdrawn: c.withdrawn,
}

await (await contract.contribute(createdId, { value: parseEther('0.001') })).wait()
// Các lệnh riêng, gọi khi đủ điều kiện rồi tải lại dữ liệu:
// await (await contract.withdraw(createdId)).wait()
// await (await contract.refund(createdId)).wait()
```

Đoạn code trên minh họa lớp tích hợp, chưa được gắn vào UI hiện tại. Kiểm tra input ngày hợp lệ trước khi đổi sang BigInt; chỉ hỗ trợ ngày lịch trong phạm vi Date của frontend. So sánh tiền bằng bigint, ví dụ `c.totalRaised >= c.goal`; không đổi wei sang Number. Khi ánh xạ dữ liệu hiện có, thống nhất ID kiểu string và chuẩn hóa địa chỉ trước khi so sánh. Dữ liệu demo hiện dùng ID number và ví giả, cần thay lớp truy cập dữ liệu khi tích hợp thật.

`category`, ảnh/theme, bình luận và yêu thích hiện là dữ liệu ngoài chain. Khóa dữ liệu phụ nên gồm chain ID, địa chỉ contract và campaign ID để tránh trùng khi redeploy. Không dùng số dư contract làm totalRaised của một chiến dịch; không dùng deadline trên máy làm cơ sở quyết định quyền rút/hoàn. Hiển thị trạng thái chờ ký, chờ xác nhận và tải lại sau receipt hoặc khi đổi ví/mạng.

## Event và lỗi

| Event | Các trường |
| --- | --- |
| `CampaignCreated` | `id` indexed, `owner` indexed, `title`, `goal`, `deadline` |
| `ContributionReceived` | `id` indexed, `contributor` indexed, `amount`, `totalRaised` |
| `FundsWithdrawn` | `id` indexed, `owner` indexed, `amount` |
| `RefundClaimed` | `id` indexed, `contributor` indexed, `amount` |
| `CampaignHashRecorded` | `campaignId` indexed, `digest` |
| `PaymentReceipt` | `receiptId` indexed, `campaignId` indexed, `account` indexed, `kind` uint8, `amountWei`, `digest` |

ABI chứa custom errors để giải mã lỗi và hiển thị tiếng Việt:

| Nhóm lỗi | Tên lỗi |
| --- | --- |
| Dữ liệu tạo | `EmptyTitle`, `EmptyDescription`, `TitleTooLong`, `DescriptionTooLong`, `InvalidGoal`, `InvalidDeadline` |
| ID, góp và thời hạn | `CampaignNotFound`, `ReceiptNotFound`, `ZeroContribution`, `CampaignClosed`, `CampaignStillActive` |
| Rút | `NotCampaignOwner`, `GoalNotReached`, `AlreadyWithdrawn` |
| Hoàn | `GoalAlreadyReached`, `NoContribution`, `AlreadyRefunded` |
| Chuyển ETH/bảo vệ | `TransferFailed`, `ReentrantCall`, `DirectTransfersDisabled` |

Ví từ chối ký hoặc thiếu gas là lỗi ví/provider, không thuộc custom errors của contract. Giao dịch chuyển tiền bị từ chối thì revert toàn bộ, không đánh dấu đã rút/hoàn. Chỉ đánh dấu thành công trên UI sau receipt thành công.
