// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Independent, fixed-supply ERC-20 for Ultra EVM; NOT a Zora coin contract.
/// @dev No mint after deployment, no taxes, no liquidity provisioning and no trading functionality.
contract LookeCoin {
    string public name;
    string public symbol;
    string public metadataURI;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable creator;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address creator_,
        uint256 initialSupply_
    ) {
        require(creator_ != address(0), "creator required");
        require(bytes(name_).length > 0 && bytes(name_).length <= 64, "invalid name");
        require(bytes(symbol_).length >= 2 && bytes(symbol_).length <= 12, "invalid symbol");
        require(bytes(metadataURI_).length > 0, "metadata required");
        require(initialSupply_ > 0, "supply required");
        name = name_;
        symbol = symbol_;
        metadataURI = metadataURI_;
        creator = creator_;
        totalSupply = initialSupply_;
        balanceOf[creator_] = initialSupply_;
        emit Transfer(address(0), creator_, initialSupply_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "zero spender");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        if (approved != type(uint256).max) {
            require(approved >= amount, "insufficient allowance");
            allowance[from][msg.sender] = approved - amount;
            emit Approval(from, msg.sender, approved - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero recipient");
        uint256 balance = balanceOf[from];
        require(balance >= amount, "insufficient balance");
        unchecked { balanceOf[from] = balance - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
