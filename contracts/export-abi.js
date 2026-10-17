// Copia los ABIs compilados a la web. Uso: forge build && node export-abi.js
const fs = require("fs");
const path = require("path");

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "out", `${name}.sol`, `${name}.json`))).abi;

const out = `// Generado con \`node export-abi.js\` en contracts/. No editar a mano.
export const lloveraAbi = ${JSON.stringify(read("Llovera"), null, 2)} as const;

export const usdcAbi = ${JSON.stringify(read("MockUSDC"), null, 2)} as const;
`;

fs.writeFileSync(path.join(__dirname, "..", "web", "src", "lib", "abi.ts"), out);
console.log("ABIs exportados a web/src/lib/abi.ts");
