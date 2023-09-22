// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

struct Advertiser {
    uint256 id;
    address wallet;
    uint256 balance;
    address referrer;
}

struct Publisher {
    uint256 id;
    address wallet;
    uint256 balance;
    address referrer;
}

struct Referrer {
    uint256 id;
    address wallet;
    uint256 balance;
}

contract TyrionRegistry is Ownable {
    mapping(uint256 => Advertiser) public advertisers;
    mapping(uint256 => Publisher) public publishers;
    mapping(uint256 => Referrer) public referrers;

    uint256 public nextAdvertiserId = 1;
    uint256 public nextPublisherId = 1;
    uint256 public nextReferrerId = 1;

    event RegisteredAdvertiser(uint256 indexed advertiserId, address indexed referrer);
    event RegisteredPublisher(uint256 indexed publisherId, address indexed referrer);
    event RegisteredReferrer(uint256 indexed referrerId);

    constructor() {
    }

    function registerAdvertiser(address advertiserWallet, address referrerAddress) external returns (uint256 advertiserId) {
        advertiserId = nextAdvertiserId;
        advertisers[advertiserId] = Advertiser({
            id: advertiserId,
            wallet: advertiserWallet,
            balance: 0,
            referrer: referrerAddress
        });

        emit RegisteredAdvertiser(advertiserId, referrerAddress);
        nextAdvertiserId++;
    }

    function registerPublisher(address publisherWallet, address referrerAddress) external returns (uint256 publisherId) {
        publisherId = nextPublisherId;
        publishers[publisherId] = Publisher({
            id: publisherId,
            wallet: publisherWallet,
            balance: 0,
            referrer: referrerAddress
        });

        emit RegisteredPublisher(publisherId, referrerAddress);

        nextPublisherId++;
    }

    function registerReferrer(address referrerWallet) external returns (uint256 referrerId) {
        referrerId = nextReferrerId;
        referrers[nextReferrerId] = Referrer({
            id: nextReferrerId,
            wallet: referrerWallet,
            balance: 0
        });

        emit RegisteredReferrer(nextReferrerId);
        nextReferrerId++;
    }

    function getAdvertiserById(uint256 _advertiserId) external view returns (Advertiser memory) {
        return advertisers[_advertiserId];
    }

    function getPublisherById(uint256 _publisherId) external view returns (Publisher memory) {
        return publishers[_publisherId];
    }

    function getReferrerById(uint256 _referrerId) external view returns (Referrer memory) {
        return referrers[_referrerId];
    }
}