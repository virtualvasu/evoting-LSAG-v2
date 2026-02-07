import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

export interface LSAGSignatureResult {
  voterName: string;
  sid: string;
  electionId: string;
  electionIdHash: string;
  newPublicKey: string;
  newPrivateKey: string;
  lsagSignature: {
    keyImageX: string;
    keyImageY: string;
    c: string;
    s: string[];
  };
}

/**
 * Convert BigInt to 32-byte buffer (big-endian)
 */
function bigIntToBuffer(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

/**
 * Hash to point - matches Solidity Secp256k1.HashToPoint
 * H(P) = keccak256(Px || Py) * G
 */
function hashToPoint(Px: bigint, Py: bigint): { x: bigint; y: bigint } {
  const pxBuffer = bigIntToBuffer(Px);
  const pyBuffer = bigIntToBuffer(Py);
  
  const concatenated = new Uint8Array([...pxBuffer, ...pyBuffer]);
  const hash = keccak_256(concatenated);
  
  const scalar = BigInt('0x' + Buffer.from(hash).toString('hex')) % secp256k1.CURVE.n;
  const point = secp256k1.ProjectivePoint.BASE.multiply(scalar);
  
  return point.toAffine();
}

/**
 * Compute challenge: keccak256(electionId || Lx || Ly || Rx || Ry)
 */
function computeChallenge(electionId: bigint, Lx: bigint, Ly: bigint, Rx: bigint, Ry: bigint): bigint {
  const electionIdBuffer = bigIntToBuffer(electionId);
  const lxBuffer = bigIntToBuffer(Lx);
  const lyBuffer = bigIntToBuffer(Ly);
  const rxBuffer = bigIntToBuffer(Rx);
  const ryBuffer = bigIntToBuffer(Ry);
  
  const concatenated = new Uint8Array([
    ...electionIdBuffer,
    ...lxBuffer,
    ...lyBuffer,
    ...rxBuffer,
    ...ryBuffer
  ]);
  
  const hash = keccak_256(concatenated);
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
}

/**
 * Generate LSAG signature - SIMPLE VERSION
 */
function generateSimpleLSAG(
  electionId: bigint,
  privateKey: bigint,
  publicKey: { x: bigint; y: bigint },
  ring: Array<{ x: bigint; y: bigint }>,
  signerIndex: number
): { keyImageX: bigint; keyImageY: bigint; c0: bigint; s: bigint[] } {
  const n = secp256k1.CURVE.n;
  const G = secp256k1.ProjectivePoint.BASE;
  const ringSize = ring.length;
  
  // Step 1: Compute key image I = privateKey * H(publicKey)
  const H_Pk = hashToPoint(publicKey.x, publicKey.y);
  const keyImage = secp256k1.ProjectivePoint.fromAffine(H_Pk).multiply(privateKey).toAffine();
  
  // Step 2: Generate random alpha
  const alphaBytes = secp256k1.utils.randomPrivateKey();
  const alpha = BigInt('0x' + Buffer.from(alphaBytes).toString('hex'));
  
  // Step 3: Initialize response array
  const s = new Array(ringSize);
  
  // Step 4: Compute alpha-based L and R at signer position
  const L_alpha = G.multiply(alpha).toAffine();
  const H_Pk_signer = hashToPoint(ring[signerIndex].x, ring[signerIndex].y);
  const R_alpha = secp256k1.ProjectivePoint.fromAffine(H_Pk_signer).multiply(alpha).toAffine();
  
  // Step 5: Compute first challenge at position AFTER signer
  const startPos = (signerIndex + 1) % ringSize;
  let currentChallenge = computeChallenge(electionId, L_alpha.x, L_alpha.y, R_alpha.x, R_alpha.y);
  
  let c0: bigint;
  if (startPos === 0) {
    c0 = currentChallenge;
  }
  
  // Step 6: Loop through ring (except signer)
  for (let j = 0; j < ringSize - 1; j++) {
    const i = (startPos + j) % ringSize;
    
    // Generate random response for this position
    const sBytes = secp256k1.utils.randomPrivateKey();
    s[i] = BigInt('0x' + Buffer.from(sBytes).toString('hex')) % n;
    
    // Compute L = s[i]*G + c[i]*P[i]
    const sG = G.multiply(s[i]).toAffine();
    const cP = secp256k1.ProjectivePoint.fromAffine({x: ring[i].x, y: ring[i].y})
      .multiply(currentChallenge).toAffine();
    const L = secp256k1.ProjectivePoint.fromAffine(sG)
      .add(secp256k1.ProjectivePoint.fromAffine(cP)).toAffine();
    
    // Compute R = s[i]*H(P[i]) + c[i]*I
    const H_Pi = hashToPoint(ring[i].x, ring[i].y);
    const sH = secp256k1.ProjectivePoint.fromAffine(H_Pi).multiply(s[i]).toAffine();
    const cI = secp256k1.ProjectivePoint.fromAffine(keyImage)
      .multiply(currentChallenge).toAffine();
    const R = secp256k1.ProjectivePoint.fromAffine(sH)
      .add(secp256k1.ProjectivePoint.fromAffine(cI)).toAffine();
    
    // Compute next challenge
    currentChallenge = computeChallenge(electionId, L.x, L.y, R.x, R.y);
    
    // Store c[0] if next position is 0
    const nextPos = (i + 1) % ringSize;
    if (nextPos === 0) {
      c0 = currentChallenge;
    }
  }
  
  // Step 7: Close the ring at signer position
  s[signerIndex] = (alpha - (currentChallenge * privateKey % n) + n) % n;
  
  return {
    keyImageX: keyImage.x,
    keyImageY: keyImage.y,
    c0: c0!,
    s: s
  };
}

/**
 * Generate new key pair for voter
 */
function generateNewKeyPair(): { privateKey: string; publicKey: string } {
  const privateKeyBytes = secp256k1.utils.randomPrivateKey();
  const privateKey = BigInt('0x' + Buffer.from(privateKeyBytes).toString('hex'));
  
  const publicKeyPoint = secp256k1.ProjectivePoint.BASE.multiply(privateKey).toAffine();
  const publicKeyX = publicKeyPoint.x.toString(16).padStart(64, '0');
  const publicKeyY = publicKeyPoint.y.toString(16).padStart(64, '0');
  const publicKey = publicKeyX + publicKeyY;
  
  return {
    privateKey: '0x' + privateKey.toString(16),
    publicKey: '0x' + publicKey
  };
}

/**
 * Generate LSAG signature for voter registration
 */
export async function generateLSAGSignatureForVoter(
  originalPrivateKey: string,
  registeredPublicKey: string,
  voterName: string,
  sid: string,
  voterRing: string[],
  electionId: string = 'election_001'
): Promise<LSAGSignatureResult> {
  
  // Validate inputs
  if (!originalPrivateKey || !registeredPublicKey || !voterName || !sid) {
    throw new Error('Missing required parameters');
  }

  if (voterRing.length === 0) {
    throw new Error('Voter ring is empty');
  }

  // Find voter's position in the ring
  const voterPublicKey = registeredPublicKey.startsWith('0x') 
    ? registeredPublicKey.slice(2).toLowerCase()
    : registeredPublicKey.toLowerCase();
  
  let signerIndex = -1;
  for (let i = 0; i < voterRing.length; i++) {
    const ringPubKey = voterRing[i].startsWith('0x')
      ? voterRing[i].slice(2).toLowerCase()
      : voterRing[i].toLowerCase();
    if (ringPubKey === voterPublicKey) {
      signerIndex = i;
      break;
    }
  }

  if (signerIndex === -1) {
    throw new Error('Voter public key not found in ring. Please register voter first.');
  }

  // Generate new PKS key pair
  const newKeyPair = generateNewKeyPair();

  // Convert message (election_id) to hash
  const electionIdNum = ethers.keccak256(ethers.toUtf8Bytes(electionId));
  const electionIdBigInt = BigInt(electionIdNum);

  // Convert voter's original private key
  const privateKeyBigInt = BigInt(originalPrivateKey);
  
  // Get public key coordinates
  const pubKeyClean = registeredPublicKey.startsWith('0x') ? registeredPublicKey.slice(2) : registeredPublicKey;
  const pubKeyBuffer = Buffer.from(pubKeyClean, 'hex');
  const publicKey = {
    x: BigInt('0x' + pubKeyBuffer.slice(0, 32).toString('hex')),
    y: BigInt('0x' + pubKeyBuffer.slice(32, 64).toString('hex'))
  };

  // Convert ring to format needed for LSAG generator
  const ring = voterRing.map(pkHex => {
    const pkClean = pkHex.startsWith('0x') ? pkHex.slice(2) : pkHex;
    const pkBuffer = Buffer.from(pkClean, 'hex');
    const x = BigInt('0x' + pkBuffer.slice(0, 32).toString('hex'));
    const y = BigInt('0x' + pkBuffer.slice(32, 64).toString('hex'));
    return { x, y };
  });

  // Generate LSAG signature
  const lsagSignature = generateSimpleLSAG(
    electionIdBigInt,
    privateKeyBigInt,
    publicKey,
    ring,
    signerIndex
  );

  return {
    voterName,
    sid,
    electionId,
    electionIdHash: electionIdNum,
    newPublicKey: newKeyPair.publicKey,
    newPrivateKey: newKeyPair.privateKey,
    lsagSignature: {
      keyImageX: '0x' + lsagSignature.keyImageX.toString(16).padStart(64, '0'),
      keyImageY: '0x' + lsagSignature.keyImageY.toString(16).padStart(64, '0'),
      c: '0x' + lsagSignature.c0.toString(16).padStart(64, '0'),
      s: lsagSignature.s.map(val => '0x' + val.toString(16).padStart(64, '0'))
    }
  };
}
