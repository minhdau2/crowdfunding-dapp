// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingReviewValidationTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function durationIsWholeDaysFromOneToNinety() public {
        uint256 first = funding.submitCampaign("Minimum", "Description", 1, 1 days);
        uint256 last = funding.submitCampaign("Maximum", "Description", 1, 90 days);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 1, 1 days - 1)), Crowdfunding.InvalidDuration.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 1, 1 days + 1)), Crowdfunding.InvalidDuration.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 1, 90 days + 1)), Crowdfunding.InvalidDuration.selector, 0);
        Assert.equal(funding.getCampaign(first).durationSeconds, 1 days, "Inclusive minimum");
        Assert.equal(funding.getCampaign(last).durationSeconds, 90 days, "Inclusive maximum");
        Assert.equal(funding.campaignCount(), 2, "Invalid durations do not consume IDs");
    }

    function rejectsEmptyShortBlankOrOversizedReason() public {
        uint256 id = _submit(100);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, "")), Crowdfunding.InvalidRejectionReason.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, "Too short")), Crowdfunding.InvalidRejectionReason.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, "          \t\n")), Crowdfunding.InvalidRejectionReason.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, string(new bytes(3001)))), Crowdfunding.InvalidRejectionReason.selector, 0);
        Assert.equal(uint256(funding.getCampaign(id).approvalStatus), 0, "Invalid rejection leaves proposal pending");
        Assert.equal(uint256(funding.decisionHash(id)), 0, "Invalid reason creates no commitment");
    }

    function reasonAllowsUtf8WithinByteLimit() public {
        uint256 id = _submit(100);
        funding.rejectCampaign(id, unicode"Thiếu thông tin về kế hoạch sử dụng vốn");
        Assert.equal(funding.getCampaign(id).rejectionReason, unicode"Thiếu thông tin về kế hoạch sử dụng vốn", "UTF-8 reason preserved");
    }

    function approvalAndHashGettersRejectMissingIds() public {
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.approveCampaign, (0)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (1, "Missing proposal reason")), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.proposalHash, (0)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.decisionHash, (1)), Crowdfunding.CampaignNotFound.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.approvalHash, (1)), Crowdfunding.CampaignNotFound.selector, 0);
        Assert.equal(funding.campaignCount(), 0, "No phantom proposals");
    }

    function oldCreateSelectorCannotBypassReview() public {
        (bool success,) = address(funding).call(abi.encodeWithSignature(
            "createCampaign(string,string,uint256,uint256)", "Old entry", "Attempt bypass", 100, block.timestamp + 1 days
        ));
        Assert.equal(success, false, "Old function does not exist");
        Assert.equal(funding.campaignCount(), 0, "Bypass cannot create an active campaign");
    }

    /// #value: 1
    function submittingWithEthIsRejected() public payable {
        (bool success,) = address(funding).call{value: 1}(abi.encodeCall(Crowdfunding.submitCampaign, ("t", "d", 100, 1 days)));
        Assert.equal(success, false, "Submission is nonpayable");
        Assert.equal(address(funding).balance, 0, "No pending deposits");
        Assert.equal(funding.campaignCount(), 0, "Rejected submit does not consume an ID");
    }
}
