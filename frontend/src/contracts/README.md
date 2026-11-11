# ABI cho frontend

`Crowdfunding.json` là mảng ABI thực được xuất từ `blockchain/contracts/Crowdfunding.sol`, compiler **0.8.34**, EVM **cancun**, optimizer **200 runs**. ABI có các hàm, tuple, event và custom error của source hiện tại; không chứa địa chỉ deploy.

```js
import { Contract } from 'ethers'
import abi from './contracts/Crowdfunding.json'
const contract = new Contract(contractAddress, abi, signerOrProvider)
```

Dùng mảng `abi` trực tiếp, không dùng `abi.abi`. Địa chỉ phải lấy từ receipt triển khai thật trên **Ethereum Sepolia (11155111)**; V1 tại `0xCe15C87F7D03325D9fcE8190f04Fcbc6a2a366F3` chưa có các hàm hash. ABI hiện tại xuất từ source V2, giữ các hàm/tuple cũ và thêm hash/biên lai; phải deploy V2 rồi lấy địa chỉ mới trước khi gọi các hàm mới. UI đã bỏ chế độ mô phỏng nhưng vẫn chờ adapter ví/API; có ABI không đồng nghĩa đã tích hợp giao dịch thật.

Quy ước tham số, trường dữ liệu và ví dụ tích hợp nằm ở [docs/contract-interface.md](../../../docs/contract-interface.md). Khi source thay đổi, compile và xuất ABI lại từ Compilation Details trong Remix rồi cập nhật cùng PR. Ghi nhận deploy tại `blockchain/deployments/` và chỉ dùng ABI khớp source của bản deploy đó.

Không đưa private key hoặc seed phrase vào mã nguồn hoặc cấu hình frontend.
