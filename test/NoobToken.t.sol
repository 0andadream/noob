// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {NoobToken} from "../src/NoobToken.sol";
import {NoobTokenBurnable} from "../src/NoobTokenBurnable.sol";
import {NoobTokenMintable} from "../src/NoobTokenMintable.sol";
import {NoobTokenMintableBurnable} from "../src/NoobTokenMintableBurnable.sol";

contract NoobTokenTest is Test {
    address internal alice = makeAddr("alice");

    function test_fixedSupplyGoesToDeployer() public {
        NoobToken token = new NoobToken("Maple", "MPL", 1_000 ether);
        assertEq(token.name(), "Maple");
        assertEq(token.symbol(), "MPL");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000 ether);
        assertEq(token.balanceOf(address(this)), 1_000 ether);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_mintableOwnerCanMintAndStrangersCannot() public {
        NoobTokenMintable token = new NoobTokenMintable("Maple", "MPL", 10 ether);
        assertEq(token.owner(), address(this));

        token.mint(alice, 5 ether);
        assertEq(token.balanceOf(alice), 5 ether);
        assertEq(token.totalSupply(), 15 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.mint(alice, 1 ether);
    }

    function test_burnableHolderCanDestroyOwnTokens() public {
        NoobTokenBurnable token = new NoobTokenBurnable("Maple", "MPL", 10 ether);
        token.burn(3 ether);
        assertEq(token.totalSupply(), 7 ether);
        assertEq(token.balanceOf(address(this)), 7 ether);
    }

    function test_mintableBurnableOwnerMintsAndHolderBurns() public {
        NoobTokenMintableBurnable token = new NoobTokenMintableBurnable("Maple", "MPL", 10 ether);
        assertEq(token.owner(), address(this));

        token.mint(alice, 4 ether);
        vm.prank(alice);
        token.burn(1 ether);

        assertEq(token.balanceOf(alice), 3 ether);
        assertEq(token.totalSupply(), 13 ether);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.mint(alice, 1 ether);
    }
}
