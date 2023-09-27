// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

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

    struct VestingSchedule {
        uint256 id;
        address beneficiary;
        address token;
        uint256 startTime;
        uint256 duration;
        uint256 totalAmount;
        uint256 withdrawnAmount;
        uint256 pausedAt;
    }

    event VestingAdded(uint256 vestingId, address indexed beneficiary, address indexed token, uint256 startTime, uint256 duration, uint256 amount);
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
        uint256 _amount
    ) external payable paysFeeOrExempted {
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_token != address(0), "Invalid token address");
        require(_duration > 0 && _duration < 1000 weeks, "Duration should be > 0 and < 1000 weeks");
        require(_amount > 0, "Amount should be 0");
        require(_startTime >= block.timestamp - 30 days, "Start time shouldn't be before 30 days in the past");

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        vestingIdCounter.increment();
        uint256 newVestingId = vestingIdCounter.current();

        VestingSchedule memory newVesting = VestingSchedule({
            id: newVestingId,
            beneficiary: _beneficiary,
            token: _token,
            startTime: _startTime,
            duration: _duration,
            totalAmount: _amount,
            withdrawnAmount: 0,
            pausedAt: 0
        });

        vestings.push(newVesting);

        emit VestingAdded(newVestingId, _beneficiary, _token, _startTime, _duration, _amount);
    }

    function withdraw(uint256 vestingId) external nonReentrant {
        require(vestingId < vestings.length, "Invalid vesting ID");
        VestingSchedule storage vesting = vestings[vestingId];

        require(msg.sender == vesting.beneficiary, "Not the beneficiary");
        require(vesting.startTime <= block.timestamp, "Vesting hasn't started yet");
        require(vesting.totalAmount > vesting.withdrawnAmount, "Nothing left to withdraw");

        uint256 elapsed;
        if (vesting.pausedAt > 0) {
            elapsed = vesting.pausedAt - vesting.startTime;
        } else {
            elapsed = block.timestamp - vesting.startTime;
        }

        uint256 vestedAmount = (vesting.totalAmount * Math.min(elapsed, vesting.duration)) / vesting.duration;

        require(vestedAmount > vesting.withdrawnAmount, "No vestable amount at the moment");

        uint256 amountToWithdraw = vestedAmount - vesting.withdrawnAmount;
        vesting.withdrawnAmount = vestedAmount;

        emit Withdrawn(vesting.id, msg.sender, amountToWithdraw);

        IERC20(vesting.token).transfer(msg.sender, amountToWithdraw);
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

    function setVestingPause(uint256 vestingId, bool _isPaused) external onlyOwner {
        require(vestingId < vestings.length, "Invalid vesting ID");
        if (_isPaused == true)
            vestings[vestingId].pausedAt = block.timestamp;
        else
            vestings[vestingId].pausedAt = 0;
    }
}
