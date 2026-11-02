// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

/**
 * @notice Non-upgradeable fixed-supply Looke social coin; no owner mint or blacklist.
 * @dev UNDEPLOYED AND UNAUDITED. No trading pool or fee sharing is included.
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
 * @notice An isolated, unsigned-by-default issuance prototype for Ultra EVM testnet.
 * @dev Creator=0 uses the caller's wallet. Content=1 and trend=2 require an
 * immutable trusted attestor's EIP-712 approval, tied to caller, chain, factory,
 * token terms, reference, nonce and expiry. The attestor MUST independently
 * validate post ownership / a reviewed trend decision before signing.
 *
 * The attestor is not provisioned and this factory is UNDEPLOYED / UNAUDITED.
 * Existing deployments of any older factory are NOT patched by this source.
 * No trading, liquidity or release toggle exists in this contract.
 */
contract LookeCoinFactory {
    uint256 public constant MAX_SUPPLY_TOKENS = 1_000_000_000;
    uint256 public constant MAX_AUTHORIZATION_LIFETIME = 1 days;
    uint8 public constant CREATOR = 0;
    uint8 public constant CONTENT = 1;
    uint8 public constant TREND = 2;

    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant DOMAIN_NAME_HASH = keccak256("LookeCoinFactory");
    bytes32 private constant DOMAIN_VERSION_HASH = keccak256("1");
    bytes32 private constant AUTHORIZATION_TYPEHASH = keccak256(
        "CoinAuthorization(address creator,uint8 kind,bytes32 contentRef,bytes32 nameHash,bytes32 symbolHash,uint256 initialSupplyTokens,bytes32 metadataHash,uint256 nonce,uint256 deadline)"
    );

    struct AuthorizedCoinRequest {
        string name;
        string symbol;
        uint8 kind;
        bytes32 contentRef;
        uint256 initialSupplyTokens;
        string metadataURI;
        uint256 nonce;
        uint256 deadline;
    }

    address public immutable attestor;
    mapping(address => uint256) public authorizationNonces;
    mapping(bytes32 => address) public coinFor;
    // Global kind+reference uniqueness: a second wallet cannot reuse the same
    // post or topic even if an attestor mistakenly signs twice.
    mapping(uint8 => mapping(bytes32 => address)) public referenceCoinFor;
    address[] private launched;

    event CoinCreated(
        address indexed coin,
        address indexed creator,
        uint8 indexed kind,
        bytes32 contentRef,
        uint256 supply,
        string metadataURI
    );
    event CoinAuthorizationUsed(
        address indexed creator,
        uint8 indexed kind,
        bytes32 indexed contentRef,
        uint256 nonce
    );

    constructor(address trustedAttestor) {
        require(trustedAttestor != address(0), "ZERO_ATTESTOR");
        attestor = trustedAttestor;
    }

    function coinCount() external view returns (uint256) {
        return launched.length;
    }

    function coinAt(uint256 index) external view returns (address) {
        return launched[index];
    }

    /**
     * @notice Legacy 6-argument entry point is deliberately creator-only.
     * A copied content/trend reference MUST NOT be enough to issue a coin.
     */
    function createCoin(
        string calldata name_,
        string calldata symbol_,
        uint8 kind,
        bytes32 contentRef,
        uint256 initialSupplyTokens,
        string calldata metadataURI_
    ) external returns (address coin) {
        require(kind == CREATOR, "ATTESTATION_REQUIRED");
        return _createCoin(name_, symbol_, kind, contentRef, initialSupplyTokens, metadataURI_);
    }

    /**
     * @notice Content and trend authorization. The caller must itself send the
     * wallet-signed transaction, AND present the trusted issuer's attestation.
     * There is no server-side permission to act as the creator's wallet.
     */
    function createCoinAuthorized(
        AuthorizedCoinRequest calldata request,
        bytes calldata signature
    ) external returns (address coin) {
        require(request.kind == CONTENT || request.kind == TREND, "AUTHORIZED_KIND_ONLY");
        require(
            request.deadline >= block.timestamp &&
            request.deadline <= block.timestamp + MAX_AUTHORIZATION_LIFETIME,
            "AUTHORIZATION_EXPIRED_OR_TOO_LONG"
        );
        require(request.nonce == authorizationNonces[msg.sender], "INVALID_AUTHORIZATION_NONCE");

        bytes32 structHash = keccak256(abi.encode(
            AUTHORIZATION_TYPEHASH,
            msg.sender,
            request.kind,
            request.contentRef,
            keccak256(bytes(request.name)),
            keccak256(bytes(request.symbol)),
            request.initialSupplyTokens,
            keccak256(bytes(request.metadataURI)),
            request.nonce,
            request.deadline
        ));
        require(
            _validAttestation(_typedDataHash(structHash), signature),
            "INVALID_ATTESTATION"
        );

        // Consume before issuance; reverts roll back the nonce and all writes.
        authorizationNonces[msg.sender] = request.nonce + 1;
        coin = _createCoin(
            request.name, request.symbol, request.kind, request.contentRef,
            request.initialSupplyTokens, request.metadataURI
        );
        emit CoinAuthorizationUsed(msg.sender, request.kind, request.contentRef, request.nonce);
    }

    /**
     * @dev EIP-712 v4 digest with chain/factory-bound domain.
     * Explicit encoding preserves Shanghai compatibility without relying on
     * transitive OpenZeppelin Bytes.sol Cancun opcodes.
     */
    function _typedDataHash(bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainHash = keccak256(abi.encode(
            DOMAIN_TYPEHASH, DOMAIN_NAME_HASH, DOMAIN_VERSION_HASH, block.chainid, address(this)
        ));
        return keccak256(abi.encodePacked(bytes2(0x1901), domainHash, structHash));
    }

    /**
     * @dev EOA and ERC-1271 verification without newer Cancun-only Byte helpers.
     * The ECDSA library rejects malleable or malformed EOA signatures.
     */
    function _validAttestation(bytes32 digest, bytes calldata signature) internal view returns (bool) {
        if (attestor.code.length == 0) {
            (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, signature);
            return error == ECDSA.RecoverError.NoError && recovered == attestor;
        }
        try IERC1271(attestor).isValidSignature(digest, signature) returns (bytes4 magic) {
            return magic == IERC1271.isValidSignature.selector;
        } catch {
            return false;
        }
    }

    function _createCoin(
        string calldata name_,
        string calldata symbol_,
        uint8 kind,
        bytes32 contentRef,
        uint256 initialSupplyTokens,
        string calldata metadataURI_
    ) internal returns (address coin) {
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
        else {
            require(contentRef != bytes32(0), "CONTENT_REF_REQUIRED");
            require(referenceCoinFor[kind][contentRef] == address(0), "REFERENCE_ALREADY_LAUNCHED");
        }

        bytes32 key = keccak256(abi.encode(msg.sender, kind, contentRef));
        require(coinFor[key] == address(0), "ALREADY_LAUNCHED");
        coin = address(new LookeCoin(
            name_, symbol_, msg.sender, initialSupplyTokens * 10**18, metadataURI_
        ));
        coinFor[key] = coin;
        if (kind != CREATOR) referenceCoinFor[kind][contentRef] = coin;
        launched.push(coin);
        emit CoinCreated(coin, msg.sender, kind, contentRef, initialSupplyTokens * 10**18, metadataURI_);
    }
}
