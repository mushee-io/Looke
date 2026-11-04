// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LookeCoin} from "./LookeCoin.sol";

/// @notice Standalone Ultra EVM creator coin factory. No exchange, fees or liquidity promises.
contract LookeCoinFactory {
    address[] public coins;
    mapping(address => address[]) private _coinsByCreator;

    event CoinCreated(
        address indexed creator,
        address indexed coin,
        string name,
        string symbol,
        string metadataURI,
        uint256 initialSupply
    );

    function createCoin(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint256 initialSupply
    ) external returns (address coin) {
        coin = address(new LookeCoin(name, symbol, metadataURI, msg.sender, initialSupply));
        coins.push(coin);
        _coinsByCreator[msg.sender].push(coin);
        emit CoinCreated(msg.sender, coin, name, symbol, metadataURI, initialSupply);
    }

    function coinCount() external view returns (uint256) {
        return coins.length;
    }

    function coinsByCreator(address creator) external view returns (address[] memory) {
        return _coinsByCreator[creator];
    }
}
