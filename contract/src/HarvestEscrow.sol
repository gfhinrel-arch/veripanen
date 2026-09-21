// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HarvestEscrow
/// @notice VeriPanen core escrow. Off-chain AI grades harvest (Stage 1) and verifies
///         delivered goods (Stage 2). A trusted oracle address records both results
///         on-chain; this contract never calls AI directly.
contract HarvestEscrow is ReentrancyGuard {
    enum Status {
        Created,
        Graded,
        Funded,
        Shipped,
        Completed,
        Disputed
    }

    struct Listing {
        uint256 listingId;
        address farmer;
        address buyer;
        string cropType;
        uint256 weightKg;
        uint256 priceWei;
        bytes32 photoHash;
        string photoURI;
        string grade;
        string gradeReasonURI;
        uint256 gradeConfidence;
        bool deliveryVerified;
        bool deliveryMatched;
        string deliveryReasonURI;
        uint256 deliveryConfidence;
        Status status;
        uint256 deliveryDeadline;
    }

    uint256 public constant DEFAULT_TIMEOUT = 7 days;

    address public owner;
    address public oracle;
    uint256 public deliveryTimeout = DEFAULT_TIMEOUT;
    uint256 public listingCount;

    mapping(uint256 => Listing) private _listings;

    error NotOwner();
    error NotOracle();
    error NotFarmer();
    error NotBuyer();
    error ZeroAddress();
    error InvalidListing();
    error InvalidStatus(Status current);
    error InvalidGrade();
    error InvalidConfidence();
    error InvalidPrice();
    error IncorrectPayment(uint256 sent, uint256 required);
    error DeadlineNotReached();
    error TransferFailed();

    event ListingCreated(
        uint256 indexed listingId,
        address indexed farmer,
        string cropType,
        uint256 weightKg,
        uint256 priceWei,
        bytes32 photoHash,
        string photoURI
    );
    event GradePosted(
        uint256 indexed listingId,
        string grade,
        uint256 confidence,
        string reasonURI
    );
    event EscrowFunded(uint256 indexed listingId, address indexed buyer, uint256 amount);
    event ShipmentMarked(uint256 indexed listingId, uint256 deliveryDeadline);
    event DeliveryVerified(
        uint256 indexed listingId,
        bool matched,
        uint256 confidence,
        string reasonURI
    );
    event ReceiptConfirmed(uint256 indexed listingId, address indexed farmer, uint256 amount);
    event TimeoutClaimed(uint256 indexed listingId, address indexed farmer, uint256 amount);
    event DisputeResolved(uint256 indexed listingId, bool releaseToFarmer, uint256 amount);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event DeliveryTimeoutUpdated(uint256 previousTimeout, uint256 newTimeout);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    modifier atStatus(uint256 listingId, Status expected) {
        if (_listings[listingId].farmer == address(0)) revert InvalidListing();
        if (_listings[listingId].status != expected) revert InvalidStatus(_listings[listingId].status);
        _;
    }

    constructor(address oracle_) {
        if (oracle_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        oracle = oracle_;
        emit OracleUpdated(address(0), oracle_);
    }

    // ---------------------------------------------------------------- farmer

    function createListing(
        string calldata cropType,
        uint256 weightKg,
        uint256 priceWei,
        bytes32 photoHash,
        string calldata photoURI
    ) external returns (uint256 listingId) {
        if (priceWei == 0) revert InvalidPrice();
        if (photoHash == bytes32(0)) revert InvalidListing();

        listingId = ++listingCount;
        Listing storage l = _listings[listingId];
        l.listingId = listingId;
        l.farmer = msg.sender;
        l.cropType = cropType;
        l.weightKg = weightKg;
        l.priceWei = priceWei;
        l.photoHash = photoHash;
        l.photoURI = photoURI;
        l.status = Status.Created;

        emit ListingCreated(listingId, msg.sender, cropType, weightKg, priceWei, photoHash, photoURI);
    }

    function markShipped(uint256 listingId)
        external
        atStatus(listingId, Status.Funded)
    {
        Listing storage l = _listings[listingId];
        if (msg.sender != l.farmer) revert NotFarmer();

        l.deliveryDeadline = block.timestamp + deliveryTimeout;
        l.status = Status.Shipped;

        emit ShipmentMarked(listingId, l.deliveryDeadline);
    }

    function claimAfterTimeout(uint256 listingId)
        external
        nonReentrant
        atStatus(listingId, Status.Shipped)
    {

        Listing storage l = _listings[listingId];
        if (msg.sender != l.farmer) revert NotFarmer();
        if (block.timestamp <= l.deliveryDeadline) revert DeadlineNotReached();

        uint256 amount = l.priceWei;
        l.status = Status.Completed;

        _payout(l.farmer, amount);

        emit TimeoutClaimed(listingId, l.farmer, amount);
    }

    // ----------------------------------------------------------------- buyer

    function fundEscrow(uint256 listingId) external payable atStatus(listingId, Status.Graded) {
        Listing storage l = _listings[listingId];
        if (msg.value != l.priceWei) revert IncorrectPayment(msg.value, l.priceWei);

        l.buyer = msg.sender;
        l.status = Status.Funded;

        emit EscrowFunded(listingId, msg.sender, msg.value);
    }

    function confirmReceipt(uint256 listingId)
        external
        nonReentrant
        atStatus(listingId, Status.Shipped)
    {
        Listing storage l = _listings[listingId];
        if (msg.sender != l.buyer) revert NotBuyer();

        uint256 amount = l.priceWei;
        l.status = Status.Completed;

        _payout(l.farmer, amount);

        emit ReceiptConfirmed(listingId, l.farmer, amount);
    }

    // ---------------------------------------------------------------- oracle

    function postGrade(
        uint256 listingId,
        string calldata grade,
        string calldata reasonURI,
        uint256 confidence
    ) external onlyOracle atStatus(listingId, Status.Created) {
        Listing storage l = _listings[listingId];
        if (!_isValidGrade(grade)) revert InvalidGrade();
        if (confidence > 100) revert InvalidConfidence();

        l.grade = grade;
        l.gradeReasonURI = reasonURI;
        l.gradeConfidence = confidence;
        l.status = Status.Graded;

        emit GradePosted(listingId, grade, confidence, reasonURI);
    }

    function postDeliveryVerification(
        uint256 listingId,
        bool matched,
        uint256 confidence,
        string calldata reasonURI
    ) external nonReentrant onlyOracle atStatus(listingId, Status.Shipped) {
        Listing storage l = _listings[listingId];
        if (confidence > 100) revert InvalidConfidence();

        l.deliveryVerified = true;
        l.deliveryMatched = matched;
        l.deliveryConfidence = confidence;
        l.deliveryReasonURI = reasonURI;
        l.status = matched ? Status.Completed : Status.Disputed;

        emit DeliveryVerified(listingId, matched, confidence, reasonURI);

        if (matched) {
            _payout(l.farmer, l.priceWei);
        }
    }

    // ----------------------------------------------------------------- owner

    function resolveDispute(uint256 listingId, bool releaseToFarmer)
        external
        onlyOwner
        nonReentrant
        atStatus(listingId, Status.Disputed)
    {
        Listing storage l = _listings[listingId];
        uint256 amount = l.priceWei;
        l.status = Status.Completed;

        _payout(releaseToFarmer ? l.farmer : l.buyer, amount);

        emit DisputeResolved(listingId, releaseToFarmer, amount);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        address previous = oracle;
        oracle = newOracle;
        emit OracleUpdated(previous, newOracle);
    }

    function setDeliveryTimeout(uint256 newTimeout) external onlyOwner {
        if (newTimeout == 0) revert InvalidListing();
        uint256 previous = deliveryTimeout;
        deliveryTimeout = newTimeout;
        emit DeliveryTimeoutUpdated(previous, newTimeout);
    }

    // ------------------------------------------------------------------ view

    function getListing(uint256 listingId) external view returns (Listing memory) {
        if (_listings[listingId].farmer == address(0)) revert InvalidListing();
        return _listings[listingId];
    }

    // -------------------------------------------------------------- internal

    function _isValidGrade(string calldata grade) private pure returns (bool) {
        bytes calldata g = bytes(grade);
        if (g.length != 1) return false;
        return g[0] == "A" || g[0] == "B" || g[0] == "C";
    }

    function _payout(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
