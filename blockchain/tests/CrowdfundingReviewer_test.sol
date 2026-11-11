// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;
import "remix_tests.sol";
import "./helpers/CrowdfundingTestHelpers.sol";

contract CrowdfundingReviewerTest is CrowdfundingTestBase {
    function beforeEach() public { _reset(); }

    function reviewerTransferRequiresAcceptanceAndRevokesOldRole() public {
        uint256 id = _submit(100);
        FundingActor next = new FundingActor();
        funding.proposeReviewer(address(next));
        Assert.equal(funding.reviewer(), address(this), "Nomination does not transfer authority");
        Assert.equal(funding.isReviewer(address(next)), false, "Pending nominee has no authority");
        _expectRevert(address(next), abi.encodeCall(FundingActor.approve, (funding, id)), Crowdfunding.NotReviewer.selector, 0);
        next.accept(funding);
        Assert.equal(funding.reviewer(), address(next), "Nominee accepted");
        Assert.equal(funding.pendingReviewer(), address(0), "Nomination cleared");
        Assert.equal(funding.isReviewer(address(this)), false, "Old reviewer revoked");
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.approveCampaign, (id)), Crowdfunding.NotReviewer.selector, 0);
        next.approve(funding, id);
        Assert.equal(funding.getCampaign(id).decidedBy, address(next), "New reviewer decides");
    }

    function outsidersCannotTransferOrAcceptReviewerRole() public {
        FundingActor outsider = new FundingActor();
        _expectRevert(address(outsider), abi.encodeCall(FundingActor.nominate, (funding, address(outsider))), Crowdfunding.NotReviewer.selector, 0);
        _expectRevert(address(outsider), abi.encodeCall(FundingActor.accept, (funding)), Crowdfunding.NotPendingReviewer.selector, 0);
        _expectRevert(address(outsider), abi.encodeCall(FundingActor.cancelNomination, (funding)), Crowdfunding.NotReviewer.selector, 0);
        Assert.equal(funding.reviewer(), address(this), "Authority unchanged");
    }

    function zeroAndCurrentReviewerCannotBeNominated() public {
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.proposeReviewer, (address(0))), Crowdfunding.InvalidReviewer.selector, 0);
        _expectRevert(address(funding), abi.encodeCall(Crowdfunding.proposeReviewer, (address(this))), Crowdfunding.InvalidReviewer.selector, 0);
        Assert.equal(funding.pendingReviewer(), address(0), "No invalid nominee stored");
    }

    function cancelledNomineeCannotAccept() public {
        FundingActor next = new FundingActor();
        funding.proposeReviewer(address(next));
        funding.cancelReviewerTransfer();
        _expectRevert(address(next), abi.encodeCall(FundingActor.accept, (funding)), Crowdfunding.NotPendingReviewer.selector, 0);
        Assert.equal(funding.reviewer(), address(this), "Cancelled transfer preserves authority");
    }

    function replacedNomineeCannotAccept() public {
        FundingActor first = new FundingActor();
        FundingActor second = new FundingActor();
        funding.proposeReviewer(address(first));
        funding.proposeReviewer(address(second));
        _expectRevert(address(first), abi.encodeCall(FundingActor.accept, (funding)), Crowdfunding.NotPendingReviewer.selector, 0);
        second.accept(funding);
        Assert.equal(funding.reviewer(), address(second), "Only latest nominee can accept");
    }

    /// #value: 100
    function reviewerCannotWithdrawAnotherOwnersMoney() public payable {
        uint256 id = _submit(100);
        FundingActor next = new FundingActor();
        funding.proposeReviewer(address(next));
        next.accept(funding);
        next.approve(funding, id);
        funding.contribute{value: 100}(id);
        funding.setDeadlineForTest(id, block.timestamp);
        _expectRevert(address(next), abi.encodeCall(FundingActor.withdraw, (funding, id)), Crowdfunding.NotCampaignOwner.selector, 0);
        funding.withdraw(id);
        Assert.equal(address(next).balance, 0, "Reviewer receives no escrow payment");
        Assert.equal(funding.getCampaign(id).withdrawn, true, "Only owner was paid");
    }
}
