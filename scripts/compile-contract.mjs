/**
 * Compiles contracts/HeritageRegistry.sol with solc and writes the ABI
 * and bytecode to contracts/artifacts/HeritageRegistry.json.
 *
 *   npm run contract:compile
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'contracts', 'HeritageRegistry.sol');
const outDir = path.join(root, 'contracts', 'artifacts');
const NAME = 'HeritageRegistry';

const input = {
  language: 'Solidity',
  sources: { [`${NAME}.sol`]: { content: readFileSync(sourcePath, 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length > 0) {
  for (const error of errors) console.error(error.formattedMessage);
  process.exit(1);
}
for (const warning of output.errors ?? []) {
  console.warn(warning.formattedMessage);
}

const contract = output.contracts[`${NAME}.sol`][NAME];
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, `${NAME}.json`),
  JSON.stringify(
    {
      contractName: NAME,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
      compiledAt: new Date().toISOString(),
    },
    null,
    2
  )
);

console.log(`Compiled ${NAME} → contracts/artifacts/${NAME}.json`);
console.log(`Bytecode size: ${contract.evm.bytecode.object.length / 2} bytes`);
