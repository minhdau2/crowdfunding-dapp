// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @title Chung Tay crowdfunding with all-or-nothing settlement
/// @notice Amounts are wei, deadlines are Unix seconds, and campaign IDs start at 1.
/// @dev No administrator, fees, deadline edits, or cancellation mechanism.
contract Crowdfunding {
    enum CampaignStatus { Active, Successful, Unsuccessful }

    struct Campaign {
        address payable owner;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 totalRaised;
        uint256 totalRefunded;
        bool withdrawn;
    }

    // UTF-8 byte limits allow the current UI's 100/5,000 UTF-16 code units.
    uint256 public constant MAX_TITLE_BYTES = 300;
    uint256 public constant MAX_DESCRIPTION_BYTES = 15_000;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) internal _campaigns;
    mapping(uint256 => mapping(address => uint256)) private _contributions;
    mapping(uint256 => mapping(address => bool)) private _refunded;
    uint256 private _lock = 1;

    error CampaignNotFound(uint256 id);
    error EmptyTitle();
    error EmptyDescription();
    error TitleTooLong();
    error DescriptionTooLong();
    error InvalidGoal();
    error InvalidDeadline();
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

    event CampaignCreated(
        uint256 indexed id,
        address indexed owner,
        string title,
        uint256 goal,
        uint256 deadline
    );
    event ContributionReceived(
        uint256 indexed id,
        address indexed contributor,
        uint256 amount,
        uint256 totalRaised
    );
    event FundsWithdrawn(uint256 indexed id, address indexed owner, uint256 amount);
    event RefundClaimed(uint256 indexed id, address indexed contributor, uint256 amount);

    modifier nonReentrant() {
        if (_lock != 1) revert ReentrantCall();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @notice Create a campaign without sending a deposit.
    /// @dev The caller becomes owner. Title/description are public and immutable.
    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint256 deadline
    ) external nonReentrant returns (uint256 id) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();
        if (bytes(description).length == 0) revert EmptyDescription();
        if (bytes(description).length > MAX_DESCRIPTION_BYTES) revert DescriptionTooLong();
        if (goal == 0) revert InvalidGoal();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        id = ++campaignCount;
        _campaigns[id] = Campaign({
            owner: payable(msg.sender),
            title: title,
            description: description,
            goal: goal,
            deadline: deadline,
            totalRaised: 0,
            totalRefunded: 0,
            withdrawn: false
        });
        emit CampaignCreated(id, msg.sender, title, goal, deadline);
    }

    /// @notice Contribute ETH before the deadline, including after reaching the goal.
    /// @dev Owners may contribute to their own campaigns. Contributions accumulate.
    function contribute(uint256 id) external payable nonReentrant {
        Campaign storage campaign = _getCampaign(id);
        if (block.timestamp >= campaign.deadline) revert CampaignClosed(id);
        if (msg.value == 0) revert ZeroContribution();

        campaign.totalRaised += msg.value;
        _contributions[id][msg.sender] += msg.value;
        emit ContributionReceived(id, msg.sender, msg.value, campaign.totalRaised);
    }

    /// @notice Only the owner can withdraw, once, after a successful deadline.
    /// @dev Pays this campaign's historical total, never the contract-wide balance.
    function withdraw(uint256 id) external nonReentrant {
        Campaign storage campaign = _getCampaign(id);
        if (msg.sender != campaign.owner) revert NotCampaignOwner(id, msg.sender);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(id);
        if (campaign.totalRaised < campaign.goal) revert GoalNotReached(id);
        if (campaign.withdrawn) revert AlreadyWithdrawn(id);

        uint256 amount = campaign.totalRaised;
        campaign.withdrawn = true;
        (bool sent,) = campaign.owner.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit FundsWithdrawn(id, msg.sender, amount);
    }

    /// @notice Claim your entire contribution after a failed campaign deadline.
    /// @dev History is preserved; the refund flag prevents a duplicate payment.
    function refund(uint256 id) external nonReentrant {
        Campaign storage campaign = _getCampaign(id);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive(id);
        if (campaign.totalRaised >= campaign.goal) revert GoalAlreadyReached(id);
        uint256 amount = _contributions[id][msg.sender];
        if (amount == 0) revert NoContribution(id, msg.sender);
        if (_refunded[id][msg.sender]) revert AlreadyRefunded(id, msg.sender);

        _refunded[id][msg.sender] = true;
        campaign.totalRefunded += amount;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit RefundClaimed(id, msg.sender, amount);
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _getCampaign(id);
    }

    /// @notice Status does not change to a separate paid/refunded state.
    /// @dev Read withdrawn and refunded separately to display settlement history.
    function getCampaignStatus(uint256 id) external view returns (CampaignStatus) {
        Campaign storage campaign = _getCampaign(id);
        if (block.timestamp < campaign.deadline) return CampaignStatus.Active;
        return campaign.totalRaised >= campaign.goal
            ? CampaignStatus.Successful
            : CampaignStatus.Unsuccessful;
    }

    /// @notice Historical cumulative contribution, unchanged after a refund.
    function contributions(uint256 id, address contributor) external view returns (uint256) {
        _getCampaign(id);
        return _contributions[id][contributor];
    }

    function refunded(uint256 id, address contributor) external view returns (bool) {
        _getCampaign(id);
        return _refunded[id][contributor];
    }

    function getRefundableAmount(uint256 id, address contributor) external view returns (uint256) {
        Campaign storage campaign = _getCampaign(id);
        if (
            block.timestamp < campaign.deadline || campaign.totalRaised >= campaign.goal
                || _refunded[id][contributor]
        ) return 0;
        return _contributions[id][contributor];
    }

    /// @notice Accounted funds still held for this campaign, excluding forced ETH.
    function getAvailableFunds(uint256 id) external view returns (uint256) {
        Campaign storage campaign = _getCampaign(id);
        if (campaign.withdrawn) return 0;
        return campaign.totalRaised - campaign.totalRefunded;
    }

    function _getCampaign(uint256 id) internal view returns (Campaign storage) {
        if (id == 0 || id > campaignCount) revert CampaignNotFound(id);
        return _campaigns[id];
    }

    /// @dev Use contribute(id); plain ETH transfers cannot be assigned to a campaign.
    receive() external payable {
        revert DirectTransfersDisabled();
    }
}
