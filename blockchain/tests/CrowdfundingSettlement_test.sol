// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingSettlementTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    /// #value: 1000
    function fundedCampaignWaitsForDeadlineAndWithdrawsOnce() public payable {
        uint256 id = _create(500);
        funding.contribute{value: 1000}(id);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (id)), Crowdfunding.CampaignStillActive.selector, 0);
        Assert.equal(uint256(funding.getCampaignStatus(id)), 0, "Still active despite sufficient funding");
        funding.setDeadlineForTest(id, block.timestamp);
        uint256 beforeBalance = address(this).balance;
        funding.withdraw(id);
        Assert.equal(address(this).balance, beforeBalance + 1000, "Owner receives all raised funds");
        Assert.equal(funding.getCampaign(id).withdrawn, true, "Withdrawal recorded");
        Assert.equal(funding.getAvailableFunds(id), 0, "Nothing left to withdraw");
        Assert.equal(funding.getCampaign(id).totalRaised, 1000, "History is preserved");
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (id)), Crowdfunding.AlreadyWithdrawn.selector, 0);
    }

    /// #value: 300
    function onlyOwnerWithdrawsAndCannotTakeOtherCampaignFunds() public payable {
        FundingActor owner = new FundingActor();
        uint256 first = owner.create(funding, 100, 1 days);
        funding.approveCampaign(first);
        uint256 second = _create(1000);
        funding.contribute{value: 100}(first);
        funding.contribute{value: 200}(second);
        funding.setDeadlineForTest(first, block.timestamp);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (first)), Crowdfunding.NotCampaignOwner.selector, 0);
        owner.withdraw(funding, first);
        Assert.equal(address(owner).balance, 100, "Only this campaign is paid out");
        Assert.equal(address(funding).balance, 200, "Other campaign remains funded");
        Assert.equal(funding.getAvailableFunds(second), 200, "Other accounting unchanged");
    }

    /// #value: 500
    function refundsFailedCampaignPerWalletOnce() public payable {
        uint256 id = _create(1000);
        FundingActor alice = new FundingActor();
        FundingActor bob = new FundingActor();
        alice.contribute{value: 200}(funding, id);
        bob.contribute{value: 300}(funding, id);
        Assert.equal(funding.getRefundableAmount(id, address(alice)), 0, "Cannot claim before deadline");
        funding.setDeadlineForTest(id, block.timestamp);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (id)), Crowdfunding.GoalNotReached.selector, 0);
        Assert.equal(funding.getRefundableAmount(id, address(alice)), 200, "Correct refundable amount");
        alice.refund(funding, id);
        Assert.equal(address(alice).balance, 200, "Alice paid her contribution");
        Assert.equal(funding.getRefundableAmount(id, address(alice)), 0, "Cannot claim again");
        Assert.equal(funding.refunded(id, address(alice)), true, "Refund flag set");
        Assert.equal(funding.contributions(id, address(alice)), 200, "Contribution history kept");
        Assert.equal(funding.getCampaign(id).totalRaised, 500, "Raised history kept");
        Assert.equal(funding.getCampaign(id).totalRefunded, 200, "Refund history updated");
        _expectRevert(address(alice), abi.encodeCall(FundingActor.refund, (funding, id)), Crowdfunding.AlreadyRefunded.selector, 0);
        bob.refund(funding, id);
        Assert.equal(address(bob).balance, 300, "Bob paid separately");
        Assert.equal(funding.getAvailableFunds(id), 0, "All campaign funds returned");
        Assert.equal(address(funding).balance, 0, "Escrow emptied by claims");
        Assert.equal(uint256(funding.getCampaignStatus(id)), 2, "Historical outcome remains failed");
    }

    /// #value: 100
    function rejectsRefundBeforeDeadlineAndAfterSuccess() public payable {
        uint256 id = _create(100);
        funding.contribute{value: 100}(id);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (id)), Crowdfunding.CampaignStillActive.selector, 0);
        funding.setDeadlineForTest(id, block.timestamp);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (id)), Crowdfunding.GoalAlreadyReached.selector, 0);
        Assert.equal(funding.getRefundableAmount(id, address(this)), 0, "Successful contribution is not refundable");
        Assert.equal(uint256(funding.getCampaignStatus(id)), 1, "Equality reaches goal");
    }

    function rejectsRefundWithoutContribution() public {
        uint256 id = _create(100);
        funding.setDeadlineForTest(id, block.timestamp);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (id)), Crowdfunding.NoContribution.selector, 0);
        Assert.equal(funding.getRefundableAmount(id, address(this)), 0, "No contribution means no refund");
    }

    /// #value: 99
    function oneWeiBelowGoalFails() public payable {
        uint256 id = _create(100);
        funding.contribute{value: 99}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        Assert.equal(uint256(funding.getCampaignStatus(id)), 2, "One wei short still fails");
        Assert.equal(funding.getRefundableAmount(id, address(this)), 99, "All contributed wei can be refunded");
    }
}
