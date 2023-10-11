// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract TyrionVesting is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private vestingIdCounter;

    uint256 public vestingFee = 0.03 ether; // Default fee, can be set by the contract owner
    mapping(address => bool) public isExempted; // Fee exemption list

    uint256 public withdrawalFee = 0.01 ether;

    struct VestingSchedule {
        uint256 id;
        address owner;
        address beneficiary;
        address token;
        uint256 startTime;
        uint256 duration;
        uint256 totalAmount;
        uint256 withdrawnAmount;
        bool isPausable;
        uint256 pausedAt;
    }

    event VestingAdded(uint256 vestingId, address indexed owner, address indexed beneficiary, address indexed token, uint256 startTime, uint256 duration, uint256 amount);
    event VestingPaused(uint256 vestingId, uint256 timestamp);
    event VestingUnPaused(uint256 vestingId, uint256 timestamp);
    event Withdrawn(uint256 vestingId, address indexed beneficiary, uint256 amount);

    VestingSchedule[] private vestings;

    modifier paysFeeOrExempted() {
        if(!isExempted[msg.sender]) {
            require(msg.value >= vestingFee, "Fee not provided");
            payable(owner()).transfer(msg.value);
        }
        _;
    }

    function addVesting(
        address _beneficiary,
        address _token,
        uint256 _startTime,
        uint256 _duration,
        uint256 _amount,
        bool _isPausable
    ) external payable paysFeeOrExempted returns (uint256 newVestingId) {
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_token != address(0), "Invalid token address");
        require(_duration > 0 && _duration < 1000 weeks, "Duration should be > 0 and < 1000 weeks");
        require(_amount > 0, "Amount should be 0");
        require(_startTime >= block.timestamp - 30 days, "Start time shouldn't be before 30 days in the past");

        SafeERC20.safeTransferFrom(IERC20(_token), msg.sender, address(this), _amount);

        newVestingId = vestingIdCounter.current();
        vestingIdCounter.increment();

        VestingSchedule memory newVesting = VestingSchedule({
            id: newVestingId,
            owner: msg.sender,
            beneficiary: _beneficiary,
            token: _token,
            startTime: _startTime,
            duration: _duration,
            totalAmount: _amount,
            withdrawnAmount: 0,
            pausedAt: 0,
            isPausable: _isPausable
        });

        vestings.push(newVesting);

        emit VestingAdded(newVestingId, msg.sender, _beneficiary, _token, _startTime, _duration, _amount);
    }

    function withdraw(uint256 vestingId) external payable nonReentrant {
        require(vestingId < vestings.length, "Invalid vesting ID");
        require(msg.value >= withdrawalFee, "Fee not provided");
        VestingSchedule storage vesting = vestings[vestingId];

        require(msg.sender == vesting.beneficiary, "Not the beneficiary");

        uint256 toWithdraw = withdrawableAmount(vestingId);

        require(toWithdraw > 0, "No withdrawable amount at the moment");

        vesting.withdrawnAmount += toWithdraw;

        // Just a safeguard, should never happen
        require(vesting.withdrawnAmount <= vesting.totalAmount, "Withdrawn amount exceeds total amount");

        emit Withdrawn(vesting.id, msg.sender, toWithdraw);

        SafeERC20.safeTransfer(IERC20(vesting.token), msg.sender, toWithdraw);
    }

    function withdrawableAmount(uint256 vestingId) public view returns (uint256) {
        require(vestingId < vestings.length, "Invalid vesting ID");
        VestingSchedule memory vesting = vestings[vestingId];

        if (vesting.startTime > block.timestamp) {
            return 0;
        }

        if (vesting.withdrawnAmount >= vesting.totalAmount) {
            return 0;
        }

        uint256 elapsed;
        if (vesting.pausedAt > 0) {
            elapsed = vesting.pausedAt - vesting.startTime;
        } else {
            elapsed = block.timestamp - vesting.startTime;
        }

        uint256 vestedAmount = (vesting.totalAmount * Math.min(elapsed, vesting.duration)) / vesting.duration;

        // This can happen if vesting is time is extended and the withdrawnAmount is now greater than the currently
        // vested amount. I.e. vesting is for 2 months, after 1 month 50% was withdrawn, then we extend the vesting
        // to 4 months. Now the vested amount is 25% and the withdrawn amount is 50%.
        if (vesting.withdrawnAmount > vestedAmount) {
            return 0;
        }

        return vestedAmount - vesting.withdrawnAmount;
    }

    function getVestingById(uint256 vestingId) external view returns (VestingSchedule memory) {
        require(vestingId < vestings.length, "Invalid vesting ID");
        return vestings[vestingId];
    }

    function setVestingFee(uint256 _fee) external onlyOwner {
        vestingFee = _fee;
    }

    function setFeeExempted(address _address, bool _exempt) external onlyOwner {
        isExempted[_address] = _exempt;
    }

    function pauseVesting(uint256 vestingId, bool _isPaused) external {
        require(vestingId < vestings.length, "Invalid vesting ID");
        require(msg.sender == vestings[vestingId].owner, "Not the owner");
        require(vestings[vestingId].isPausable == true, "Vesting not pausable");

        if (_isPaused == true) {
            vestings[vestingId].pausedAt = block.timestamp;
            emit VestingPaused(vestingId, block.timestamp);
        } else {
            vestings[vestingId].pausedAt = 0;
            emit VestingUnPaused(vestingId, block.timestamp);
        }
    }

    function changeVestingOwner(uint256 vestingId, address _newOwner) external {
        require(vestingId < vestings.length, "Invalid vesting ID");
        require(msg.sender == vestings[vestingId].owner, "Not the owner");
        require(_newOwner != address(0), "Invalid address");

        vestings[vestingId].owner = _newOwner;
    }

    function transferVestingBeneficiary(uint256 vestingId, address _newBeneficiary) external {
        require(vestingId < vestings.length, "Invalid vesting ID");
        require(msg.sender == vestings[vestingId].beneficiary, "Not the beneficiary");
        require(_newBeneficiary != address(0), "Invalid address");

        vestings[vestingId].beneficiary = _newBeneficiary;
    }

    function extendVesting(uint256 vestingId, uint256 _newDuration) external {
        require(vestingId < vestings.length, "Invalid vesting ID");
        require(msg.sender == vestings[vestingId].beneficiary, "Not the beneficiary");
        require(_newDuration > vestings[vestingId].duration, "Duration should be greater than previous");

        vestings[vestingId].duration = _newDuration;
    }

    function setWithdrawalFee(uint256 _fee) external onlyOwner {
        require(_fee < withdrawalFee, "New fee should be less than previous");
        withdrawalFee = _fee;
    }

    function withdrawEth(address toAddr) public onlyOwner {
        (bool success, ) = toAddr.call{
            value: address(this).balance
        } ("");
        require(success);
    }

    // for testing
    receive() external payable {}
}
