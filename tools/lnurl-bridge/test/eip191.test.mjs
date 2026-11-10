// EIP-191 recovery: the bridge's @noble implementation cross-checked
// against ethers (the app's own signer) — sign with ethers, recover
// with ours, and vice versa. Run: node test/eip191.test.mjs
import assert from "node:assert";
import { ethers } from "ethers";
import { eip191RecoverAddress, eip191Verify, eip191MessageHash } from "../src/eip191.mjs";
import { bytesToHex } from "../src/nip44.mjs";

const messages = [
  "Fluid LNURL bridge registration v1\nname: qaname\nevm: 0x0000000000000000000000000000000000000000",
  "hello world",
  "ünïcode message ✓ with\nnewlines",
  "",
  "x".repeat(5000),
];
for (const msg of messages) {
  const wallet = ethers.Wallet.createRandom();
  const sig = await wallet.signMessage(msg);
  assert.equal(eip191RecoverAddress(msg, sig), wallet.address.toLowerCase(), "recovered address must match ethers signer");
  assert.equal(ethers.verifyMessage(msg, sig).toLowerCase(), wallet.address.toLowerCase(), "sanity: ethers agrees with itself");
  assert.ok(eip191Verify(msg, sig, wallet.address));
  assert.ok(!eip191Verify(msg + " ", sig, wallet.address), "tampered message must not verify");
  assert.ok(!eip191Verify(msg, sig, ethers.Wallet.createRandom().address), "wrong expected address must not verify");
  assert.ok(!eip191Verify(msg, "0x1234", wallet.address), "malformed signature must not verify");
}
// Message hash shape: 32 bytes, deterministic
assert.equal(eip191MessageHash("abc").length, 32);
assert.equal(bytesToHex(eip191MessageHash("abc")), bytesToHex(eip191MessageHash("abc")));

console.log("eip191.test.mjs: all checks passed");
