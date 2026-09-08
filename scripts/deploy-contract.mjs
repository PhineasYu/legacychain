/**
 * Deploys HeritageRegistry to the configured network.
 *
 *   ETH_RPC_URL=... ETH_PRIVATE_KEY=... npm run contract:deploy
 *
 * Prints the address to put in HERITAGE_REGISTRY_ADDRESS.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from 'ethers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = path.join(root, 'contracts', 'artifacts', 'HeritageRegistry.json');

const { ETH_RPC_URL, ETH_PRIVATE_KEY, ETH_CHAIN_ID, ETH_EXPLORER_BASE } = process.env;

if (!ETH_RPC_URL || !ETH_PRIVATE_KEY) {
  console.error('ETH_RPC_URL and ETH_PRIVATE_KEY must be set (see .env.example).');
  process.exit(1);
}

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
} catch {
  console.error('No artifact found. Run `npm run contract:compile` first.');
  process.exit(1);
}

const provider = new JsonRpcProvider(ETH_RPC_URL, Number(ETH_CHAIN_ID ?? 11155111));
const wallet = new Wallet(ETH_PRIVATE_KEY, provider);

const balance = await provider.getBalance(wallet.address);
console.log(`Deployer: ${wallet.address}`);
console.log(`Balance:  ${formatEther(balance)} ETH`);
if (balance === 0n) {
  console.error('Deployer has no funds. Fund it from a faucet before deploying.');
  process.exit(1);
}

const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
console.log('Deploying HeritageRegistry…');
const contract = await factory.deploy();
console.log(`Tx sent: ${contract.deploymentTransaction()?.hash}`);

await contract.waitForDeployment();
const address = await contract.getAddress();

console.log('\nDeployed.');
console.log(`  HERITAGE_REGISTRY_ADDRESS=${address}`);
if (ETH_EXPLORER_BASE) {
  console.log(`  ${ETH_EXPLORER_BASE}/address/${address}`);
}
