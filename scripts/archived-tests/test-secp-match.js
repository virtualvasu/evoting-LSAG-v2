const { ethers } = require("hardhat");
const fs = require('fs');
const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');

async function main() {
    console.log("Testing Secp256k1 contract vs JavaScript...\n");
    
    const config = JSON.parse(fs.readFileSync('./scripts/config/deployment.json', 'utf8'));
    const secp = await ethers.getContractAt("Secp256k1", config.secp256k1Address);
    
    // Test 1: ScalarBaseMult(1) should give generator
    console.log("Test 1: ScalarBaseMult(1)");
    const [gx, gy] = await secp.ScalarBaseMult(1);
    console.log("  Solidity GX:", "0x" + gx.toString(16));
    console.log("  Solidity GY:", "0x" + gy.toString(16));
    
    const G = secp256k1.ProjectivePoint.BASE;
    const g_affine = G.toAffine();
    console.log("  JS GX:      ", "0x" + g_affine.x.toString(16));
    console.log("  JS GY:      ", "0x" + g_affine.y.toString(16));
    console.log("  Match:", gx === g_affine.x && gy === g_affine.y ? "✅" : "❌");
    console.log();
    
    // Test 2: HashToPoint - compare implementations
    console.log("Test 2: HashToPoint(Gx, Gy)");
    const testX = BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798");
    const testY = BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8");
    
    const [solHx, solHy] = await secp.HashToPoint(testX, testY);
    console.log("  Solidity Hx:", "0x" + solHx.toString(16));
    console.log("  Solidity Hy:", "0x" + solHy.toString(16));
    
    // JavaScript version
    function bigIntToBuffer(value) {
        const hex = value.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
    }
    
    const pxBuffer = bigIntToBuffer(testX);
    const pyBuffer = bigIntToBuffer(testY);
    const concatenated = new Uint8Array([...pxBuffer, ...pyBuffer]);
    const hash = keccak_256(concatenated);
    const hashScalar = BigInt('0x' + Buffer.from(hash).toString('hex')) % secp256k1.CURVE.n;
    const H_point = secp256k1.ProjectivePoint.BASE.multiply(hashScalar).toAffine();
    
    console.log("  JS Hx:      ", "0x" + H_point.x.toString(16));
    console.log("  JS Hy:      ", "0x" + H_point.y.toString(16));
    console.log("  Match:", solHx === H_point.x && solHy === H_point.y ? "✅" : "❌");
    console.log();
    
    // Test 3: ScalarMult
    console.log("Test 3: ScalarMult(G, 5)");
    const scalar = 5n;
    const [smx, smy] = await secp.ScalarMult(testX, testY, scalar);
    console.log("  Solidity:", "0x" + smx.toString(16).substring(0, 16) + "...");
    
    const js_sm = secp256k1.ProjectivePoint.fromAffine({x: testX, y: testY}).multiply(scalar).toAffine();
    console.log("  JS:      ", "0x" + js_sm.x.toString(16).substring(0, 16) + "...");
    console.log("  Match:", smx === js_sm.x && smy === js_sm.y ? "✅" : "❌");
    console.log();
    
    // Test 4: Add
    console.log("Test 4: Add(G, G)");
    const [addx, addy] = await secp.Add(testX, testY, testX, testY);
    console.log("  Solidity:", "0x" + addx.toString(16).substring(0, 16) + "...");
    
    const js_add = secp256k1.ProjectivePoint.BASE.add(secp256k1.ProjectivePoint.BASE).toAffine();
    console.log("  JS:      ", "0x" + js_add.x.toString(16).substring(0, 16) + "...");
    console.log("  Match:", addx === js_add.x && addy === js_add.y ? "✅" : "❌");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
