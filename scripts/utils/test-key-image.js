const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function testKeyImage() {
    const lsagPath = path.join(__dirname, '../pre_registration/LSAG_12342330.json');
    const lsagData = JSON.parse(fs.readFileSync(lsagPath, 'utf8'));
    
    const keyImageHex = lsagData.lsagSignature.keyImage;
    console.log('Key Image (compressed):', keyImageHex);
    console.log('Length:', keyImageHex.length, 'bytes');
    
    // Try decompressing with noble-secp256k1
    const secp256k1 = require('@noble/secp256k1');
    
    try {
        const keyImageBuffer = Buffer.from(keyImageHex.slice(2), 'hex');
        console.log('\nKey image buffer:', keyImageBuffer.toString('hex'));
        console.log('Prefix byte:', keyImageBuffer[0].toString(16));
        
        // Decompress
        const point = secp256k1.Point.fromHex(keyImageBuffer);
        const uncompressed = point.toRawBytes(false);
        
        const x = BigInt('0x' + Buffer.from(uncompressed.slice(1, 33)).toString('hex'));
        const y = BigInt('0x' + Buffer.from(uncompressed.slice(33, 65)).toString('hex'));
        
        console.log('\nDecompressed:');
        console.log('X:', '0x' + x.toString(16).padStart(64, '0'));
        console.log('Y:', '0x' + y.toString(16).padStart(64, '0'));
        
        // Test if on curve: y^2 = x^3 + 7 (mod p)
        const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
        const left = (y * y) % p;
        const right = (x * x * x + BigInt(7)) % p;
        
        console.log('\nCurve validation:');
        console.log('y^2 mod p:', left.toString(16));
        console.log('x^3+7 mod p:', right.toString(16));
        console.log('On curve:', left === right);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testKeyImage().catch(console.error);
