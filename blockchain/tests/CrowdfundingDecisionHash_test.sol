// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingDecisionHashTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function _expectedDecision(uint256 id, Crowdfunding.Campaign memory campaign, bytes32 reasonDigest) internal view returns (bytes32) {
        return keccak256(abi.encode(
            funding.DECISION_HASH_DOMAIN(), funding.HASH_VERSION(), block.chainid, address(funding),
            id, funding.proposalHash(id), uint8(campaign.approvalStatus), campaign.decidedBy,
            campaign.decidedAt, campaign.approvedAt, campaign.deadline, reasonDigest
        ));
    }

    function versionsAndProposalAliasAreExplicit() public {
        uint256 id = _submit(100);
        Assert.equal(funding.CONTRACT_VERSION(), 3, "Contract release version");
        Assert.equal(funding.CAMPAIGN_WORKFLOW(), "review-v1", "Review workflow marker");
        Assert.equal(funding.HASH_VERSION(), 2, "New hash schema version");
        Assert.equal(uint256(funding.proposalHash(id)), uint256(funding.campaignHash(id)), "Campaign hash aliases immutable proposal");
    }

    function approvalHashMatchesDecisionSchema() public {
        uint256 id = _submit(100);
        bytes32 proposal = funding.proposalHash(id);
        funding.approveCampaign(id);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        bytes32 expected = _expectedDecision(id, campaign, keccak256(bytes("")));
        Assert.equal(uint256(funding.decisionHash(id)), uint256(expected), "Approval commitment matches schema");
        Assert.equal(uint256(funding.approvalHash(id)), uint256(expected), "Approved convenience getter");
        Assert.equal(uint256(funding.proposalHash(id)), uint256(proposal), "Decision preserves original proposal");
        campaign.deadline++;
        Assert.ok(expected != _expectedDecision(id, campaign, keccak256(bytes(""))), "Changed deadline invalidates hash");
    }

    function rejectionHashBindsStatusActorTimeAndReason() public {
        uint256 id = _submit(100);
        funding.rejectCampaign(id, "Missing funding use plan");
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        bytes32 reason = keccak256(bytes(campaign.rejectionReason));
        bytes32 expected = _expectedDecision(id, campaign, reason);
        Assert.equal(uint256(funding.decisionHash(id)), uint256(expected), "Rejection commitment matches schema");
        Assert.equal(uint256(funding.approvalHash(id)), 0, "Rejected is not an approval");
        Assert.ok(expected != _expectedDecision(id, campaign, keccak256(bytes("Different rejection reason"))), "Reason is bound");
        campaign.decidedAt++;
        Assert.ok(expected != _expectedDecision(id, campaign, reason), "Time is bound");
        campaign.decidedAt--;
        campaign.decidedBy = address(1);
        Assert.ok(expected != _expectedDecision(id, campaign, reason), "Reviewer is bound");
    }

    function contractsAndChainIdsAreBoundIntoProposal() public {
        uint256 id = _submit(100);
        CrowdfundingHarness other = new CrowdfundingHarness(address(this));
        uint256 otherId = other.submitCampaign("Test campaign", "Test description", 100, 1 days);
        Assert.ok(funding.proposalHash(id) != other.proposalHash(otherId), "Contract address prevents cross-deployment reuse");
        bytes32 wrongChain = keccak256(abi.encode(
            funding.PROPOSAL_HASH_DOMAIN(), funding.HASH_VERSION(), block.chainid + 1,
            address(funding), id, address(this), uint256(100), uint256(1 days)
        ));
        Assert.ok(funding.proposalHash(id) != wrongChain, "Chain ID prevents cross-network reuse");
    }

    function decisionHashChangesWithApprovalVersusRejection() public {
        uint256 id = _submit(100);
        funding.approveCampaign(id);
        Crowdfunding.Campaign memory campaign = funding.getCampaign(id);
        bytes32 approval = funding.decisionHash(id);
        campaign.approvalStatus = Crowdfunding.ApprovalStatus.Rejected;
        Assert.ok(approval != _expectedDecision(id, campaign, keccak256(bytes(""))), "Approval status is bound");
    }
}
