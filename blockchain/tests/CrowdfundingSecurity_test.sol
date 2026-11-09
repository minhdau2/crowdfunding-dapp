// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingSecurityTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    /// #value: 100
    function failedWithdrawalTransferRollsBackState() public payable {
        FundingActor owner = new FundingActor();
        uint256 id = owner.create(funding, 100, block.timestamp + 1 days);
        funding.contribute{value: 100}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        owner.setRejectEther(true);
        _expectRevert(address(owner), abi.encodeCall(FundingActor.withdraw, (funding, id)), Crowdfunding.TransferFailed.selector, 0);
        Assert.equal(funding.getCampaign(id).withdrawn, false, "Failed payment rolls back withdrawal flag");
        Assert.equal(funding.getAvailableFunds(id), 100, "Funds remain available");
        owner.setRejectEther(false);
        owner.withdraw(funding, id);
        Assert.equal(address(owner).balance, 100, "Owner can retry after fixing receiver");
    }

    /// #value: 100
    function failedRefundTransferRollsBackState() public payable {
        FundingActor contributor = new FundingActor();
        uint256 id = _create(200);
        contributor.contribute{value: 100}(funding, id);
        funding.setDeadlineForTest(id, block.timestamp);
        contributor.setRejectEther(true);
        _expectRevert(address(contributor), abi.encodeCall(FundingActor.refund, (funding, id)), Crowdfunding.TransferFailed.selector, 0);
        Assert.equal(funding.refunded(id, address(contributor)), false, "Failed payment rolls back refund flag");
        Assert.equal(funding.getCampaign(id).totalRefunded, 0, "Failed payment is not counted");
        Assert.equal(funding.getRefundableAmount(id, address(contributor)), 100, "Claim is not lost");
        contributor.setRejectEther(false);
        contributor.refund(funding, id);
        Assert.equal(address(contributor).balance, 100, "Contributor can retry");
    }

    /// #value: 300
    function blocksReentrantWithdrawal() public payable {
        FundingActor owner = new FundingActor();
        uint256 first = owner.create(funding, 100, block.timestamp + 1 days);
        uint256 second = _create(1000);
        funding.contribute{value: 100}(first);
        funding.contribute{value: 200}(second);
        funding.setDeadlineForTest(first, block.timestamp);
        owner.armReentry(funding, first, 1);
        owner.withdraw(funding, first);
        Assert.equal(owner.reentryAttempted(), true, "Malicious fallback tried reentry");
        Assert.equal(owner.reentrySucceeded(), false, "Reentry failed");
        Assert.equal(uint256(uint32(owner.reentryError())), uint256(uint32(Crowdfunding.ReentrantCall.selector)), "Guard rejected the nested call");
        Assert.equal(address(owner).balance, 100, "Only one payout");
        Assert.equal(funding.getAvailableFunds(second), 200, "Other campaign is safe");
    }

    /// #value: 100
    function blocksReentrantRefund() public payable {
        FundingActor contributor = new FundingActor();
        uint256 id = _create(200);
        contributor.contribute{value: 100}(funding, id);
        funding.setDeadlineForTest(id, block.timestamp);
        contributor.armReentry(funding, id, 2);
        contributor.refund(funding, id);
        Assert.equal(contributor.reentryAttempted(), true, "Malicious fallback tried refund again");
        Assert.equal(contributor.reentrySucceeded(), false, "Nested refund failed");
        Assert.equal(uint256(uint32(contributor.reentryError())), uint256(uint32(Crowdfunding.ReentrantCall.selector)), "Refund guard rejected the nested call");
        Assert.equal(address(contributor).balance, 100, "Only one refund");
        Assert.equal(funding.getCampaign(id).totalRefunded, 100, "Only one refund accounted");
    }
}
