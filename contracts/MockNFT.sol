// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter = 0;

    constructor() ERC721("MockNFT", "MNFT") {}

    function safeMint(address to) public onlyOwner {
        _safeMint(to, _tokenIdCounter);
        _tokenIdCounter++;
    }

    function mint(address to) public onlyOwner {
        _mint(to, _tokenIdCounter);
        _tokenIdCounter++;
    }
}
