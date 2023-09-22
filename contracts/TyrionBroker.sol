// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TyrionRegistry.sol";

interface ITYRION {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function burn(uint256 amount) external returns (bool);
}

contract TyrionBroker is Ownable {
    uint256 public advertiserPercentage = 700;
    uint256 public burnPercentage = 20;
    uint256 public referrerDepositPercentage = 25;
    uint256 public reservesPercentage = 25;
    uint256 public percentDivisor = 1000;

    address public treasuryWallet;
    ITYRION public tyrionToken;
    TyrionRegistry public registry;

    event Deposited(uint256 indexed advertiserId, uint256 amount);
    event WithdrawnPublisher(uint256 indexed publisherId, uint256 amount);
    event WithdrawnReferrer(uint256 indexed referrerId, uint256 amount);

    constructor(address _treasuryWallet, address _tyrionTokenAddress) {
        treasuryWallet = _treasuryWallet;
        tyrionToken = ITYRION(_tyrionTokenAddress);

    }

    function depositTokens(uint256 advertiserId, uint256 amount) external {
        Advertiser storage advertiser = advertisers[advertiserId];
        require(tyrionToken.transferFrom(advertiser.wallet, address(this), amount), "Transfer failed");

        uint256 advertiserAmount = (amount * advertiserPercentage) / percentDivisor;
        uint256 burnAmount = (amount * burnPercentage) / percentDivisor;
        uint256 referrerAmount = (amount * referrerDepositPercentage) / percentDivisor;
        uint256 reservesAmount = (amount * reservesPercentage) / percentDivisor;
        uint256 treasuryAmount = amount - advertiserAmount - burnAmount - referrerAmount - reservesAmount;

        tyrionToken.burn(burnAmount);
        tyrionToken.transfer(treasuryWallet, treasuryAmount);

        uint256 referrerId = referrers[advertiser.referrer].id;
        referrers[referrerId].balance += referrerAmount;

        advertiser.balance += advertiserAmount;

        emit Deposited(advertiserId, amount);
    }

    // This function can be called from the server-side to credit publishers
    function creditPublisher(uint256 publisherId, uint256 amount) external onlyOwner {
        // Ensure the server's address is authorized
        require(amount <= advertisers[publisherId].balance, "Insufficient balance in advertiser account");

        publishers[publisherId].balance += amount;
        advertisers[publisherId].balance -= amount;
    }

    function publisherWithdraw(uint256 publisherId, uint256 amount) external {
        require(publishers[publisherId].wallet == msg.sender, "Unauthorized");
        require(publishers[publisherId].balance >= amount, "Insufficient balance");

        uint256 referrerAmount = (amount * 2.5) / 100;
        publishers[publisherId].balance -= amount;

        tyrionToken.transfer(publishers[publisherId].wallet, amount - referrerAmount);
        // Assuming each referrer has a unique ID and is mapped to their ID
        uint256 referrerId = referrers[publishers[publisherId].referrer].id;
        referrers[referrerId].balance += referrerAmount;

        emit WithdrawnPublisher(publisherId, amount);
    }

    function referrerWithdraw(uint256 referrerId) external {
        Referrer storage referrer = referrers[referrerId];
        require(referrer.wallet == msg.sender, "Unauthorized");
        require(referrer.balance > 0, "No balance to withdraw");

        uint256 amount = referrer.balance;
        referrer.balance = 0;

        tyrionToken.transfer(referrer.wallet, amount);

        emit WithdrawnReferrer(referrerId, amount);
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        treasuryWallet = _treasuryWallet;
    }

    function setPercentages(
        uint256 _advertiserPercentage,
        uint256 _burnPercentage,
        uint256 _referrerDepositPercentage,
        uint256 _reservesPercentage
    ) external onlyOwner {
        advertiserPercentage = _advertiserPercentage;
        burnPercentage = _burnPercentage;
        referrerDepositPercentage = _referrerDepositPercentage;
        reservesPercentage = _reservesPercentage;
    }
}
