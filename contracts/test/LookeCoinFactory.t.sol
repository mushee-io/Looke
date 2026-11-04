// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LookeCoinFactory} from "../LookeCoinFactory.sol";
import {LookeCoin} from "../LookeCoin.sol";

contract LookeCoinFactoryTest {
    function testCreateCoinMintsToCreator() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        address created = factory.createCoin("Ultra Cat", "UCAT", "ipfs://metadata", 1_000 ether);
        LookeCoin coin = LookeCoin(created);
        require(coin.balanceOf(address(this)) == 1_000 ether, "wrong creator balance");
        require(coin.totalSupply() == 1_000 ether, "wrong total supply");
        require(coin.creator() == address(this), "wrong creator");
        require(factory.coinCount() == 1, "wrong count");
        require(factory.coinsByCreator(address(this)).length == 1, "wrong creator index");
    }

    function testTransferAndAllowance() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        LookeCoin coin = LookeCoin(factory.createCoin("Ultra Cat", "UCAT", "ipfs://metadata", 100 ether));
        require(coin.approve(address(this), 25 ether), "approve failed");
        require(coin.transferFrom(address(this), address(0xBEEF), 10 ether), "transfer failed");
        require(coin.balanceOf(address(0xBEEF)) == 10 ether, "recipient balance");
        require(coin.allowance(address(this), address(this)) == 15 ether, "allowance");
        require(coin.totalSupply() == 100 ether, "supply must remain fixed");
    }

    function testRejectsEmptyMetadata() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        bool reverted;
        try factory.createCoin("Ultra Cat", "UCAT", "", 1 ether) returns (address) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "should reject empty metadata");
    }

    function testRejectsZeroSupply() public {
        LookeCoinFactory factory = new LookeCoinFactory();
        bool reverted;
        try factory.createCoin("Ultra Cat", "UCAT", "ipfs://metadata", 0) returns (address) {
            reverted = false;
        } catch {
            reverted = true;
        }
        require(reverted, "should reject zero supply");
    }
}
