// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @title Chung Tay: gọi vốn cộng đồng, duyệt trên chuỗi và quyết toán theo mục tiêu
/// @notice Tiền tính bằng wei (1 ETH = 10^18 wei); thời gian tính bằng giây; ID bắt đầu từ 1.
/// @dev Người duyệt không được rút tiền thay chủ chiến dịch. Không thu phí, hủy hoặc sửa chiến dịch.
contract Crowdfunding {
    // Loại biên nhận: góp vốn=0, rút tiền=1, hoàn tiền=2.
    enum PaymentKind { Contribution, Withdrawal, Refund }
    // Trạng thái duyệt: chờ=0, được duyệt=1, bị từ chối=2.
    enum ApprovalStatus { Pending, Approved, Rejected }
    // Giữ nguyên mã trạng thái quyết toán cũ: Active=0, Successful=1, Unsuccessful=2.
    enum CampaignStatus { Active, Successful, Unsuccessful, Pending, Rejected }

    struct Campaign {
        // Ví chủ chiến dịch; chỉ ví này được rút khi đủ điều kiện.
        address payable owner;
        // Tên chiến dịch được lưu trên chuỗi và không có hàm sửa trong bản này.
        string title;
        // Mô tả được lưu trên chuỗi và không có hàm sửa trong bản này.
        string description;
        // Mục tiêu gọi vốn, đơn vị wei, cố định khi gửi duyệt.
        uint256 goal;
        // Hạn chót Unix giây; bằng 0 khi chưa được duyệt.
        uint256 deadline;
        // Tổng ETH từng nhận, đơn vị wei; giữ nguyên sau khi rút hoặc hoàn tiền.
        uint256 totalRaised;
        // Tổng ETH đã hoàn cho các ví góp, đơn vị wei.
        uint256 totalRefunded;
        // Đánh dấu chủ chiến dịch đã rút tiền, chặn rút lần hai.
        bool withdrawn;
        // Thời lượng gọi vốn; bắt đầu tính khi duyệt, không phải khi gửi.
        uint256 durationSeconds;
        // Thời điểm gửi chiến dịch, theo timestamp của block.
        uint256 submittedAt;
        // Thời điểm được duyệt; bằng 0 nếu chưa duyệt hoặc bị từ chối.
        uint256 approvedAt;
        // Trạng thái xét duyệt, tách biệt trạng thái thành công/thất bại.
        ApprovalStatus approvalStatus;
        // Lý do từ chối công khai; rỗng nếu chưa bị từ chối.
        string rejectionReason;
        // Ví thực sự đã duyệt hoặc từ chối; giữ để đối chiếu sau khi đổi reviewer.
        address decidedBy;
        // Thời điểm quyết định duyệt hoặc từ chối.
        uint256 decidedAt;
    }

    // Phiên bản hợp đồng, luồng nghiệp vụ và cấu trúc hash để frontend chọn đúng cách giải mã.
    uint256 public constant CONTRACT_VERSION = 3;
    string public constant CAMPAIGN_WORKFLOW = "review-v1";
    uint256 public constant HASH_VERSION = 2;
    // Miền hash tách đề xuất, quyết định và biên nhận để tránh nhầm loại dữ liệu.
    // Hash giúp đối chiếu tính toàn vẹn; không mã hóa hoặc che giấu dữ liệu công khai.
    bytes32 public constant PROPOSAL_HASH_DOMAIN = keccak256("CHUNG_TAY_PROPOSAL");
    bytes32 public constant DECISION_HASH_DOMAIN = keccak256("CHUNG_TAY_DECISION");
    bytes32 public constant RECEIPT_HASH_DOMAIN = keccak256("CHUNG_TAY_RECEIPT");
    // Giới hạn chuỗi tính theo byte UTF-8, không phải số ký tự tiếng Việt.
    uint256 public constant MAX_TITLE_BYTES = 300;
    uint256 public constant MAX_DESCRIPTION_BYTES = 15_000;
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 90 days;
    uint256 public constant MIN_REASON_BYTES = 10;
    uint256 public constant MAX_REASON_BYTES = 3_000;

    // Chỉ một ví duyệt hiện tại; pendingReviewer là ví đang được đề cử, chưa có quyền.
    address public reviewer;
    address public pendingReviewer;
    // Bộ đếm ID chiến dịch và biên nhận; receiptCount dùng chung cho mọi chiến dịch/loại thanh toán.
    uint256 public campaignCount;
    uint256 public receiptCount;
    // Dữ liệu tách theo ID chiến dịch; số tiền góp và cờ hoàn tiền tách tiếp theo địa chỉ ví.
    // private/internal giới hạn truy cập trong Solidity, không làm dữ liệu bí mật trên blockchain.
    mapping(uint256 => Campaign) internal _campaigns;
    mapping(uint256 => mapping(address => uint256)) private _contributions;
    mapping(uint256 => mapping(address => bool)) private _refunded;
    mapping(uint256 => bytes32) private _proposalHashes;
    mapping(uint256 => bytes32) private _decisionHashes;
    mapping(uint256 => bytes32) private _receiptHashes;
    uint256 private _lock = 1;

    // Lỗi có cấu trúc: frontend dùng ABI để giải mã và hiển thị thông báo tiếng Việt.
    error InvalidReviewer();
    error NotReviewer(address caller);
    error NotPendingReviewer(address caller);
    error CampaignNotFound(uint256 id);
    error CampaignNotPending(uint256 id);
    error CampaignNotApproved(uint256 id);
    error EmptyTitle();
    error EmptyDescription();
    error TitleTooLong();
    error DescriptionTooLong();
    error InvalidGoal();
    error InvalidDuration();
    error InvalidRejectionReason();
    error ZeroContribution();
    error CampaignClosed(uint256 id);
    error CampaignStillActive(uint256 id);
    error NotCampaignOwner(uint256 id, address caller);
    error GoalNotReached(uint256 id);
    error GoalAlreadyReached(uint256 id);
    error AlreadyWithdrawn(uint256 id);
    error NoContribution(uint256 id, address contributor);
    error AlreadyRefunded(uint256 id, address contributor);
    error TransferFailed();
    error ReentrantCall();
    error DirectTransfersDisabled();
    error ReceiptNotFound(uint256 receiptId);

    // Event là nhật ký giao dịch để frontend/backend theo dõi; chỉ đồng bộ sau khi giao dịch thành công.
    event ReviewerTransferStarted(address indexed previousReviewer, address indexed proposedReviewer);
    event ReviewerTransferCancelled(address indexed reviewer, address indexed cancelledReviewer);
    event ReviewerTransferred(address indexed previousReviewer, address indexed newReviewer);
    event CampaignSubmitted(uint256 indexed id, address indexed owner, string title, uint256 goal, uint256 durationSeconds);
    event CampaignApproved(uint256 indexed id, address indexed reviewer, uint256 approvedAt, uint256 deadline);
    event CampaignRejected(uint256 indexed id, address indexed reviewer, string reason, uint256 decidedAt);
    event ProposalHashRecorded(uint256 indexed campaignId, bytes32 digest);
    event DecisionHashRecorded(uint256 indexed campaignId, ApprovalStatus status, bytes32 digest);
    event ContributionReceived(uint256 indexed id, address indexed contributor, uint256 amount, uint256 totalRaised);
    event FundsWithdrawn(uint256 indexed id, address indexed owner, uint256 amount);
    event RefundClaimed(uint256 indexed id, address indexed contributor, uint256 amount);
    event PaymentReceipt(
        uint256 indexed receiptId, uint256 indexed campaignId, address indexed account,
        PaymentKind kind, uint256 amountWei, bytes32 digest
    );

    /// @notice Thiết lập ví duyệt ban đầu khi deploy; không chấp nhận địa chỉ 0.
    constructor(address initialReviewer) {
        if (initialReviewer == address(0)) revert InvalidReviewer();
        reviewer = initialReviewer;
        emit ReviewerTransferred(address(0), initialReviewer);
    }

    // Chặn gọi lồng lại trong lúc thao tác chưa kết thúc, đặc biệt khi chuyển ETH ra ngoài.
    modifier nonReentrant() {
        if (_lock != 1) revert ReentrantCall();
        _lock = 2;
        _;
        _lock = 1;
    }

    // Kiểm tra quyền bằng msg.sender trên chuỗi, không dựa vào vai trò frontend hoặc MongoDB.
    modifier onlyReviewer() {
        if (msg.sender != reviewer) revert NotReviewer(msg.sender);
        _;
    }

    /// @notice Kiểm tra một địa chỉ có phải ví duyệt hiện tại hay không.
    function isReviewer(address account) external view returns (bool) { return account == reviewer; }

    /// @notice Đề cử ví duyệt mới; ví đó chỉ có quyền sau khi tự gọi acceptReviewer.
    function proposeReviewer(address nextReviewer) external nonReentrant onlyReviewer {
        if (nextReviewer == address(0) || nextReviewer == reviewer) revert InvalidReviewer();
        pendingReviewer = nextReviewer;
        emit ReviewerTransferStarted(reviewer, nextReviewer);
    }

    /// @notice Ví duyệt hiện tại hủy đề cử đang chờ.
    function cancelReviewerTransfer() external nonReentrant onlyReviewer {
        address cancelled = pendingReviewer;
        if (cancelled == address(0)) revert InvalidReviewer();
        pendingReviewer = address(0);
        emit ReviewerTransferCancelled(reviewer, cancelled);
    }

    /// @notice Ví được đề cử nhận quyền; ví duyệt cũ mất quyền ngay trong giao dịch này.
    function acceptReviewer() external nonReentrant {
        if (msg.sender != pendingReviewer) revert NotPendingReviewer(msg.sender);
        address previous = reviewer;
        reviewer = msg.sender;
        pendingReviewer = address(0);
        emit ReviewerTransferred(previous, msg.sender);
    }

    /// @notice Gửi chiến dịch chờ duyệt; các điều khoản được cố định, chưa nhận ETH và chưa có hạn chót.
    /// @dev Thay createCampaign; tham số cuối là thời lượng nguyên ngày (1–90 ngày), không phải mốc Unix.
    function submitCampaign(
        string calldata title, string calldata description, uint256 goal, uint256 durationSeconds
    ) external nonReentrant returns (uint256 id) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();
        if (bytes(description).length == 0) revert EmptyDescription();
        if (bytes(description).length > MAX_DESCRIPTION_BYTES) revert DescriptionTooLong();
        if (goal == 0) revert InvalidGoal();
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION || durationSeconds % 1 days != 0) {
            revert InvalidDuration();
        }
        id = ++campaignCount;
        Campaign storage campaign = _campaigns[id];
        campaign.owner = payable(msg.sender);
        campaign.title = title;
        campaign.description = description;
        campaign.goal = goal;
        campaign.durationSeconds = durationSeconds;
        campaign.submittedAt = block.timestamp;
        // Các trường còn lại mặc định bằng 0: chờ duyệt, chưa có hạn chót và chưa nhận góp vốn.
        // Hash ràng buộc phiên bản, mạng, hợp đồng, ID, chủ sở hữu, mục tiêu và thời lượng.
        // Tên/mô tả không nằm trong hash tài chính này; bản hợp đồng này vẫn không cho sửa hai trường đó.
        bytes32 digest = keccak256(abi.encode(
            PROPOSAL_HASH_DOMAIN, HASH_VERSION, block.chainid, address(this),
            id, msg.sender, goal, durationSeconds
        ));
        _proposalHashes[id] = digest;
        emit ProposalHashRecorded(id, digest);
        emit CampaignSubmitted(id, msg.sender, title, goal, durationSeconds);
    }

    /// @notice Duyệt một lần; hạn chót = thời điểm block duyệt + thời lượng đã đăng ký.
    /// @dev Hợp đồng cho phép người duyệt tự duyệt chiến dịch của mình.
    function approveCampaign(uint256 id) external nonReentrant onlyReviewer {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.approvalStatus != ApprovalStatus.Pending) revert CampaignNotPending(id);
        campaign.approvalStatus = ApprovalStatus.Approved;
        campaign.approvedAt = block.timestamp;
        campaign.deadline = block.timestamp + campaign.durationSeconds;
        campaign.decidedBy = msg.sender;
        campaign.decidedAt = block.timestamp;
        _recordDecisionHash(id, campaign);
        emit CampaignApproved(id, msg.sender, campaign.approvedAt, campaign.deadline);
    }

    /// @notice Từ chối vĩnh viễn chiến dịch chờ duyệt; lý do được công khai trên blockchain.
    function rejectCampaign(uint256 id, string calldata reason) external nonReentrant onlyReviewer {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.approvalStatus != ApprovalStatus.Pending) revert CampaignNotPending(id);
        bytes calldata text = bytes(reason);
        if (text.length < MIN_REASON_BYTES || text.length > MAX_REASON_BYTES) revert InvalidRejectionReason();
        // Yêu cầu có byte lớn hơn 32 để chặn chuỗi chỉ chứa khoảng trắng/ký tự điều khiển ASCII.
        // Đây không phải bộ kiểm tra mọi loại khoảng trắng Unicode.
        bool visible;
        for (uint256 i; i < text.length; ++i) {
            if (uint8(text[i]) > 32) { visible = true; break; }
        }
        if (!visible) revert InvalidRejectionReason();
        campaign.approvalStatus = ApprovalStatus.Rejected;
        campaign.rejectionReason = reason;
        campaign.decidedBy = msg.sender;
        campaign.decidedAt = block.timestamp;
        _recordDecisionHash(id, campaign);
        emit CampaignRejected(id, msg.sender, reason, campaign.decidedAt);
    }

    /// @notice Góp ETH lớn hơn 0 vào chiến dịch đã duyệt và chưa hết hạn; có thể góp nhiều lần hoặc vượt mục tiêu.
    function contribute(uint256 id) external payable nonReentrant {
        Campaign storage campaign = _getApprovedCampaign(id);
        if (block.timestamp >= campaign.deadline) revert CampaignClosed(id);
        if (msg.value == 0) revert ZeroContribution();
        campaign.totalRaised += msg.value;
        _contributions[id][msg.sender] += msg.value;
        _recordReceipt(id, PaymentKind.Contribution, msg.sender, msg.value);
        emit ContributionReceived(id, msg.sender, msg.value, campaign.totalRaised);
    }

    /// @notice Chỉ chủ chiến dịch được rút một lần, sau hạn chót và khi tổng góp đạt mục tiêu.
    /// @dev Đạt mục tiêu sớm vẫn phải chờ hết hạn; reviewer không được rút thay.
    function withdraw(uint256 id) external nonReentrant {
        Campaign storage campaign = _getApprovedCampaign(id);
        if (msg.sender != campaign.owner) revert NotCampaignOwner(id, msg.sender);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(id);
        if (campaign.totalRaised < campaign.goal) revert GoalNotReached(id);
        if (campaign.withdrawn) revert AlreadyWithdrawn(id);
        uint256 amount = campaign.totalRaised;
        campaign.withdrawn = true;
        _recordReceipt(id, PaymentKind.Withdrawal, msg.sender, amount);
        // Đánh dấu đã rút trước khi gọi ví nhận; nếu ví từ chối ETH thì revert cả giao dịch.
        (bool sent,) = campaign.owner.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit FundsWithdrawn(id, msg.sender, amount);
    }

    /// @notice Sau hạn chót, nếu không đạt mục tiêu, mỗi ví tự yêu cầu hoàn toàn bộ tiền mình đã góp.
    /// @dev Không tự chuyển tiền theo lịch; người góp phải gọi hàm và trả phí giao dịch.
    function refund(uint256 id) external nonReentrant {
        Campaign storage campaign = _getApprovedCampaign(id);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(id);
        if (campaign.totalRaised >= campaign.goal) revert GoalAlreadyReached(id);
        uint256 amount = _contributions[id][msg.sender];
        if (amount == 0) revert NoContribution(id, msg.sender);
        if (_refunded[id][msg.sender]) revert AlreadyRefunded(id, msg.sender);
        _refunded[id][msg.sender] = true;
        campaign.totalRefunded += amount;
        _recordReceipt(id, PaymentKind.Refund, msg.sender, amount);
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit RefundClaimed(id, msg.sender, amount);
    }

    /// @notice Đọc đầy đủ dữ liệu chiến dịch; ID không tồn tại sẽ bị từ chối.
    function getCampaign(uint256 id) external view returns (Campaign memory) { return _getCampaign(id); }

    /// @notice Suy ra trạng thái từ quyết định duyệt, thời gian block và mục tiêu.
    /// @dev Mã trả về: đang gọi vốn=0, thành công=1, thất bại=2, chờ duyệt=3, bị từ chối=4.
    function getCampaignStatus(uint256 id) external view returns (CampaignStatus) {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.approvalStatus == ApprovalStatus.Pending) return CampaignStatus.Pending;
        if (campaign.approvalStatus == ApprovalStatus.Rejected) return CampaignStatus.Rejected;
        if (block.timestamp < campaign.deadline) return CampaignStatus.Active;
        return campaign.totalRaised >= campaign.goal ? CampaignStatus.Successful : CampaignStatus.Unsuccessful;
    }

    /// @notice Đọc tổng tiền ví từng góp; hoàn tiền không xóa lịch sử này.
    function contributions(uint256 id, address contributor) external view returns (uint256) {
        _getCampaign(id);
        return _contributions[id][contributor];
    }

    /// @notice Kiểm tra ví đã nhận hoàn tiền của chiến dịch này hay chưa.
    function refunded(uint256 id, address contributor) external view returns (bool) {
        _getCampaign(id);
        return _refunded[id][contributor];
    }

    /// @notice Số wei ví còn được hoàn; trả 0 nếu chưa đủ điều kiện hoặc đã hoàn.
    function getRefundableAmount(uint256 id, address contributor) external view returns (uint256) {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.approvalStatus != ApprovalStatus.Approved || block.timestamp < campaign.deadline
            || campaign.totalRaised >= campaign.goal || _refunded[id][contributor]) return 0;
        return _contributions[id][contributor];
    }

    /// @notice Số wei còn được hạch toán cho chiến dịch; không đồng nghĩa chủ chiến dịch được rút ngay.
    function getAvailableFunds(uint256 id) external view returns (uint256) {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.approvalStatus != ApprovalStatus.Approved || campaign.withdrawn) return 0;
        return campaign.totalRaised - campaign.totalRefunded;
    }

    /// @notice Đọc hash đề xuất cố định từ lúc gửi chiến dịch.
    function proposalHash(uint256 id) public view returns (bytes32) {
        _getCampaign(id);
        return _proposalHashes[id];
    }

    /// @notice Ở V3, đây là tên gọi khác của proposalHash; cấu trúc hash khác campaignHash của V2.
    function campaignHash(uint256 id) external view returns (bytes32) { return proposalHash(id); }

    /// @notice Bằng 0 khi chờ duyệt; sau quyết định lưu hash duyệt/từ chối, không ghi đè hash đề xuất.
    function decisionHash(uint256 id) external view returns (bytes32) {
        _getCampaign(id);
        return _decisionHashes[id];
    }

    /// @notice Trả hash quyết định nếu đã duyệt; các trường hợp khác trả 0.
    function approvalHash(uint256 id) external view returns (bytes32) {
        Campaign storage campaign = _getCampaign(id);
        return campaign.approvalStatus == ApprovalStatus.Approved ? _decisionHashes[id] : bytes32(0);
    }

    /// @notice Đọc hash biên nhận theo ID toàn cục; ID chưa tồn tại sẽ bị từ chối.
    function receiptHash(uint256 receiptId) external view returns (bytes32) {
        if (receiptId == 0 || receiptId > receiptCount) revert ReceiptNotFound(receiptId);
        return _receiptHashes[receiptId];
    }

    // Hash quyết định gắn với đề xuất, trạng thái, ví quyết định, các mốc thời gian và hash lý do.
    // Dùng abi.encode theo đúng thứ tự/kiểu dữ liệu; phía tích hợp phải tính cùng cấu trúc.
    function _recordDecisionHash(uint256 id, Campaign storage campaign) private {
        bytes32 digest = keccak256(abi.encode(
            DECISION_HASH_DOMAIN, HASH_VERSION, block.chainid, address(this), id, _proposalHashes[id],
            uint8(campaign.approvalStatus), campaign.decidedBy, campaign.decidedAt,
            campaign.approvedAt, campaign.deadline, keccak256(bytes(campaign.rejectionReason))
        ));
        _decisionHashes[id] = digest;
        emit DecisionHashRecorded(id, campaign.approvalStatus, digest);
    }

    // Ghi trạng thái trước khi chuyển ETH. Nếu chuyển thất bại, toàn bộ ID/hash/event biên nhận cũng bị hoàn tác.
    function _recordReceipt(uint256 campaignId, PaymentKind kind, address account, uint256 amountWei) private {
        uint256 receiptId = ++receiptCount;
        bytes32 digest = keccak256(abi.encode(
            RECEIPT_HASH_DOMAIN, HASH_VERSION, block.chainid, address(this),
            receiptId, uint8(kind), campaignId, account, amountWei
        ));
        _receiptHashes[receiptId] = digest;
        emit PaymentReceipt(receiptId, campaignId, account, kind, amountWei, digest);
    }

    // Chặn ID 0 hoặc vượt số chiến dịch đã tạo trước khi đọc storage.
    function _getCampaign(uint256 id) internal view returns (Campaign storage) {
        if (id == 0 || id > campaignCount) revert CampaignNotFound(id);
        return _campaigns[id];
    }

    // Cổng kiểm tra chung: chỉ chiến dịch được duyệt mới có thể góp, rút hoặc hoàn tiền.
    function _getApprovedCampaign(uint256 id) private view returns (Campaign storage campaign) {
        campaign = _getCampaign(id);
        if (campaign.approvalStatus != ApprovalStatus.Approved) revert CampaignNotApproved(id);
    }

    // Chặn chuyển ETH thông thường trực tiếp vào hợp đồng; góp vốn phải qua contribute(id).
    // ETH bị ép gửi từ bên ngoài không tự được tính vào số tiền của bất kỳ chiến dịch nào.
    receive() external payable { revert DirectTransfersDisabled(); }
}
