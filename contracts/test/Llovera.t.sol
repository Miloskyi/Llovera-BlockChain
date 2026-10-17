// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Llovera} from "../src/Llovera.sol";

contract LloveraTest is Test {
    MockUSDC usdc;
    Llovera llovera;

    address admin = makeAddr("admin");
    address oracle = makeAddr("oracle");
    address lp = makeAddr("lp");
    address ana = makeAddr("ana");
    address beto = makeAddr("beto");
    address caro = makeAddr("caro");

    uint256 constant DAY = 20_000;
    uint256 constant ARANJUEZ = 0;
    uint256 constant ITAGUI = 1;
    uint256 constant FEE = 0.01 ether;

    function setUp() public {
        usdc = new MockUSDC();
        llovera = new Llovera(usdc, admin, oracle);
        vm.startPrank(admin);
        llovera.addZone("Aranjuez", 350e6);
        llovera.addZone(unicode"Itagüí", 7e6); // capacidad para solo 2 pólizas
        vm.stopPrank();

        usdc.mint(lp, 1000e6);
        vm.startPrank(lp);
        usdc.approve(address(llovera), type(uint256).max);
        llovera.deposit(1000e6);
        vm.stopPrank();

        address[3] memory riders = [ana, beto, caro];
        for (uint256 i; i < riders.length; ++i) {
            usdc.mint(riders[i], 10e6);
            vm.deal(riders[i], 1 ether);
            vm.prank(riders[i]);
            usdc.approve(address(llovera), type(uint256).max);
        }
        _warpLocal(7 hours);
    }

    function _warpLocal(uint256 tod) internal {
        vm.warp(DAY * 1 days + 5 hours + tod);
    }

    function _buy(address who, uint256 zone) internal returns (uint256) {
        uint256 fee = FEE; // constante: leer policyFee() aquí consumiría el expectRevert de los tests
        vm.prank(who);
        return llovera.buyPolicy{value: fee}(zone);
    }

    function test_BuyChargesMonFee() public {
        _buy(ana, ARANJUEZ);
        assertEq(ana.balance, 1 ether - 0.01 ether);
        assertEq(address(llovera).balance, 0.01 ether);

        vm.prank(admin);
        llovera.withdrawFees(payable(admin));
        assertEq(admin.balance, 0.01 ether);
        assertEq(address(llovera).balance, 0);
    }

    function test_BuyRejectsWrongFee() public {
        vm.expectRevert(abi.encodeWithSelector(Llovera.WrongFee.selector, 0.01 ether));
        vm.prank(ana);
        llovera.buyPolicy(ARANJUEZ);
    }

    function test_BuyChargesPremiumAndLocksPayout() public {
        uint256 id = _buy(ana, ARANJUEZ);
        assertEq(usdc.balanceOf(ana), 10e6 - 0.25e6);
        assertEq(llovera.lockedLiability(), 3.5e6);
        Llovera.Policy memory p = llovera.getPolicy(id);
        assertEq(p.day, DAY);
        assertEq(p.activeFrom, block.timestamp + 60 minutes);
    }

    function test_StormPaysActivePoliciesInSameTx() public {
        _buy(ana, ARANJUEZ);
        _buy(beto, ARANJUEZ);
        _buy(caro, ITAGUI);
        vm.warp(block.timestamp + 61 minutes);

        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 182); // 18.2 mm/h

        assertEq(usdc.balanceOf(ana), 10e6 - 0.25e6 + 3.5e6);
        assertEq(usdc.balanceOf(beto), 10e6 - 0.25e6 + 3.5e6);
        assertEq(usdc.balanceOf(caro), 10e6 - 0.25e6); // otra zona, no cobra
        assertEq(llovera.lockedLiability(), 3.5e6);
    }

    function test_CooldownBlocksImmediatePayout() public {
        uint256 id = _buy(ana, ARANJUEZ);
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 200);
        assertFalse(llovera.getPolicy(id).paid);

        vm.expectRevert(Llovera.NotEligible.selector);
        vm.prank(ana);
        llovera.claim(id);

        // Si sigue lloviendo después de la carencia, sí paga.
        vm.warp(block.timestamp + 31 minutes);
        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 200);
        assertTrue(llovera.getPolicy(id).paid);
    }

    function test_LightRainDoesNotPay() public {
        uint256 id = _buy(ana, ARANJUEZ);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 149);
        assertFalse(llovera.getPolicy(id).paid);
    }

    function test_SalesWindowEnforced() public {
        _warpLocal(10 hours);
        assertEq(uint256(llovera.salesStatus(ARANJUEZ, ana)), uint256(Llovera.SalesStatus.OutsideWindow));
        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.OutsideWindow));
        _buy(ana, ARANJUEZ);
    }

    function test_CannotBuyWhileRaining() public {
        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 160);
        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.RainingNow));
        _buy(ana, ARANJUEZ);
    }

    function test_ForecastSurgeAndClose() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = ARANJUEZ;
        ids[1] = ITAGUI;
        uint256[] memory probs = new uint256[](2);
        probs[0] = 60;
        probs[1] = 85;
        vm.prank(oracle);
        llovera.setForecastBatch(ids, probs);

        assertEq(llovera.quote(ARANJUEZ), 0.375e6);
        _buy(ana, ARANJUEZ);
        assertEq(usdc.balanceOf(ana), 10e6 - 0.375e6);

        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.ForecastTooHigh));
        _buy(beto, ITAGUI);
    }

    function test_OnePolicyPerZonePerDay() public {
        _buy(ana, ARANJUEZ);
        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.AlreadyInsured));
        _buy(ana, ARANJUEZ);
        _buy(ana, ITAGUI); // otra zona sí
    }

    function test_ZoneCapacity() public {
        _buy(ana, ITAGUI);
        _buy(beto, ITAGUI);
        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.ZoneCapacityFull));
        _buy(caro, ITAGUI);
    }

    function test_BatchSettleAndManualClaim() public {
        vm.prank(admin);
        llovera.setRiskParams(50, 80, 1, 1 days); // solo 1 pago automático por tx
        uint256 a = _buy(ana, ARANJUEZ);
        uint256 b = _buy(beto, ARANJUEZ);
        uint256 c = _buy(caro, ARANJUEZ);
        vm.warp(block.timestamp + 61 minutes);
        vm.prank(oracle);
        llovera.reportRain(ARANJUEZ, 300);
        assertTrue(llovera.getPolicy(a).paid);
        assertFalse(llovera.getPolicy(b).paid);

        llovera.settle(ARANJUEZ, DAY, 10); // cualquiera puede hacer de keeper
        assertTrue(llovera.getPolicy(b).paid);
        assertTrue(llovera.getPolicy(c).paid);

        vm.expectRevert(Llovera.AlreadyPaid.selector);
        vm.prank(caro);
        llovera.claim(c);
        assertEq(llovera.lockedLiability(), 0);
    }

    function test_FinalizeReleasesLiquidityWhenNoRain() public {
        _buy(ana, ARANJUEZ);
        vm.expectRevert(Llovera.TooEarly.selector);
        llovera.finalize(ARANJUEZ, DAY);

        vm.warp(llovera.dayStart(DAY) + 2 days);
        llovera.finalize(ARANJUEZ, DAY);
        assertEq(llovera.lockedLiability(), 0);
        assertEq(llovera.totalAssets(), 1000e6 + 0.25e6);
    }

    function test_LpEarnsPremiumsAndCannotWithdrawLocked() public {
        _buy(ana, ARANJUEZ);
        uint256 shares = llovera.sharesOf(lp);
        vm.expectRevert(Llovera.InsufficientFreeLiquidity.selector);
        vm.prank(lp);
        llovera.withdraw(shares);

        vm.warp(llovera.dayStart(DAY) + 2 days);
        llovera.finalize(ARANJUEZ, DAY);
        vm.prank(lp);
        uint256 out = llovera.withdraw(shares);
        assertApproxEqAbs(out, 1000e6 + 0.25e6, 1);
    }

    function test_OnlyOracleReports() public {
        vm.expectRevert();
        vm.prank(ana);
        llovera.reportRain(ARANJUEZ, 300);
    }

    function test_PoolLiquidityLimitsSales() public {
        MockUSDC u2 = new MockUSDC();
        Llovera small = new Llovera(u2, admin, oracle);
        vm.prank(admin);
        small.addZone("Bello", 350e6);
        u2.mint(ana, 10e6);
        vm.startPrank(ana);
        u2.approve(address(small), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(Llovera.SalesClosed.selector, Llovera.SalesStatus.PoolLiquidityLow));
        small.buyPolicy{value: 0.01 ether}(0);
        vm.stopPrank();
    }

    function test_FaucetCooldown() public {
        vm.prank(ana);
        usdc.faucet();
        vm.expectRevert();
        vm.prank(ana);
        usdc.faucet();
        vm.warp(block.timestamp + 1 days);
        vm.prank(ana);
        usdc.faucet();
        assertEq(usdc.balanceOf(ana), 10e6 + 200e6);
    }
}
