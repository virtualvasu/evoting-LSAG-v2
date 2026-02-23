const { secp256k1 } = require('@noble/curves/secp256k1');

// Test if affine conversion works correctly
const scalar = 12345n;
const point = secp256k1.ProjectivePoint.BASE.multiply(scalar);
const affine = point.toAffine();

console.log('Point:', point);
console.log('Affine X:', '0x' + affine.x.toString(16).padStart(64, '0'));
console.log('Affine Y:', '0x' + affine.y.toString(16).padStart(64, '0'));

// Verify it's on curve: y^2 = x^3 + 7 (mod p)
const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
const left = (affine.y * affine.y) % p;
const right = (affine.x * affine.x * affine.x + 7n) % p;
console.log('On curve:', left === right);
