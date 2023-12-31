// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./TyrionRegistry.sol";
import "./Tyrion.sol";


contract TyrionBroker is OwnableUpgradeable {
    uint256 public advertiserPercentage;
    uint256 public burnPercentage;
    uint256 public referrerDepositPercentage;
    uint256 public publisherReferrerPercentage;
    uint256 public percentDivisor;

    address public treasuryWallet; // team treasury, where team commission goes
    Tyrion public tyrionToken;
    TyrionRegistry public registry;

    address public fundsManager; // server-side address that can credit publishers

    event Deposited(uint256 indexed advertiserId, uint256 amount);
    event WithdrawnPublisher(uint256 indexed publisherId, uint256 amount);
    event WithdrawnReferrer(address indexed referrerId, uint256 amount);

    function initialize(address payable _tyrionTokenAddress, address _registryAddress) public initializer {
        advertiserPercentage = 700;
        burnPercentage = 20;
        referrerDepositPercentage = 25;
        publisherReferrerPercentage = 25;
        percentDivisor = 1000;

        treasuryWallet = msg.sender;
        tyrionToken = Tyrion(_tyrionTokenAddress);
        registry = TyrionRegistry(_registryAddress);

        __Ownable_init();
    }

    // TODO: Temporary fallback for migrations, to be removed in later versions
    function withdrawAllTokens() external onlyOwner {
        uint256 balance = tyrionToken.balanceOf(address(this));
        tyrionToken.transfer(msg.sender, balance);
    }

    function depositTokens(uint256 advertiserId, uint256 amount) public {
        require(tyrionToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 advertiserAmount = (amount * advertiserPercentage) / percentDivisor;
        uint256 burnAmount = (amount * burnPercentage) / percentDivisor;
        uint256 referrerAmount = (amount * referrerDepositPercentage) / percentDivisor;
        // Reserves to be spent on referrer who referred the publisher who will display ads later on
        uint256 reservesAmount = (advertiserAmount * publisherReferrerPercentage) / percentDivisor;
        uint256 treasuryAmount = amount - advertiserAmount - burnAmount - referrerAmount - reservesAmount;

        tyrionToken.burn(burnAmount);
        tyrionToken.transfer(treasuryWallet, treasuryAmount);

        Advertiser memory advertiser = registry.getAdvertiserById(advertiserId);
        if (advertiser.referrer != address(0)) {
            registry.modifyReferrerBalance(advertiser.referrer, int256(referrerAmount));
        }

        registry.modifyAdvertiserBalance(advertiserId, int256(advertiserAmount));

        emit Deposited(advertiserId, amount);
    }

    // This function can be called from the server-side to credit publishers
    function creditPublisher(uint256 advertiserId, uint256 publisherId, uint256 amount) public {
        require(fundsManager == msg.sender, "Only funds manager can credit publishers");

        // Ensure the server's address is authorized
        Advertiser memory advertiser = registry.getAdvertiserById(advertiserId);

        require(amount <= advertiser.balance, "Insufficient balance in advertiser account");

        registry.modifyAdvertiserBalance(advertiserId, -int256(amount));
        registry.modifyPublisherBalance(publisherId, int256(amount));
    }

    function creditMultiplePublishers(uint256 advertiserId, uint256[] memory publisherIds, uint256[] memory amounts) public {
        require(publisherIds.length == amounts.length, "Publisher IDs and amounts length mismatch");

        for (uint i = 0; i < publisherIds.length; i++) {
            creditPublisher(advertiserId, publisherIds[i], amounts[i]);
        }
    }

    function publisherWithdraw(uint256 publisherId, uint256 amount) external {
        Publisher memory publisher = registry.getPublisherById(publisherId);
        require(publisher.wallet == msg.sender, "Unauthorized");
        require(publisher.balance >= amount, "Insufficient balance");

        registry.modifyPublisherBalance(publisherId, -int256(amount));

        tyrionToken.transfer(publisher.wallet, amount);
        // Assuming each referrer has a unique ID and is mapped to their ID
        if (publisher.referrer != address(0)) {
            int256 referrerAmount = int256((amount * publisherReferrerPercentage) / percentDivisor);
            registry.modifyReferrerBalance(publisher.referrer, referrerAmount);
        }

        emit WithdrawnPublisher(publisherId, amount);
    }

    function referrerWithdraw(address referrerId) external {
        Referrer memory referrer = registry.getReferrerById(referrerId);
        require(referrer.wallet == msg.sender, "Unauthorized");
        require(referrer.balance > 0, "No balance to withdraw");

        uint256 amount = referrer.balance;
        registry.modifyReferrerBalance(referrerId, -int256(amount));

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
        uint256 _publisherReferrerPercentage
    ) external onlyOwner {
        advertiserPercentage = _advertiserPercentage;
        burnPercentage = _burnPercentage;
        referrerDepositPercentage = _referrerDepositPercentage;
        publisherReferrerPercentage = _publisherReferrerPercentage;
    }

    function setFundsManager(address _fundsManager) external onlyOwner {
        fundsManager = _fundsManager;
    }
}
