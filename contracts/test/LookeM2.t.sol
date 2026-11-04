// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LookeCoinFactory} from "../LookeCoinFactory.sol";
import {LookeCoin} from "../LookeCoin.sol";

contract LookeTestCreator {
    function create(LookeCoinFactory factory, string memory name, string memory ticker) external returns (address) {
        return factory.createCoin(name, ticker, "ipfs://test", 500 ether);
    }
}

contract LookeM2Test {
    function testIndependentCreatorIndexesAndSupply() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        LookeTestCreator alice = new LookeTestCreator();
        LookeTestCreator bob = new LookeTestCreator();

        address a = alice.create(factory, "Alpha", "ALPHA");
        address b = bob.create(factory, "Beta", "BETA");
        require(a != b, "coin addresses must differ");
        require(factory.coinCount() == 2, "two launches");
        require(factory.coinsByCreator(address(alice)).length == 1, "alice index");
        require(factory.coinsByCreator(address(bob)).length == 1, "bob index");
        require(factory.coinsByCreator(address(alice))[0] == a, "wrong alice coin");
        require(LookeCoin(a).balanceOf(address(alice)) == 500 ether, "alice tokens");
        require(LookeCoin(b).balanceOf(address(bob)) == 500 ether, "bob tokens");
        require(LookeCoin(a).balanceOf(address(bob)) == 0, "creator isolation");
        require(LookeCoin(a).totalSupply() == 500 ether, "fixed supply");
    }

    function testRejectsZeroRecipientAndInsufficientBalance() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        LookeCoin coin = LookeCoin(factory.createCoin("Alpha", "ALPHA", "ipfs://a", 10 ether));
        bool reverted;
        try coin.transfer(address(0), 1 ether) returns (bool) { reverted = false; }
        catch { reverted = true; }
        require(reverted, "must reject zero recipient");
        try coin.transfer(address(0xBEEF), 11 ether) returns (bool) { reverted = false; }
        catch { reverted = true; }
        require(reverted, "must reject overspend");
    }

    function testRejectsInvalidNameAndSymbol() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        bool reverted;
        try factory.createCoin("", "ALPHA", "ipfs://a", 1 ether) returns (address) { reverted = false; }
        catch { reverted = true; }
        require(reverted, "empty name");
        try factory.createCoin("Alpha", "A", "ipfs://a", 1 ether) returns (address) { reverted = false; }
        catch { reverted = true; }
        require(reverted, "short ticker");
    }
}
