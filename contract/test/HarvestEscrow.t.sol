// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {HarvestEscrow} from "../src/HarvestEscrow.sol";

contract HarvestEscrowTest is Test {
    HarvestEscrow internal escrow;

    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    address internal farmer = makeAddr("farmer");
    address internal buyer = makeAddr("buyer");
    address internal stranger = makeAddr("stranger");

    string internal constant CROP = "Rice";
    uint256 internal constant WEIGHT = 100;
    uint256 internal constant PRICE = 1 ether;
    bytes32 internal constant PHOTO_HASH = keccak256("harvest-photo");
    string internal constant PHOTO_URI = "ipfs://harvest-photo";
    string internal constant GRADE_REASON = "ipfs://grade-reason";
    string internal constant DELIVERY_REASON = "ipfs://delivery-reason";

    event ListingCreated(
        uint256 indexed listingId,
        address indexed farmer,
        string cropType,
        uint256 weightKg,
        uint256 priceWei,
        bytes32 photoHash,
        string photoURI
    );
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    function setUp() public {
        vm.prank(owner);
        escrow = new HarvestEscrow(oracle);
        vm.deal(farmer, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    // ---------------------------------------------------------------- helpers

    function _create() internal returns (uint256) {
        vm.prank(farmer);
        return escrow.createListing(CROP, WEIGHT, PRICE, PHOTO_HASH, PHOTO_URI);
    }

    function _createGraded() internal returns (uint256 id) {
        id = _create();
        vm.prank(oracle);
        escrow.postGrade(id, "A", GRADE_REASON, 92);
    }

    function _createFunded() internal returns (uint256 id) {
        id = _createGraded();
        vm.prank(buyer);
        escrow.fundEscrow{value: PRICE}(id);
    }

    function _createShipped() internal returns (uint256 id) {
        id = _createFunded();
        vm.prank(farmer);
        escrow.markShipped(id);
    }

    // ------------------------------------------------------------- happy path

    function test_HappyPath_Matched_ReleasesFunds() public {
        uint256 id = _createShipped();

        uint256 farmerBefore = farmer.balance;

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, true, 91, DELIVERY_REASON);

        HarvestEscrow.Listing memory l = escrow.getListing(id);
        assertEq(uint256(l.status), uint256(HarvestEscrow.Status.Completed));
        assertTrue(l.deliveryVerified);
        assertTrue(l.deliveryMatched);
        assertEq(l.deliveryConfidence, 91);
        assertEq(farmer.balance, farmerBefore + PRICE);
        assertEq(address(escrow).balance, 0);
    }

    function test_HappyPath_BuyerConfirmsReceipt() public {
        uint256 id = _createShipped();
        uint256 farmerBefore = farmer.balance;

        vm.prank(buyer);
        escrow.confirmReceipt(id);

        HarvestEscrow.Listing memory l = escrow.getListing(id);
        assertEq(uint256(l.status), uint256(HarvestEscrow.Status.Completed));
        assertEq(farmer.balance, farmerBefore + PRICE);
    }

    // --------------------------------------------------------------- mismatch

    function test_Mismatch_DisputesAndLocksFunds() public {
        uint256 id = _createShipped();
        uint256 farmerBefore = farmer.balance;

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, false, 88, DELIVERY_REASON);

        HarvestEscrow.Listing memory l = escrow.getListing(id);
        assertEq(uint256(l.status), uint256(HarvestEscrow.Status.Disputed));
        assertTrue(l.deliveryVerified);
        assertFalse(l.deliveryMatched);
        assertEq(farmer.balance, farmerBefore);
        assertEq(address(escrow).balance, PRICE);
    }

    // ---------------------------------------------------------------- timeout

    function test_Timeout_FarmerClaimsAfterDeadline() public {
        uint256 id = _createShipped();
        HarvestEscrow.Listing memory l = escrow.getListing(id);
        uint256 farmerBefore = farmer.balance;

        vm.prank(farmer);
        vm.expectRevert(HarvestEscrow.DeadlineNotReached.selector);
        escrow.claimAfterTimeout(id);

        vm.warp(l.deliveryDeadline + 1);

        vm.prank(farmer);
        escrow.claimAfterTimeout(id);

        HarvestEscrow.Listing memory after_ = escrow.getListing(id);
        assertEq(uint256(after_.status), uint256(HarvestEscrow.Status.Completed));
        assertEq(farmer.balance, farmerBefore + PRICE);
    }

    function test_Timeout_BuyerCannotClaim() public {
        uint256 id = _createShipped();
        HarvestEscrow.Listing memory l = escrow.getListing(id);
        vm.warp(l.deliveryDeadline + 1);

        vm.prank(buyer);
        vm.expectRevert(HarvestEscrow.NotFarmer.selector);
        escrow.claimAfterTimeout(id);

        vm.prank(stranger);
        vm.expectRevert(HarvestEscrow.NotFarmer.selector);
        escrow.claimAfterTimeout(id);
    }

    function test_Timeout_CannotClaimTwice() public {
        uint256 id = _createShipped();
        HarvestEscrow.Listing memory l = escrow.getListing(id);
        vm.warp(l.deliveryDeadline + 1);

        vm.prank(farmer);
        escrow.claimAfterTimeout(id);

        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Completed
            )
        );
        escrow.claimAfterTimeout(id);
    }

    // --------------------------------------------------------- oracle access

    function test_OracleSecurity_NonOracleCannotPostGrade() public {
        uint256 id = _create();

        vm.prank(stranger);
        vm.expectRevert(HarvestEscrow.NotOracle.selector);
        escrow.postGrade(id, "A", GRADE_REASON, 90);

        vm.prank(farmer);
        vm.expectRevert(HarvestEscrow.NotOracle.selector);
        escrow.postGrade(id, "A", GRADE_REASON, 90);

        vm.prank(owner);
        vm.expectRevert(HarvestEscrow.NotOracle.selector);
        escrow.postGrade(id, "A", GRADE_REASON, 90);
    }

    function test_OracleSecurity_NonOracleCannotPostDelivery() public {
        uint256 id = _createShipped();

        vm.prank(stranger);
        vm.expectRevert(HarvestEscrow.NotOracle.selector);
        escrow.postDeliveryVerification(id, true, 90, DELIVERY_REASON);
    }

    // -------------------------------------------------------- grade integrity

    function test_GradeImmutability_CannotOverwrite() public {
        uint256 id = _createGraded();

        vm.prank(oracle);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Graded)
        );
        escrow.postGrade(id, "C", "ipfs://evil", 10);
    }

    function test_GradeValidation_RejectsInvalidGrade() public {
        uint256 id = _create();

        vm.startPrank(oracle);
        vm.expectRevert(HarvestEscrow.InvalidGrade.selector);
        escrow.postGrade(id, "D", GRADE_REASON, 90);

        vm.expectRevert(HarvestEscrow.InvalidGrade.selector);
        escrow.postGrade(id, "AA", GRADE_REASON, 90);

        vm.expectRevert(HarvestEscrow.InvalidGrade.selector);
        escrow.postGrade(id, "", GRADE_REASON, 90);
        vm.stopPrank();
    }

    function test_GradeValidation_RejectsConfidenceAbove100() public {
        uint256 id = _create();

        vm.prank(oracle);
        vm.expectRevert(HarvestEscrow.InvalidConfidence.selector);
        escrow.postGrade(id, "A", GRADE_REASON, 101);
    }

    function test_DeliveryValidation_RejectsConfidenceAbove100() public {
        uint256 id = _createShipped();

        vm.prank(oracle);
        vm.expectRevert(HarvestEscrow.InvalidConfidence.selector);
        escrow.postDeliveryVerification(id, true, 101, DELIVERY_REASON);
    }

    // ---------------------------------------------------- double-spend guards

    function test_DoubleSpend_CannotConfirmReceiptAfterCompleted() public {
        uint256 id = _createShipped();

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, true, 95, DELIVERY_REASON);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Completed
            )
        );
        escrow.confirmReceipt(id);
    }

    function test_DoubleSpend_CannotClaimAfterConfirmReceipt() public {
        uint256 id = _createShipped();
        HarvestEscrow.Listing memory l = escrow.getListing(id);

        vm.prank(buyer);
        escrow.confirmReceipt(id);

        vm.warp(l.deliveryDeadline + 1);
        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Completed
            )
        );
        escrow.claimAfterTimeout(id);
    }

    function test_DoubleSpend_CannotResolveTwice() public {
        uint256 id = _createShipped();

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, false, 80, DELIVERY_REASON);

        vm.prank(owner);
        escrow.resolveDispute(id, true);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Completed
            )
        );
        escrow.resolveDispute(id, true);
    }

    function test_DoubleSpend_TotalPaidNeverExceedsEscrow() public {
        uint256 id = _createShipped();
        uint256 farmerBefore = farmer.balance;

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, true, 95, DELIVERY_REASON);

        assertEq(farmer.balance, farmerBefore + PRICE);
        assertEq(address(escrow).balance, 0);

        // Every release path must now revert.
        vm.prank(buyer);
        vm.expectRevert();
        escrow.confirmReceipt(id);

        vm.prank(farmer);
        vm.expectRevert();
        escrow.claimAfterTimeout(id);

        vm.prank(owner);
        vm.expectRevert();
        escrow.resolveDispute(id, true);
    }

    // ------------------------------------------------------ funding integrity

    function test_Fund_RejectsWrongAmount() public {
        uint256 id = _createGraded();

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.IncorrectPayment.selector, 0.5 ether, PRICE)
        );
        escrow.fundEscrow{value: 0.5 ether}(id);
    }

    function test_Fund_RejectsFundingUngradedListing() public {
        uint256 id = _create();

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Created)
        );
        escrow.fundEscrow{value: PRICE}(id);
    }

    function test_Fund_CannotFundTwice() public {
        uint256 id = _createFunded();

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Funded)
        );
        escrow.fundEscrow{value: PRICE}(id);
    }

    function test_Create_RejectsZeroPrice() public {
        vm.prank(farmer);
        vm.expectRevert(HarvestEscrow.InvalidPrice.selector);
        escrow.createListing(CROP, WEIGHT, 0, PHOTO_HASH, PHOTO_URI);
    }

    // --------------------------------------------------------------- shipping

    function test_Ship_OnlyFarmerCanMarkShipped() public {
        uint256 id = _createFunded();

        vm.prank(buyer);
        vm.expectRevert(HarvestEscrow.NotFarmer.selector);
        escrow.markShipped(id);

        vm.prank(oracle);
        vm.expectRevert(HarvestEscrow.NotFarmer.selector);
        escrow.markShipped(id);
    }

    function test_Ship_RequiresFundedStatus() public {
        uint256 id = _createGraded();

        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Graded)
        );
        escrow.markShipped(id);
    }

    function test_Ship_SetsDeadlineFromConfiguredTimeout() public {
        uint256 id = _createFunded();
        uint256 expectedDeadline = block.timestamp + escrow.deliveryTimeout();

        vm.prank(farmer);
        escrow.markShipped(id);

        HarvestEscrow.Listing memory l = escrow.getListing(id);
        assertEq(l.deliveryDeadline, expectedDeadline);
    }

    // ---------------------------------------------------------- oracle admin

    function test_SetOracle_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(HarvestEscrow.NotOwner.selector);
        escrow.setOracle(stranger);

        address newOracle = makeAddr("newOracle");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit OracleUpdated(oracle, newOracle);
        escrow.setOracle(newOracle);

        assertEq(escrow.oracle(), newOracle);

        // Old oracle loses access, new oracle gains it.
        uint256 id = _create();
        vm.prank(oracle);
        vm.expectRevert(HarvestEscrow.NotOracle.selector);
        escrow.postGrade(id, "A", GRADE_REASON, 90);

        vm.prank(newOracle);
        escrow.postGrade(id, "A", GRADE_REASON, 90);
        assertEq(escrow.getListing(id).grade, "A");
    }

    function test_SetOracle_RejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(HarvestEscrow.ZeroAddress.selector);
        escrow.setOracle(address(0));
    }

    function test_ResolveDispute_OnlyOwner() public {
        uint256 id = _createShipped();
        vm.prank(oracle);
        escrow.postDeliveryVerification(id, false, 80, DELIVERY_REASON);

        vm.prank(stranger);
        vm.expectRevert(HarvestEscrow.NotOwner.selector);
        escrow.resolveDispute(id, true);
    }

    function test_ResolveDispute_CanRefundBuyer() public {
        uint256 id = _createShipped();
        vm.prank(oracle);
        escrow.postDeliveryVerification(id, false, 80, DELIVERY_REASON);

        uint256 buyerBefore = buyer.balance;
        vm.prank(owner);
        escrow.resolveDispute(id, false);

        assertEq(buyer.balance, buyerBefore + PRICE);
        assertEq(address(escrow).balance, 0);
    }

    function test_ResolveDispute_RequiresDisputedStatus() public {
        uint256 id = _createShipped();
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(HarvestEscrow.InvalidStatus.selector, HarvestEscrow.Status.Shipped)
        );
        escrow.resolveDispute(id, true);
    }

    // ------------------------------------------------------ listing integrity

    function test_GetListing_RevertsForUnknownId() public {
        vm.expectRevert(HarvestEscrow.InvalidListing.selector);
        escrow.getListing(999);
    }

    function test_ListingIds_AreSequential() public {
        uint256 first = _create();
        vm.prank(stranger);
        uint256 second = escrow.createListing("Corn", 50, 0.5 ether, keccak256("x"), "ipfs://x");

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(escrow.listingCount(), 2);
    }

    function test_Constructor_RejectsZeroOracle() public {
        vm.expectRevert(HarvestEscrow.ZeroAddress.selector);
        new HarvestEscrow(address(0));
    }

    // --------------------------------------------------------------- reentrancy

    function test_Reentrancy_MaliciousFarmerCannotDrain() public {
        ReentrantFarmer attacker = new ReentrantFarmer(escrow);
        vm.deal(address(attacker), 0);

        vm.prank(address(attacker));
        uint256 id = escrow.createListing(CROP, WEIGHT, PRICE, PHOTO_HASH, PHOTO_URI);

        vm.prank(oracle);
        escrow.postGrade(id, "A", GRADE_REASON, 92);

        vm.prank(buyer);
        escrow.fundEscrow{value: PRICE}(id);

        vm.prank(address(attacker));
        escrow.markShipped(id);

        vm.prank(oracle);
        escrow.postDeliveryVerification(id, true, 95, DELIVERY_REASON);

        assertEq(address(attacker).balance, PRICE);
        assertEq(address(escrow).balance, 0);
    }

    function test_Reentrancy_MaliciousFarmerCannotReenterViaTimeout() public {
        ReentrantFarmer attacker = new ReentrantFarmer(escrow);
        vm.deal(address(attacker), 0);

        vm.prank(address(attacker));
        uint256 id = escrow.createListing(CROP, WEIGHT, PRICE, PHOTO_HASH, PHOTO_URI);

        vm.prank(oracle);
        escrow.postGrade(id, "A", GRADE_REASON, 92);

        vm.prank(buyer);
        escrow.fundEscrow{value: PRICE}(id);

        vm.prank(address(attacker));
        escrow.markShipped(id);

        HarvestEscrow.Listing memory l = escrow.getListing(id);
        vm.warp(l.deliveryDeadline + 1);

        vm.prank(address(attacker));
        escrow.claimAfterTimeout(id);

        assertEq(address(attacker).balance, PRICE);
        assertEq(address(escrow).balance, 0);
    }
}

contract ReentrantFarmer {
    HarvestEscrow internal immutable escrow;
    uint256 internal listingId;

    constructor(HarvestEscrow escrow_) {
        escrow = escrow_;
    }

    receive() external payable {
        // Attempt to re-enter the payout path. nonReentrant must block it.
        if (listingId != 0) {
            escrow.confirmReceipt(listingId);
        }
    }

    function createListing(
        string calldata cropType,
        uint256 weightKg,
        uint256 priceWei,
        bytes32 photoHash,
        string calldata photoURI
    ) external returns (uint256) {
        listingId = escrow.createListing(cropType, weightKg, priceWei, photoHash, photoURI);
        return listingId;
    }

    function markShipped(uint256 id) external {
        escrow.markShipped(id);
    }
}
