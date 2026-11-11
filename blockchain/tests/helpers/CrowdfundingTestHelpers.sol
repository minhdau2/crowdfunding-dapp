// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "../../contracts/Crowdfunding.sol";

/// @dev TEST ONLY. Never deploy this harness as the application's contract.
/// Sets storage deadlines to exercise settlement in a single Remix test call.
contract CrowdfundingHarness is Crowdfunding {
    constructor(address initialReviewer) Crowdfunding(initialReviewer) {}
    function setDeadlineForTest(uint256 id, uint256 deadline) external {
        _getCampaign(id).deadline = deadline;
    }
}

contract FundingActor {
    Crowdfunding private _target;
    uint256 private _id;
    uint8 private _attack;
    bool public rejectEther;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    bytes4 public reentryError;

    function create(Crowdfunding target, uint256 goal, uint256 durationSeconds) external returns (uint256) {
        return target.submitCampaign("Actor campaign", "Test description", goal, durationSeconds);
    }

    function approve(Crowdfunding target, uint256 id) external { target.approveCampaign(id); }
    function reject(Crowdfunding target, uint256 id, string calldata reason) external { target.rejectCampaign(id, reason); }
    function nominate(Crowdfunding target, address next) external { target.proposeReviewer(next); }
    function accept(Crowdfunding target) external { target.acceptReviewer(); }
    function cancelNomination(Crowdfunding target) external { target.cancelReviewerTransfer(); }

    function contribute(Crowdfunding target, uint256 id) external payable {
        target.contribute{value: msg.value}(id);
    }

    function withdraw(Crowdfunding target, uint256 id) external { target.withdraw(id); }
    function refund(Crowdfunding target, uint256 id) external { target.refund(id); }
    function setRejectEther(bool value) external { rejectEther = value; }

    function armReentry(Crowdfunding target, uint256 id, uint8 attack) external {
        _target = target;
        _id = id;
        _attack = attack;
    }

    receive() external payable {
        require(!rejectEther, "Receiver rejects ETH");
        if (_attack == 0) return;
        uint8 attack = _attack;
        _attack = 0;
        reentryAttempted = true;
        bytes memory payload = attack == 1
            ? abi.encodeCall(Crowdfunding.withdraw, (_id))
            : abi.encodeCall(Crowdfunding.refund, (_id));
        (bool success, bytes memory result) = address(_target).call(payload);
        reentrySucceeded = success;
        if (result.length >= 4) reentryError = bytes4(result);
    }
}

abstract contract CrowdfundingTestBase {
    CrowdfundingHarness internal funding;

    function _reset() internal { funding = new CrowdfundingHarness(address(this)); }

    function _create(uint256 goal) internal returns (uint256) {
        uint256 id = _submit(goal);
        funding.approveCampaign(id);
        return id;
    }

    function _submit(uint256 goal) internal returns (uint256) {
        return funding.submitCampaign("Test campaign", "Test description", goal, 1 days);
    }

    function _expectRevert(address target, bytes memory payload, bytes4 expected, uint256 value) internal {
        (bool success, bytes memory result) = target.call{value: value}(payload);
        require(!success, "Expected the call to revert");
        require(result.length >= 4 && bytes4(result) == expected, "Unexpected revert selector");
    }

    receive() external payable {}
}
