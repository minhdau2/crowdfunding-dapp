// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingApprovalTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function submittedProposalStartsPendingWithoutDeadline() public {
        uint256 id = _submit(100);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        Assert.equal(uint256(campaign.approvalStatus), 0, "Pending approval");
        Assert.equal(uint256(funding.getCampaignStatus(id)), 3, "Pending is not a failed fundraiser");
        Assert.equal(campaign.deadline, 0, "No deadline while pending");
        Assert.equal(campaign.approvedAt, 0, "Not approved");
        Assert.equal(campaign.submittedAt, block.timestamp, "Submission time recorded");
        Assert.equal(campaign.durationSeconds, 1 days, "Duration recorded in seconds");
        Assert.equal(campaign.decidedBy, address(0), "No decision actor yet");
        Assert.equal(campaign.decidedAt, 0, "No decision time yet");
        Assert.equal(uint256(funding.decisionHash(id)), 0, "No decision hash while pending");
        Assert.equal(uint256(funding.approvalHash(id)), 0, "No approval commitment yet");
    }

    /// #value: 100
    function pendingBlocksEveryPaymentPath() public payable {
        uint256 id = _submit(100);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contribute, (id)), Crowdfunding.CampaignNotApproved.selector, 100);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (id)), Crowdfunding.CampaignNotApproved.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (id)), Crowdfunding.CampaignNotApproved.selector, 0);
        Assert.equal(address(funding).balance, 0, "No deposit retained");
        Assert.equal(funding.receiptCount(), 0, "No fake payment receipts");
        Assert.equal(funding.getRefundableAmount(id, address(this)), 0, "Pending has no refund");
        Assert.equal(funding.getAvailableFunds(id), 0, "Pending has no funds");
    }

    function approvalStartsTheFullDurationAndPreservesTerms() public {
        uint256 id = _submit(100);
        bytes32 proposal = funding.proposalHash(id);
        funding.approveCampaign(id);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        Assert.equal(uint256(campaign.approvalStatus), 1, "Approved");
        Assert.equal(campaign.approvedAt, block.timestamp, "Starts at approval block");
        Assert.equal(campaign.deadline, block.timestamp + 1 days, "Full duration from approval");
        Assert.equal(campaign.decidedBy, address(this), "Actual reviewer recorded");
        Assert.equal(campaign.decidedAt, block.timestamp, "Decision time recorded");
        Assert.equal(campaign.goal, 100, "Goal unchanged");
        Assert.equal(campaign.title, "Test campaign", "Title unchanged");
        Assert.equal(uint256(funding.proposalHash(id)), uint256(proposal), "Proposal hash is not overwritten");
        Assert.equal(uint256(funding.getCampaignStatus(id)), 0, "Approved campaign is active");
    }

    function rejectionIsPermanentAndKeepsReason() public {
        uint256 id = _submit(100);
        funding.rejectCampaign(id, "Incomplete project information");
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        Assert.equal(uint256(campaign.approvalStatus), 2, "Rejected");
        Assert.equal(uint256(funding.getCampaignStatus(id)), 4, "Rejected is a distinct status");
        Assert.equal(campaign.rejectionReason, "Incomplete project information", "Public reason is recorded");
        Assert.equal(campaign.deadline, 0, "Rejected proposal never starts");
        Assert.equal(campaign.approvedAt, 0, "Never approved");
        Assert.equal(campaign.decidedBy, address(this), "Decision actor recorded");
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.approveCampaign, (id)), Crowdfunding.CampaignNotPending.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, "Another rejection reason")), Crowdfunding.CampaignNotPending.selector, 0);
        uint256 resubmitted = _submit(100);
        Assert.equal(resubmitted, id + 1, "Resubmission needs a new proposal ID");
    }

    function unauthorizedWalletCannotApproveOrReject() public {
        uint256 id = _submit(100);
        FundingActor outsider = new FundingActor();
        _expectRevert(address(outsider), abi.encodeCall(FundingActor.approve, (funding, id)), Crowdfunding.NotReviewer.selector, 0);
        _expectRevert(address(outsider), abi.encodeCall(FundingActor.reject, (funding, id, "Unauthorized rejection")), Crowdfunding.NotReviewer.selector, 0);
        Assert.equal(uint256(funding.getCampaign(id).approvalStatus), 0, "Unauthorized calls keep it pending");
        Assert.equal(uint256(funding.decisionHash(id)), 0, "No unauthorized decision hash");
    }

    function approvedTermsCannotBeDecidedAgain() public {
        uint256 id = _create(100);
        uint256 deadline = funding.getCampaign(id).deadline;
        bytes32 decision = funding.decisionHash(id);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.approveCampaign, (id)), Crowdfunding.CampaignNotPending.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.rejectCampaign, (id, "Cannot cancel after approval")), Crowdfunding.CampaignNotPending.selector, 0);
        Assert.equal(funding.getCampaign(id).deadline, deadline, "Deadline cannot be extended by reapproval");
        Assert.equal(uint256(funding.decisionHash(id)), uint256(decision), "Decision hash remains fixed");
    }

    /// #value: 100
    function rejectedBlocksEveryPaymentPath() public payable {
        uint256 id = _submit(100);
        funding.rejectCampaign(id, "Project proposal is incomplete");
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.contribute, (id)), Crowdfunding.CampaignNotApproved.selector, 100);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.withdraw, (id)), Crowdfunding.CampaignNotApproved.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.refund, (id)), Crowdfunding.CampaignNotApproved.selector, 0);
        Assert.equal(funding.receiptCount(), 0, "Rejection creates no payment receipt");
        Assert.equal(address(funding).balance, 0, "Rejected ETH not retained");
    }
}
