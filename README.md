# Lloverá ⛈

**Micro-seguro paramétrico para repartidores del Valle de Aburrá, sobre Monad.**
Pagas 0,25 tUSDC al día por tu zona; si el oráculo mide ≥ 15 mm/h de lluvia allí con tu cobertura activa, el contrato te paga 3,50 tUSDC automáticamente. Sin reclamos, sin papeleo.

## Estructura

```
contracts/   Foundry: Llovera.sol (pólizas, oráculo, pool), MockUSDC.sol (tUSDC con faucet), tests y script de despliegue
web/         Next.js + wagmi/viem: inicio, Mi turno (mapa + GPS), Fondo, Oráculo y la ruta /api/oracle
```

## Cómo funciona el contrato

- **Zonas**: 25 zonas que cubren todo el Valle de Aburrá urbano: las 16 comunas de Medellín y 9 municipios (Bello, Copacabana, Girardota, Barbosa, Envigado, Itagüí, Sabaneta, La Estrella y Caldas). Límites oficiales del DANE (CC BY 4.0) y de la Alcaldía de Medellín; `web/scripts/build-geo.mjs` genera `web/src/lib/geo.ts`.
- **GPS**: la web pide permiso de ubicación y detecta la zona del repartidor para ofrecerle la cobertura de esa zona. El pago depende de la lluvia en la zona asegurada, no de la ubicación posterior, así que el GPS no se envía a la cadena. Para la demo hay simulación (tocar el mapa o reproducir recorridos).
- **Póliza diaria**: `buyPolicy(zoneId)` cobra la prima y compromete el pago en el pool. Una póliza por wallet, zona y día.
- **Anti-fraude**: carencia (60 min; 60 s en modo demo), ventana de compra de 6 a 9 a. m. (desactivada en modo demo), venta cerrada si está lloviendo o si el riesgo de tormenta es ≥ 80 %, y prima +50 % si el riesgo es ≥ 50 %.
- **Oráculo**: `reportRain(zoneId, décimas de mm/h)`. Si el reporte supera el umbral, **paga en la misma transacción** hasta 40 pólizas activas. El resto se paga con `settle()` (cualquiera puede llamarlo) o con `claim()`.
- **Pool**: los inversionistas depositan tUSDC (`deposit`), ganan las primas y asumen los pagos. Solo se puede retirar la liquidez libre. Cada zona tiene un cupo diario máximo (350 tUSDC) para que una tormenta en todo el valle no quiebre el fondo.

## Experiencia de usuario

- **Moneda local**: el usuario elige COP, USD, EUR, MXN, PEN, CLP, ARS o BRL. Los montos se convierten con la tasa del día (`/api/rates`, vía ExchangeRate-API, caché de 6 h). En la cadena todo sigue en tUSDC (1 tUSDC = 1 USD).
- **Móvil primero**: barra de navegación inferior, botones de 50–58 px, botón fijo de "Asegurar" al alcance del pulgar, e instalable en el celular (manifest + íconos). Sin MetaMask en el navegador del teléfono, el botón abre la página dentro de la app de MetaMask.
- **Feedback visual**: cada transacción abre una hoja paso a paso ("Confirma en MetaMask" → "Enviando a Monad…" con cronómetro → éxito con confeti y el tiempo de confirmación). Los errores se traducen a lenguaje humano (`humanError` en `web/src/lib/format.ts`). Cuando llega un pago por lluvia, aparece una celebración con el monto en tu moneda.

> Para probar en un celular de verdad hace falta desplegar (Monad Testnet + Vercel): el GPS del navegador solo funciona con HTTPS y el teléfono no ve la cadena local del computador.

## Correr en local

```bash
# 1. Cadena local y contratos
cd contracts
anvil                                   # en otra terminal
forge test
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 2. Web
cd ../web
cp .env.example .env.local              # NEXT_PUBLIC_CHAIN_ID=31337 y las direcciones impresas por el script
npm install && npm run dev
```

Si cambias el contrato: `forge build && node export-abi.js` para actualizar `web/src/lib/abi.ts`.

## Desplegar en Monad Testnet

1. Ten MON de prueba en tu wallet ([faucet](https://faucet.monad.xyz)).
2. Despliega los contratos (la wallet que despliega queda como **admin y oráculo**):

   ```bash
   cd contracts
   # contracts/.env: PRIVATE_KEY (wallet de despliegue) y OWNER_ADDRESS (tu MetaMask: queda admin y oráculo)
   source .env && forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --slow \
     --gas-estimate-multiplier 115 --private-key $PRIVATE_KEY
   ```

3. Publica la web en Vercel con **Root Directory = `web`** y estas variables:
   `NEXT_PUBLIC_CHAIN_ID=10143`, `NEXT_PUBLIC_LLOVERA_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`.
   Opcional, para el oráculo automático: `CRON_SECRET` y `ORACLE_PRIVATE_KEY`.

### Oráculo automático

`GET /api/oracle` consulta Open-Meteo para las 25 zonas y devuelve lluvia y riesgo de tormenta. Con `Authorization: Bearer $CRON_SECRET` además publica los datos en el contrato. El cron de Vercel (`vercel.json`) lo llama a las 6 a. m. hora de Colombia. Solo publica las zonas cuyo valor cambió y no envía nada si no hay cambios. Aun así, cada publicación de las 25 zonas cuesta ~0,06 MON: un cron cada 15 min podría gastar hasta ~6 MON al día. Para la hackathon basta el cron diario o el botón del Oráculo.

### Costos medidos (Monad cobra por límite de gas, ~102 gwei)

| Operación | Gas | MON aprox. |
|---|---|---|
| Despliegue completo | ~5,5 M | 0,6–0,75 |
| Autorizar saldo (1.ª vez) + comprar cobertura | 46 k + 250–295 k | 0,035 + 0,01 de tarifa (`policyFee`) |
| Saldo de prueba (faucet) | 73 k | 0,008 |
| Tormenta en 1 zona pagando a 3 repartidores | 173 k | 0,02 |
| Publicar clima real de 25 zonas | 514 k | 0,06 |

## Guion de la demo (3 min)

1. **Inicio**: problema y guía. La tabla de costos se lee en vivo del contrato.
2. **Mi turno** (wallet del repartidor): reclamar 100 tUSDC, "Simular ubicación" → recorrido "Laureles → Itagüí" (el mapa sigue al repartidor) y asegurar Itagüí por 0,25. Se ve la carencia corriendo.
3. **Oráculo** (wallet admin, en otra ventana): "Consultar clima real" para mostrar los datos de Open-Meteo. Luego, pasada la carencia, **"⛈ Lanzar tormenta en Itagüí"**.
4. En la ventana del repartidor aparece "¡Cayó el aguacero en Itagüí!" con los 3,50 tUSDC. El saldo sube en menos de un segundo.
5. **Fondo**: primas cobradas, pagos y siniestralidad. Cierre: por qué solo es viable en Monad.

> Prototipo de hackathon: fondo mutual de protección de ingresos, no es un seguro regulado.
