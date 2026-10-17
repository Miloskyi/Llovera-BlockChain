// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Llovera} from "../src/Llovera.sol";

/// @notice Despliega tUSDC + Llovera, crea las zonas del Valle de Aburrá y fondea el pool.
/// Uso:
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $PRIVATE_KEY
/// Variables opcionales: ORACLE_ADDRESS (por defecto el desplegador), DEMO_MODE (por defecto true),
/// INITIAL_LIQUIDITY en tUSDC (por defecto 2000).
contract Deploy is Script {
    function run() external returns (MockUSDC usdc, Llovera llovera) {
        address deployer = msg.sender;
        address oracle = vm.envOr("ORACLE_ADDRESS", deployer);
        bool demoMode = vm.envOr("DEMO_MODE", true);
        uint256 initialLiquidity = vm.envOr("INITIAL_LIQUIDITY", uint256(2000)) * 1e6;

        vm.startBroadcast();

        usdc = new MockUSDC();
        llovera = new Llovera(usdc, deployer, oracle);
        if (oracle != deployer) llovera.grantRole(llovera.ORACLE_ROLE(), deployer);
        // Wallet del equipo (MetaMask): queda como admin y oráculo sin compartir su clave privada.
        address owner = vm.envOr("OWNER_ADDRESS", address(0));
        if (owner != address(0)) {
            llovera.grantRole(llovera.DEFAULT_ADMIN_ROLE(), owner);
            llovera.grantRole(llovera.ORACLE_ROLE(), owner);
        }

        // 16 comunas de Medellín + 9 municipios. El índice es el zoneId (ver web/scripts/build-geo.mjs).
        string[25] memory names = [
            "Popular",
            "Santa Cruz",
            "Manrique",
            "Aranjuez",
            "Castilla",
            "Doce de Octubre",
            "Robledo",
            "Villa Hermosa",
            "Buenos Aires",
            "La Candelaria",
            "Laureles-Estadio",
            unicode"La América",
            "San Javier",
            "El Poblado",
            "Guayabal",
            unicode"Belén",
            "Bello",
            "Copacabana",
            "Girardota",
            "Barbosa",
            "Envigado",
            unicode"Itagüí",
            "Sabaneta",
            "La Estrella",
            "Caldas"
        ];
        for (uint256 i; i < names.length; ++i) {
            llovera.addZone(names[i], 350e6); // hasta 100 pólizas de 3.50 por zona y día
        }

        if (demoMode) {
            // Demo: se puede comprar a cualquier hora y la carencia es de 60 segundos.
            llovera.setSchedule(false, 60, 6 hours, 9 hours, 1 days);
        }

        usdc.mint(deployer, initialLiquidity);
        usdc.approve(address(llovera), initialLiquidity);
        llovera.deposit(initialLiquidity);

        // Saldo de prueba para la wallet del equipo.
        if (owner != address(0)) usdc.mint(owner, 500e6);

        vm.stopBroadcast();

        console2.log("MockUSDC:", address(usdc));
        console2.log("Llovera:", address(llovera));
        console2.log("Oracle:", oracle);
    }
}
