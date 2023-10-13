// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DepositDistributor is Ownable {
    address public taxWallet;
    uint256 public lastDistributionTime;
    uint256 public totalDepositedToday;
    uint256 constant TAX_LIMIT = 15 ether;
    uint256 constant DAY = 24 hours;

    struct Recipient {
        uint256 weight;
        bool exists;
    }

    mapping(address => Recipient) public recipients;
    address[] public recipientAddresses;
    uint256 public totalWeight;

    constructor(address _taxWallet) {
        require(_taxWallet != address(0), "Invalid tax wallet address.");

        taxWallet = _taxWallet;
        recipients[taxWallet].exists = true;
    }

    function addRecipient(address _recipient, uint256 _weight) public onlyOwner {
        require(_recipient != address(0), "Invalid recipient address.");
        require(_weight > 0, "Weight should be greater than 0.");
        require(!recipients[_recipient].exists, "Recipient already exists.");

        recipients[_recipient] = Recipient({
            weight: _weight,
            exists: true
        });
        recipientAddresses.push(_recipient);
        totalWeight += _weight;
    }

    function removeRecipient(address _recipient) public onlyOwner {
        require(recipients[_recipient].exists, "Recipient doesn't exist.");

        totalWeight -= recipients[_recipient].weight;
        delete recipients[_recipient];

        // Remove the address from recipientAddresses array
        for (uint256 i = 0; i < recipientAddresses.length; i++) {
            if (recipientAddresses[i] == _recipient) {
                recipientAddresses[i] = recipientAddresses[recipientAddresses.length - 1];
                recipientAddresses.pop();
                break;
            }
        }
    }

    function deposit() public payable {
        require(msg.value > 0, "Amount should be greater than 0.");

        if (block.timestamp > lastDistributionTime + DAY) {
            totalDepositedToday = 0;
            lastDistributionTime = block.timestamp;
        }

        uint256 taxAmount = 0;
        if (totalDepositedToday < TAX_LIMIT) {
            taxAmount = (TAX_LIMIT - totalDepositedToday) > msg.value ? msg.value : (TAX_LIMIT - totalDepositedToday);
        } else {
            taxAmount = msg.value / 2;
        }

        payable(taxWallet).transfer(taxAmount);
        totalDepositedToday += taxAmount;
    }

    function distributeFunds() public {
        uint256 remaining = address(this).balance;
        require(remaining > 0, "No funds to distribute.");

        for (uint256 i = 0; i < recipientAddresses.length; i++) {
            address addr = recipientAddresses[i];
            if (addr != taxWallet && totalWeight > 0) {
                uint256 recipientShare = (remaining * recipients[addr].weight) / totalWeight;
                payable(addr).transfer(recipientShare);
            }
        }
    }
}
