// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingBasicsTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function createsSequentialCampaigns() public {
        uint256 id = _create(1000);
        uint256 second = _create(2000);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        Assert.equal(id, 1, "IDs start at one");
        Assert.equal(second, 2, "IDs increase");
        Assert.equal(funding.campaignCount(), 2, "Count is correct");
        Assert.equal(campaign.owner, address(this), "Caller is the owner");
        Assert.equal(campaign.goal, 1000, "Goal is wei");
        Assert.equal(campaign.totalRaised, 0, "Starts empty");
        Assert.equal(campaign.withdrawn, false, "Starts unwithdrawn");
    }

    function rejectsInvalidCreation() public {
        uint256 duration = 1 days;
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("", "d", 1, duration)), Crowdfunding.EmptyTitle.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "", 1, duration)), Crowdfunding.EmptyDescription.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 0, duration)), Crowdfunding.InvalidGoal.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 1, 0)), Crowdfunding.InvalidDuration.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 1, 91 days)), Crowdfunding.InvalidDuration.selector, 0);
        Assert.equal(funding.campaignCount(), 0, "Rejected creates do not consume IDs");
    }

    function enforcesTextByteLimits() public {
        uint256 duration = 1 days;
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, (string(new bytes(301)), "d", 1, duration)), Crowdfunding.TitleTooLong.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", string(new bytes(15001)), 1, duration)), Crowdfunding.DescriptionTooLong.selector, 0);
        Assert.equal(funding.campaignCount(), 0, "Oversized text is rejected");
    }

    function rejectsMissingCampaignIds() public {
        _create(1000);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.getCampaign, (0)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.getCampaignStatus, (2)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contributions, (2, address(this))), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refunded, (0, address(this))), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.getRefundableAmount, (2, address(this))), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.getAvailableFunds, (2)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (2)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (2)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contribute, (2)), Crowdfunding.CampaignNotFound.selector, 0);
        Assert.equal(funding.campaignCount(), 1, "Invalid calls do not change count");
    }

    /// #value: 1000
    function accumulatesContributionsAndIsolatesCampaigns() public payable {
        uint256 first = _create(500);
        uint256 second = _create(1000);
        FundingActor actor = new FundingActor();
        funding.contribute{value: 200}(first);
        funding.contribute{value: 300}(first);
        actor.contribute{value: 100}(funding, first);
        funding.contribute{value: 400}(second);
        Assert.equal(funding.getCampaign(first).totalRaised, 600, "Allows overfunding");
        Assert.equal(funding.contributions(first, address(this)), 500, "Accumulates one wallet");
        Assert.equal(funding.contributions(first, address(actor)), 100, "Tracks another wallet");
        Assert.equal(funding.getAvailableFunds(second), 400, "Keeps other campaign separate");
        Assert.equal(address(funding).balance, 1000, "Actual escrow balance matches");
    }

    /// #value: 100
    function closesAtExactDeadlineAndRejectsZero() public payable {
        uint256 id = _create(100);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contribute, (id)), Crowdfunding.ZeroContribution.selector, 0);
        funding.setDeadlineForTest(id, block.timestamp);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contribute, (id)), Crowdfunding.CampaignClosed.selector, 100);
        Assert.equal(funding.getCampaign(id).totalRaised, 0, "Rejected contribution is not counted");
        Assert.equal(address(funding).balance, 0, "Rejected contribution is not retained");
    }

    /// #value: 1
    function rejectsUnassignedEtherTransfers() public payable {
        _expectRevert(address(funding), "", Crowdfunding.DirectTransfersDisabled.selector, 1);
        Assert.equal(address(funding).balance, 0, "Plain transfer is rejected");
    }
}
