// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Fluid RAIN distributor (Arc / any EVM) — Merkle claims with platform fee.
// Design (docs/FEES.md):
//  * Players claim RAIN with a Merkle proof (Easter-egg hunt claims).
//  * A small platform fee (feeBps, set at deploy) is taken from each claim.
//  * The fee is ACCOUNTED 60/40 on-chain: feeTreasury (Ethuram) / feeDripbot.
//  * Settlement of the split is in BTC over LIGHTNING, off-chain: the
//    DripBot keeper sweeps accumulated fees, converts to BTC and pays both
//    Lightning addresses (see FEE_SPLIT in src/wallet-core.js). This
//    contract only guarantees the 60/40 accounting can never be skewed.
//  * Unclaimed allocations simply never move — no expiry sweep needed here;
//    the weekly root rotation handles the 7-day expiry from the bible.
import {IERC20} from "./IERC20.sol";
import {MerkleProof} from "./MerkleProof.sol";

contract RainDistributor {
    IERC20 public immutable token;
    bytes32 public merkleRoot;
    address public admin;
    uint256 public immutable feeBps; // e.g. 200 = 2%
    mapping(address => bool) public claimed;
    uint256 public feeTreasury; // 60% share, in token units
    uint256 public feeDripbot;  // 40% share, in token units

    event Claimed(address indexed user, uint256 gross, uint256 fee, uint256 net);
    event RootUpdated(bytes32 newRoot);

    constructor(address token_, bytes32 root_, uint256 feeBps_) {
        require(feeBps_ <= 1000, "fee cap 10%");
        token = IERC20(token_);
        merkleRoot = root_;
        feeBps = feeBps_;
        admin = msg.sender;
    }

    function setRoot(bytes32 root_) external {
        require(msg.sender == admin, "admin only");
        merkleRoot = root_;
        emit RootUpdated(root_);
    }

    function claim(uint256 amount, bytes32[] calldata proof) external {
        require(!claimed[msg.sender], "already claimed this drop");
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "bad proof");
        claimed[msg.sender] = true;
        uint256 fee = (amount * feeBps) / 10_000;
        // 60/40 split of the fee; rounding remainder to treasury.
        uint256 drip = (fee * 40) / 100;
        feeDripbot += drip;
        feeTreasury += fee - drip;
        require(token.transfer(msg.sender, amount - fee), "transfer failed");
        emit Claimed(msg.sender, amount, fee, amount - fee);
    }

    // Fees stay in this contract until the keeper sweeps them for the
    // BTC-Lightning settlement; the counters above are the source of truth
    // for who is owed what.
    function sweepFees(address to) external {
        require(msg.sender == admin, "admin only");
        uint256 total = feeTreasury + feeDripbot;
        require(total > 0, "nothing to sweep");
        feeTreasury = 0;
        feeDripbot = 0;
        require(token.transfer(to, total), "sweep failed");
    }
}
