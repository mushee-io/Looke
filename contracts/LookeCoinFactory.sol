// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Non-upgradeable fixed-supply Looke social coin; no owner mint or blacklist.
 * @dev CONTRACT IS UNDEPLOYED AND UNAUDITED. No trading pool or fee sharing is included.
 */
contract LookeCoin is ERC20 {
    address public immutable creator;
    string public metadataURI;

    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        uint256 initialSupply_,
        string memory metadataURI_
    ) ERC20(name_, symbol_) {
        require(creator_ != address(0), "ZERO_CREATOR");
        creator = creator_;
        metadataURI = metadataURI_;
        _mint(creator_, initialSupply_);
    }
}

/**
 * @notice An isolated issuance prototype for Ultra EVM testnet.
 * @dev Creator=0, content=1, trend=2. No token has liquidity at launch.
 * This contract MUST NOT be offered publicly before independent security review.
 */
contract LookeCoinFactory {
    uint256 public constant MAX_SUPPLY_TOKENS = 1_000_000_000;
    uint8 public constant CREATOR = 0;
    uint8 public constant CONTENT = 1;
    uint8 public constant TREND = 2;

    mapping(bytes32 => address) public coinFor;
    address[] private launched;

    event CoinCreated(
        address indexed coin,
        address indexed creator,
        uint8 indexed kind,
        bytes32 contentRef,
        uint256 supply,
        string metadataURI
    );

    function coinCount() external view returns (uint256) {
        return launched.length;
    }

    function coinAt(uint256 index) external view returns (address) {
        return launched[index];
    }

    function createCoin(
        string calldata name_,
        string calldata symbol_,
        uint8 kind,
        bytes32 contentRef,
        uint256 initialSupplyTokens,
        string calldata metadataURI_
    ) external returns (address coin) {
        bytes memory nameBytes = bytes(name_);
        bytes memory symbolBytes = bytes(symbol_);
        bytes memory metadataBytes = bytes(metadataURI_);
        require(nameBytes.length >= 2 && nameBytes.length <= 80, "INVALID_NAME");
        require(symbolBytes.length >= 2 && symbolBytes.length <= 12, "INVALID_SYMBOL");
        for (uint256 i = 0; i < symbolBytes.length; ++i) {
            uint8 c = uint8(symbolBytes[i]);
            require((c >= 65 && c <= 90) || (c >= 48 && c <= 57), "INVALID_SYMBOL_CHAR");
        }
        require(kind <= TREND, "INVALID_KIND");
        require(initialSupplyTokens > 0 && initialSupplyTokens <= MAX_SUPPLY_TOKENS, "INVALID_SUPPLY");
        require(metadataBytes.length >= 10 && metadataBytes.length <= 256, "INVALID_METADATA");
        require(
            metadataBytes[0] == 0x69 && metadataBytes[1] == 0x70 &&
            metadataBytes[2] == 0x66 && metadataBytes[3] == 0x73 &&
            metadataBytes[4] == 0x3a && metadataBytes[5] == 0x2f &&
            metadataBytes[6] == 0x2f,
            "IPFS_URI_REQUIRED"
        );
        if (kind == CREATOR) require(contentRef == bytes32(0), "CREATOR_REF_MUST_BE_ZERO");
        else require(contentRef != bytes32(0), "CONTENT_REF_REQUIRED");

        bytes32 key = keccak256(abi.encode(msg.sender, kind, contentRef));
        require(coinFor[key] == address(0), "ALREADY_LAUNCHED");
        // Fixed 18 decimals; token supply is minted once, to the creating address.
        coin = address(new LookeCoin(
            name_, symbol_, msg.sender, initialSupplyTokens * 10**18, metadataURI_
        ));
        coinFor[key] = coin;
        launched.push(coin);
        emit CoinCreated(coin, msg.sender, kind, contentRef, initialSupplyTokens * 10**18, metadataURI_);
    }
}
