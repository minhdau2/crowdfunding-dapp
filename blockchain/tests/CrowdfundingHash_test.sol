// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingHashTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function _expectedReceipt(
        uint256 receiptId, uint256 id, uint8 kind, address account, uint256 amount
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            funding.RECEIPT_HASH_DOMAIN(), funding.HASH_VERSION(), block.chainid,
            address(funding), receiptId, kind, id, account, amount
        ));
    }

    function campaignHashMatchesFinancialFields() public {
        uint256 id = _create(100);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        bytes32 expected = keccak256(abi.encode(
            funding.PROPOSAL_HASH_DOMAIN(), funding.HASH_VERSION(), block.chainid,
            address(funding), id, campaign.owner, campaign.goal, campaign.durationSeconds
        ));
        Assert.equal(uint256(funding.campaignHash(id)), uint256(expected), "Financial hash matches schema");
        bytes32 wrongGoal = keccak256(abi.encode(
            funding.PROPOSAL_HASH_DOMAIN(), funding.HASH_VERSION(), block.chainid,
            address(funding), id, campaign.owner, campaign.goal + 1, campaign.durationSeconds
        ));
        Assert.ok(expected != wrongGoal, "Changing goal by one wei invalidates hash");
    }

    function campaignIdsHaveDifferentHashes() public {
        uint256 first = _create(100);
        uint256 second = _create(100);
        Assert.ok(funding.campaignHash(first) != funding.campaignHash(second), "Campaign ID is bound into hash");
    }

    /// #value: 200
    function receiptsBindActualWalletAndAmount() public payable {
        uint256 id = _create(1000);
        FundingActor actor = new FundingActor();
        bytes32 initial = funding.campaignHash(id);
        funding.contribute{value: 40}(id);
        funding.contribute{value: 60}(id);
        actor.contribute{value: 100}(funding, id);

        Assert.equal(funding.receiptCount(), 3, "Each payment gets an ID");
        Assert.equal(uint256(funding.receiptHash(1)), uint256(_expectedReceipt(1, id, 0, address(this), 40)), "First payment");
        Assert.equal(uint256(funding.receiptHash(2)), uint256(_expectedReceipt(2, id, 0, address(this), 60)), "Repeated payment");
        Assert.equal(uint256(funding.receiptHash(3)), uint256(_expectedReceipt(3, id, 0, address(actor), 100)), "Actual sender");
        Assert.equal(uint256(funding.campaignHash(id)), uint256(initial), "Funding preserves immutable hash");
        Assert.equal(funding.contributions(id, address(this)), 100, "Wallet total remains correct");
        Assert.ok(funding.receiptHash(1) != _expectedReceipt(1, id, 0, address(this), 41), "Wrong amount rejected");
        Assert.ok(funding.receiptHash(1) != _expectedReceipt(1, id, 0, address(actor), 40), "Wrong wallet rejected");
        Assert.ok(funding.receiptHash(1) != _expectedReceipt(1, id + 1, 0, address(this), 40), "Wrong campaign rejected");
        Assert.ok(funding.receiptHash(1) != _expectedReceipt(1, id, 2, address(this), 40), "Wrong payment kind rejected");
    }

    /// #value: 100
    function withdrawalGetsReceipt() public payable {
        uint256 id = _create(100);
        funding.contribute{value: 100}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        funding.withdraw(id);

        Assert.equal(funding.receiptCount(), 2, "Withdrawal recorded");
        Assert.equal(uint256(funding.receiptHash(2)), uint256(_expectedReceipt(2, id, 1, address(this), 100)), "Withdrawal hash");
    }

    /// #value: 100
    function refundGetsReceipt() public payable {
        uint256 id = _create(200);
        funding.contribute{value: 100}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        funding.refund(id);

        Assert.equal(funding.receiptCount(), 2, "Refund recorded");
        Assert.equal(uint256(funding.receiptHash(2)), uint256(_expectedReceipt(2, id, 2, address(this), 100)), "Refund hash");
    }

    /// #value: 100
    function failedPaymentRollsBackReceipt() public payable {
        FundingActor owner = new FundingActor();
        uint256 id = owner.create(funding, 100, 1 days);
        funding.approveCampaign(id);
        funding.contribute{value: 100}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        owner.setRejectEther(true);

        _expectRevert(
            address(owner), abi.encodeCall(FundingActor.withdraw, (funding, id)),
            Crowdfunding.TransferFailed.selector, 0
        );
        Assert.equal(funding.receiptCount(), 1, "Failed payout cannot create receipt");
        _expectRevert(
            address(funding), abi.encodeCall(Crowdfunding.receiptHash, (2)),
            Crowdfunding.ReceiptNotFound.selector, 0
        );
    }

    /// #value: 100
    function failedRefundRollsBackReceipt() public payable {
        uint256 id = _create(200);
        FundingActor contributor = new FundingActor();
        contributor.contribute{value: 100}(funding, id);
        bytes32 contributionReceipt = funding.receiptHash(1);
        funding.setDeadlineForTest(id, block.timestamp);
        contributor.setRejectEther(true);

        _expectRevert(
            address(contributor), abi.encodeCall(FundingActor.refund, (funding, id)),
            Crowdfunding.TransferFailed.selector, 0
        );
        Assert.equal(funding.receiptCount(), 1, "Failed refund cannot create receipt");
        Assert.equal(uint256(funding.receiptHash(1)), uint256(contributionReceipt), "Original receipt preserved");
        contributor.setRejectEther(false);
        contributor.refund(funding, id);
        Assert.equal(funding.receiptCount(), 2, "Retry uses next receipt ID");
        Assert.equal(uint256(funding.receiptHash(2)), uint256(_expectedReceipt(2, id, 2, address(contributor), 100)), "Retried refund hash");
    }

    function missingIdsAreRejected() public {
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.campaignHash, (0)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.receiptHash, (0)), Crowdfunding.ReceiptNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.receiptHash, (1)), Crowdfunding.ReceiptNotFound.selector, 0);
        Assert.equal(funding.receiptCount(), 0, "No fabricated receipt");
    }
}
