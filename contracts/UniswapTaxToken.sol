// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IUniswapV2Factory {
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint256
    );

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);

    function allPairs(uint256) external view returns (address pair);

    function allPairsLength() external view returns (uint256);

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);

    function WETH() external pure returns (address);

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
}

interface IERC721 {
    function balanceOf(address owner) external view returns (uint256 balance);
}

contract UniV2 is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint public tax;
    uint256 public swapTokensAtAmount;
    uint256 public maxTaxSwap;
    address public taxWallet;

    IUniswapV2Router02 public immutable uniswapV2Router;
    address public immutable uniswapV2Pair;

    mapping(address => bool) private isExcludedFromFees;
    mapping(address => bool) public automatedMarketMakerPairs;

    bool private swapping;

    constructor(address _nftAddress)
        ERC20("UniV2", "UNIV2")
        ERC20Permit("UniV2")
    {
        nft = IERC721(_nftAddress);

        uniswapV2Router = IUniswapV2Router02(
            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D //Uniswap V2 Router
        );
        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory())
            .createPair(address(this), uniswapV2Router.WETH());

        setAutomatedMarketMakerPair(address(uniswapV2Pair), true);
        excludeFromFees(msg.sender, true);
        excludeFromFees(address(this), true);

        _mint(msg.sender, 1000000000 * 10 ** decimals());

        taxWallet = msg.sender;
        tax = 50; // 5%
        swapTokensAtAmount = totalSupply() * 2 / 10000; // 0.02%
        maxTaxSwap = totalSupply() * 20 / 10000; // 0.2%
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        if (amount == 0) {
            super._transfer(from, to, 0);
            return;
        }

        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;

        if (
            canSwap &&
            !swapping &&
            automatedMarketMakerPairs[to] &&
            !isExcludedFromFees[from] &&
            !isExcludedFromFees[to]
        ) {
            swapping = true;
            swapTokensForEth(Math.min(contractTokenBalance, maxTaxSwap));
            swapping = false;
        }

        bool takeFee = (tax > 0) && !swapping;

        // If any account belongs to _isExcludedFromFee account then remove the fee
        if (isExcludedFromFees[from] || isExcludedFromFees[to]) {
            takeFee = false;
        }

        uint256 fees = 0;
        // Only take fees on buys/sells, do not take on wallet transfers
        if (takeFee && (automatedMarketMakerPairs[to] || automatedMarketMakerPairs[from])) {
            fees = (amount * tax) / 1000;
        }

        if (fees > 0) {
            super._transfer(from, address(this), fees);
            amount -= fees;
        }

        super._transfer(from, to, amount);
    }

    function setTaxPercent(uint newTax) public onlyOwner {
        require(newTax <= 50, "Can't set higher tax than 5%");
        tax = newTax;
    }

    function setMaxTaxSwap(uint256 newMax) public onlyOwner {
        maxTaxSwap = newMax;
    }

    function setSwapTokensAtAmount(uint256 newAmount) public onlyOwner {
        swapTokensAtAmount = newAmount;
    }

    function setTaxWallet(address newWallet) public onlyOwner {
        taxWallet = newWallet;
    }

    function excludeFromFees(address account, bool excluded) public onlyOwner {
        isExcludedFromFees[account] = excluded;
    }

    function setAutomatedMarketMakerPair(address pair, bool value) public onlyOwner {
        automatedMarketMakerPairs[pair] = value;
    }

    function withdrawEth(address toAddr) public onlyOwner {
        (bool success, ) = toAddr.call{
            value: address(this).balance
        } ("");
        require(success);
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        // Generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // Make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // Accept any amount of ETH; ignore slippage
            path,
            address(taxWallet),
            block.timestamp
        );
    }

    // Function to add initial liquidity to Uniswap
    function addInitialLiquidity(uint256 tokenAmount) public payable onlyOwner {
        require(!isLiquidityAdded, "Liquidity already added, can't add it again");

        // Approve token transfer to cover all possible scenarios
//        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // Add the liquidity
        uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(),
            block.timestamp
        );

        isLiquidityAdded = true;

        if (totalEthContributed > 0)
            buyTokensWithEth(totalEthContributed);
    }

    // PRE-Launch contributions code
    uint256 public totalEthContributed;
    uint256 public totalTokensBought;
    bool public isLiquidityAdded = false;
    uint256 public maxContribution = 0.1 ether;
    IERC721 public nft;

    mapping(address => uint256) public ethContributions;

    function setMaxContribution(uint256 newMax) public onlyOwner {
        maxContribution = newMax;
    }

    // Function to receive ETH contributions
    receive() external payable {
        require(!isLiquidityAdded, "Liquidity already added, contributions closed");
        require(msg.value <= maxContribution, "Contribution exceeds limit");
        require(nft.balanceOf(msg.sender) > 0, "Must own an NFT from the specified collection to contribute");

        ethContributions[msg.sender] += msg.value;
        totalEthContributed += msg.value;
    }

    // Function to buy tokens with the ETH pool
    function buyTokensWithEth(uint256 ethAmount) internal {
        require(address(this).balance >= ethAmount, "Insufficient ETH balance");

        // Set up the path to swap ETH for tokens
        address[] memory path = new address[](2);
        path[0] = uniswapV2Router.WETH();
        path[1] = address(this);

        // Make the swap
        uniswapV2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: ethAmount}(
            0, // accept any amount of Tokens
            path,
            address(this),
            block.timestamp
        );

        // Update the total tokens bought
        totalTokensBought = balanceOf(address(this));
    }

    // Function for users to withdraw their tokens
    function withdrawTokens() public {
        require(isLiquidityAdded, "Liquidity not yet added");
        uint256 userEthContribution = ethContributions[msg.sender];
        require(userEthContribution > 0, "No ETH contribution");

        uint256 tokenAmount = calculateTokenAmount(userEthContribution);
        ethContributions[msg.sender] = 0;
        _transfer(address(this), msg.sender, tokenAmount);
    }

    // Calculate the amount of tokens a user can withdraw
    function calculateTokenAmount(uint256 userEthContribution) public view returns (uint256) {
        return (userEthContribution * totalTokensBought) / totalEthContributed;
    }
}
