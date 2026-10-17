// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice USDC de prueba para Monad Testnet. Cualquiera puede reclamar 100 tUSDC cada 24 horas.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100e6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucet;

    error FaucetCooldown(uint256 availableAt);

    constructor() ERC20("Llovera Test USDC", "tUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint256 availableAt = lastFaucet[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucet[msg.sender] != 0 && block.timestamp < availableAt) revert FaucetCooldown(availableAt);
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Solo para pruebas y para fondear el pool en el despliegue.
    function mint(address to, uint256 amount) external {
        require(amount <= 1_000_000e6, "max 1M");
        _mint(to, amount);
    }
}
