// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Llovera
/// @notice Fondo mutual de protección de ingresos paramétrico para repartidores del Valle de Aburrá.
///         El usuario asegura una ZONA durante el día. Si el oráculo reporta lluvia fuerte en esa zona
///         mientras la cobertura está activa, el contrato paga automáticamente, sin reclamos.
/// @dev Todas las horas se manejan en hora de Colombia (UTC-5, sin horario de verano).
contract Llovera is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint256 public constant TZ_OFFSET = 5 hours; // Colombia = UTC-5
    uint256 private constant VIRTUAL_SHARES = 1e3;

    // ───────────────────────────── Tipos ─────────────────────────────

    struct Zone {
        string name;
        bool active;
        uint256 maxExposurePerDay; // pago máximo total que el fondo acepta por zona y día
    }

    struct Policy {
        address holder;
        uint32 zoneId;
        uint32 day;
        uint64 purchasedAt;
        uint64 activeFrom; // purchasedAt + carencia
        uint128 premium;
        uint128 payout;
        bool paid;
    }

    struct ZoneDay {
        uint256 exposure; // suma de pagos comprometidos
        uint256 paidOut; // suma de pagos ya hechos
        uint64 lastTriggerAt; // última vez que se reportó lluvia sobre el umbral
        uint32 cursor; // siguiente póliza a liquidar en el lote
        uint16 maxRainX10; // lluvia máxima del día (décimas de mm/h)
        uint8 forecastProb; // probabilidad de lluvia pronosticada (0-100)
        bool finalized;
    }

    struct Reading {
        uint16 rainX10; // décimas de mm/h
        uint64 timestamp;
    }

    enum SalesStatus {
        Open,
        ZoneInactive,
        OutsideWindow,
        CoverageEnded,
        ForecastTooHigh,
        RainingNow,
        ZoneCapacityFull,
        PoolLiquidityLow,
        AlreadyInsured
    }

    // ───────────────────────────── Estado ─────────────────────────────

    IERC20 public immutable usdc;

    // Parámetros del producto
    uint256 public basePremium = 0.25e6; // 0.25 USDC
    uint256 public payoutAmount = 3.5e6; // 3.50 USDC
    uint256 public policyFee = 0.01 ether; // tarifa de servicio en MON nativo, aparte de la prima
    uint16 public rainThresholdX10 = 150; // 15.0 mm/h
    uint32 public cooldown = 60 minutes; // período de carencia
    uint32 public windowStart = 6 hours; // ventana de compra: 6:00 AM
    uint32 public windowEnd = 9 hours; // hasta 9:00 AM
    uint32 public coverageEnd = 20 hours; // la cobertura termina a las 8:00 PM
    bool public enforceWindow = true;
    uint8 public forecastSurgeProb = 50; // desde 50% de probabilidad la prima sube 50%
    uint8 public forecastCloseProb = 80; // desde 80% se cierra la venta
    uint32 public autoSettleMax = 40; // pólizas pagadas dentro de la misma tx del oráculo
    uint32 public claimGrace = 1 days; // tiempo extra para reclamar manualmente

    Zone[] internal _zones;
    Policy[] internal _policies;
    mapping(uint256 => mapping(uint256 => ZoneDay)) public zoneDays; // zoneId => day => datos
    mapping(uint256 => mapping(uint256 => uint256[])) internal _zoneDayPolicies;
    mapping(uint256 => Reading) public latestReading;
    mapping(address => uint256[]) internal _userPolicies;
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) public hasPolicy; // holder => zone => day

    // Pool de liquidez
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    uint256 public lockedLiability;
    uint256 public totalPremiums;
    uint256 public totalPayouts;

    // ───────────────────────────── Eventos ─────────────────────────────

    event ZoneAdded(uint256 indexed zoneId, string name, uint256 maxExposurePerDay);
    event ZoneUpdated(uint256 indexed zoneId, bool active, uint256 maxExposurePerDay);
    event PolicyPurchased(
        uint256 indexed policyId, address indexed holder, uint256 indexed zoneId, uint256 day, uint256 premium, uint256 activeFrom
    );
    event RainReported(uint256 indexed zoneId, uint256 indexed day, uint256 rainX10, bool triggered);
    event ForecastSet(uint256 indexed zoneId, uint256 indexed day, uint256 prob);
    event PolicyPaid(uint256 indexed policyId, address indexed holder, uint256 indexed zoneId, uint256 amount);
    event ZoneDayFinalized(uint256 indexed zoneId, uint256 indexed day, uint256 released);
    event Deposited(address indexed provider, uint256 assets, uint256 shares);
    event Withdrawn(address indexed provider, uint256 assets, uint256 shares);
    event ParamsUpdated();
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ───────────────────────────── Errores ─────────────────────────────

    error SalesClosed(SalesStatus status);
    error InvalidZone();
    error NotEligible();
    error AlreadyPaid();
    error TooEarly();
    error AlreadyFinalized();
    error InsufficientFreeLiquidity();
    error ZeroAmount();
    error LengthMismatch();
    error WrongFee(uint256 expected);

    constructor(IERC20 usdc_, address admin, address oracle) {
        usdc = usdc_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
    }

    // ───────────────────────────── Tiempo ─────────────────────────────

    /// @notice Día actual en hora de Colombia (días desde epoch).
    function currentDay() public view returns (uint256) {
        return (block.timestamp - TZ_OFFSET) / 1 days;
    }

    /// @notice Segundos desde la medianoche en hora de Colombia.
    function localTimeOfDay() public view returns (uint256) {
        return (block.timestamp - TZ_OFFSET) % 1 days;
    }

    /// @notice Timestamp UTC de la medianoche (hora Colombia) del día dado.
    function dayStart(uint256 day) public pure returns (uint256) {
        return day * 1 days + TZ_OFFSET;
    }

    // ───────────────────────────── Pólizas ─────────────────────────────

    /// @notice Prima actual de una zona, ajustada por el pronóstico.
    function quote(uint256 zoneId) public view returns (uint256) {
        uint256 prob = zoneDays[zoneId][currentDay()].forecastProb;
        return prob >= forecastSurgeProb ? (basePremium * 150) / 100 : basePremium;
    }

    /// @notice Si un usuario puede comprar cobertura ahora en la zona, y si no, por qué.
    function salesStatus(uint256 zoneId, address holder) public view returns (SalesStatus) {
        if (zoneId >= _zones.length || !_zones[zoneId].active) return SalesStatus.ZoneInactive;
        uint256 tod = localTimeOfDay();
        if (enforceWindow && (tod < windowStart || tod >= windowEnd)) return SalesStatus.OutsideWindow;
        if (tod + cooldown >= coverageEnd) return SalesStatus.CoverageEnded;
        uint256 day = currentDay();
        ZoneDay storage zd = zoneDays[zoneId][day];
        if (zd.forecastProb >= forecastCloseProb) return SalesStatus.ForecastTooHigh;
        if (_isRainingNow(zoneId)) return SalesStatus.RainingNow;
        if (hasPolicy[holder][zoneId][day]) return SalesStatus.AlreadyInsured;
        if (zd.exposure + payoutAmount > _zones[zoneId].maxExposurePerDay) return SalesStatus.ZoneCapacityFull;
        if (freeLiquidity() + quote(zoneId) < payoutAmount) return SalesStatus.PoolLiquidityLow;
        return SalesStatus.Open;
    }

    /// @notice Compra la cobertura del día para una zona. Requiere `approve` previo de la prima
    ///         y enviar exactamente `policyFee` en MON.
    function buyPolicy(uint256 zoneId) external payable nonReentrant returns (uint256 policyId) {
        SalesStatus status = salesStatus(zoneId, msg.sender);
        if (status != SalesStatus.Open) revert SalesClosed(status);
        if (msg.value != policyFee) revert WrongFee(policyFee);

        uint256 day = currentDay();
        uint256 premium = quote(zoneId);
        uint256 payout = payoutAmount;
        uint256 activeFrom = block.timestamp + cooldown;

        usdc.safeTransferFrom(msg.sender, address(this), premium);

        policyId = _policies.length;
        _policies.push(
            Policy({
                holder: msg.sender,
                zoneId: uint32(zoneId),
                day: uint32(day),
                purchasedAt: uint64(block.timestamp),
                activeFrom: uint64(activeFrom),
                premium: uint128(premium),
                payout: uint128(payout),
                paid: false
            })
        );
        _zoneDayPolicies[zoneId][day].push(policyId);
        _userPolicies[msg.sender].push(policyId);
        hasPolicy[msg.sender][zoneId][day] = true;

        zoneDays[zoneId][day].exposure += payout;
        lockedLiability += payout;
        totalPremiums += premium;

        emit PolicyPurchased(policyId, msg.sender, zoneId, day, premium, activeFrom);
    }

    /// @notice Reclamo manual de respaldo, por si el pago automático no alcanzó a una póliza.
    function claim(uint256 policyId) external nonReentrant {
        Policy storage p = _policies[policyId];
        if (p.paid) revert AlreadyPaid();
        ZoneDay storage zd = zoneDays[p.zoneId][p.day];
        if (zd.finalized) revert AlreadyFinalized();
        if (zd.lastTriggerAt < p.activeFrom) revert NotEligible();
        _pay(policyId, p, zd);
    }

    /// @notice Paga en lote las pólizas elegibles de una zona y día. Cualquiera puede llamarla (keeper).
    function settle(uint256 zoneId, uint256 day, uint256 maxCount) external nonReentrant returns (uint256) {
        return _settle(zoneId, day, maxCount);
    }

    /// @notice Libera la liquidez comprometida de un día terminado. Cualquiera puede llamarla.
    function finalize(uint256 zoneId, uint256 day) external {
        ZoneDay storage zd = zoneDays[zoneId][day];
        if (zd.finalized) revert AlreadyFinalized();
        if (block.timestamp < dayStart(day) + 1 days + claimGrace) revert TooEarly();
        zd.finalized = true;
        uint256 released = zd.exposure - zd.paidOut;
        lockedLiability -= released;
        emit ZoneDayFinalized(zoneId, day, released);
    }

    // ───────────────────────────── Oráculo ─────────────────────────────

    /// @notice Reporta la lluvia actual (décimas de mm/h) de una zona. Si supera el umbral, paga.
    function reportRain(uint256 zoneId, uint256 rainX10) external onlyRole(ORACLE_ROLE) nonReentrant {
        _reportRain(zoneId, rainX10);
    }

    function reportRainBatch(uint256[] calldata zoneIds, uint256[] calldata rainX10s)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
    {
        if (zoneIds.length != rainX10s.length) revert LengthMismatch();
        for (uint256 i; i < zoneIds.length; ++i) {
            _reportRain(zoneIds[i], rainX10s[i]);
        }
    }

    /// @notice Publica la probabilidad de lluvia pronosticada para hoy (tarificación dinámica).
    function setForecastBatch(uint256[] calldata zoneIds, uint256[] calldata probs) external onlyRole(ORACLE_ROLE) {
        if (zoneIds.length != probs.length) revert LengthMismatch();
        uint256 day = currentDay();
        for (uint256 i; i < zoneIds.length; ++i) {
            if (zoneIds[i] >= _zones.length) revert InvalidZone();
            uint256 prob = probs[i] > 100 ? 100 : probs[i];
            zoneDays[zoneIds[i]][day].forecastProb = uint8(prob);
            emit ForecastSet(zoneIds[i], day, prob);
        }
    }

    // ───────────────────────────── Pool de liquidez ─────────────────────────────

    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Liquidez no comprometida con pólizas activas.
    function freeLiquidity() public view returns (uint256) {
        uint256 assets = totalAssets();
        return assets > lockedLiability ? assets - lockedLiability : 0;
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        return (assets * (totalShares + VIRTUAL_SHARES)) / (totalAssets() + 1);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return (shares * (totalAssets() + 1)) / (totalShares + VIRTUAL_SHARES);
    }

    /// @notice Deposita USDC al fondo y recibe participaciones. Gana las primas, asume los pagos.
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        shares = previewDeposit(assets);
        if (shares == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), assets);
        totalShares += shares;
        sharesOf[msg.sender] += shares;
        emit Deposited(msg.sender, assets, shares);
    }

    /// @notice Retira participaciones. Solo se puede retirar liquidez no comprometida.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        assets = previewRedeem(shares);
        if (assets > freeLiquidity()) revert InsufficientFreeLiquidity();
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        usdc.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }

    // ───────────────────────────── Administración ─────────────────────────────

    function addZone(string calldata name, uint256 maxExposurePerDay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _zones.push(Zone({name: name, active: true, maxExposurePerDay: maxExposurePerDay}));
        emit ZoneAdded(_zones.length - 1, name, maxExposurePerDay);
    }

    function updateZone(uint256 zoneId, bool active, uint256 maxExposurePerDay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (zoneId >= _zones.length) revert InvalidZone();
        _zones[zoneId].active = active;
        _zones[zoneId].maxExposurePerDay = maxExposurePerDay;
        emit ZoneUpdated(zoneId, active, maxExposurePerDay);
    }

    function setProduct(uint256 basePremium_, uint256 payoutAmount_, uint16 rainThresholdX10_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        basePremium = basePremium_;
        payoutAmount = payoutAmount_;
        rainThresholdX10 = rainThresholdX10_;
        emit ParamsUpdated();
    }

    function setPolicyFee(uint256 policyFee_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        policyFee = policyFee_;
        emit ParamsUpdated();
    }

    /// @notice Retira las tarifas en MON acumuladas por la venta de pólizas.
    function withdrawFees(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = address(this).balance;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "fee transfer failed");
        emit FeesWithdrawn(to, amount);
    }

    function setSchedule(
        bool enforceWindow_,
        uint32 cooldown_,
        uint32 windowStart_,
        uint32 windowEnd_,
        uint32 coverageEnd_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(windowStart_ < windowEnd_ && coverageEnd_ <= 1 days, "bad schedule");
        enforceWindow = enforceWindow_;
        cooldown = cooldown_;
        windowStart = windowStart_;
        windowEnd = windowEnd_;
        coverageEnd = coverageEnd_;
        emit ParamsUpdated();
    }

    function setRiskParams(uint8 surgeProb, uint8 closeProb, uint32 autoSettleMax_, uint32 claimGrace_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        forecastSurgeProb = surgeProb;
        forecastCloseProb = closeProb;
        autoSettleMax = autoSettleMax_;
        claimGrace = claimGrace_;
        emit ParamsUpdated();
    }

    // ───────────────────────────── Lecturas ─────────────────────────────

    function zoneCount() external view returns (uint256) {
        return _zones.length;
    }

    function getZone(uint256 zoneId) external view returns (Zone memory) {
        return _zones[zoneId];
    }

    function getZones() external view returns (Zone[] memory) {
        return _zones;
    }

    function policyCount() external view returns (uint256) {
        return _policies.length;
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    function policiesOf(address holder) external view returns (uint256[] memory) {
        return _userPolicies[holder];
    }

    function zoneDayPolicies(uint256 zoneId, uint256 day) external view returns (uint256[] memory) {
        return _zoneDayPolicies[zoneId][day];
    }

    /// @notice Pólizas de un usuario con todo su detalle.
    function policiesDetailOf(address holder) external view returns (uint256[] memory ids, Policy[] memory list) {
        ids = _userPolicies[holder];
        list = new Policy[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            list[i] = _policies[ids[i]];
        }
    }

    struct Config {
        uint256 basePremium;
        uint256 payoutAmount;
        uint16 rainThresholdX10;
        uint32 cooldown;
        uint32 windowStart;
        uint32 windowEnd;
        uint32 coverageEnd;
        bool enforceWindow;
        uint8 forecastSurgeProb;
        uint8 forecastCloseProb;
        uint256 currentDay;
        uint256 localTimeOfDay;
    }

    function config() external view returns (Config memory) {
        return Config({
            basePremium: basePremium,
            payoutAmount: payoutAmount,
            rainThresholdX10: rainThresholdX10,
            cooldown: cooldown,
            windowStart: windowStart,
            windowEnd: windowEnd,
            coverageEnd: coverageEnd,
            enforceWindow: enforceWindow,
            forecastSurgeProb: forecastSurgeProb,
            forecastCloseProb: forecastCloseProb,
            currentDay: currentDay(),
            localTimeOfDay: localTimeOfDay()
        });
    }

    struct PoolStats {
        uint256 totalAssets;
        uint256 freeLiquidity;
        uint256 lockedLiability;
        uint256 totalShares;
        uint256 totalPremiums;
        uint256 totalPayouts;
        uint256 policyCount;
    }

    function poolStats() external view returns (PoolStats memory) {
        return PoolStats({
            totalAssets: totalAssets(),
            freeLiquidity: freeLiquidity(),
            lockedLiability: lockedLiability,
            totalShares: totalShares,
            totalPremiums: totalPremiums,
            totalPayouts: totalPayouts,
            policyCount: _policies.length
        });
    }

    /// @notice Estado de hoy de todas las zonas, para pintar el tablero en una sola llamada.
    function dashboard(address holder)
        external
        view
        returns (
            ZoneDay[] memory today,
            Reading[] memory readings,
            uint256[] memory quotes,
            SalesStatus[] memory statuses
        )
    {
        uint256 n = _zones.length;
        uint256 day = currentDay();
        today = new ZoneDay[](n);
        readings = new Reading[](n);
        quotes = new uint256[](n);
        statuses = new SalesStatus[](n);
        for (uint256 i; i < n; ++i) {
            today[i] = zoneDays[i][day];
            readings[i] = latestReading[i];
            quotes[i] = quote(i);
            statuses[i] = salesStatus(i, holder);
        }
    }

    // ───────────────────────────── Internos ─────────────────────────────

    function _isRainingNow(uint256 zoneId) internal view returns (bool) {
        Reading memory r = latestReading[zoneId];
        return r.rainX10 >= rainThresholdX10 && block.timestamp < r.timestamp + 1 hours;
    }

    function _reportRain(uint256 zoneId, uint256 rainX10) internal {
        if (zoneId >= _zones.length) revert InvalidZone();
        uint16 value = rainX10 > type(uint16).max ? type(uint16).max : uint16(rainX10);
        uint256 day = currentDay();
        ZoneDay storage zd = zoneDays[zoneId][day];

        latestReading[zoneId] = Reading({rainX10: value, timestamp: uint64(block.timestamp)});
        if (value > zd.maxRainX10) zd.maxRainX10 = value;

        bool triggered = value >= rainThresholdX10 && localTimeOfDay() <= coverageEnd;
        emit RainReported(zoneId, day, value, triggered);
        if (triggered) {
            zd.lastTriggerAt = uint64(block.timestamp);
            _settle(zoneId, day, autoSettleMax);
        }
    }

    function _settle(uint256 zoneId, uint256 day, uint256 maxCount) internal returns (uint256 processed) {
        ZoneDay storage zd = zoneDays[zoneId][day];
        if (zd.finalized) return 0;
        uint256[] storage list = _zoneDayPolicies[zoneId][day];
        uint256 i = zd.cursor;
        // Las pólizas están ordenadas por hora de compra, así que la primera que aún no estaba
        // activa cuando llovió marca el final del lote. `claim` cubre cualquier caso fuera de orden.
        while (i < list.length && processed < maxCount) {
            uint256 policyId = list[i];
            Policy storage p = _policies[policyId];
            if (p.activeFrom > zd.lastTriggerAt) break;
            if (!p.paid) _pay(policyId, p, zd);
            ++i;
            ++processed;
        }
        zd.cursor = uint32(i);
    }

    function _pay(uint256 policyId, Policy storage p, ZoneDay storage zd) internal {
        p.paid = true;
        uint256 amount = p.payout;
        zd.paidOut += amount;
        lockedLiability -= amount;
        totalPayouts += amount;
        usdc.safeTransfer(p.holder, amount);
        emit PolicyPaid(policyId, p.holder, p.zoneId, amount);
    }
}
