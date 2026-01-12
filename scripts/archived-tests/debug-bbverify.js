const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function debugBBVerify() {
  // Load LSAG file
  const lsagPath = process.argv[2] || 'scripts/pre_registration/LSAG_12340450.json';
  const lsagData = JSON.parse(fs.readFileSync(lsagPath, 'utf8'));
  
  // Load deployment
  const deployment = JSON.parse(fs.readFileSync('scripts/config/deployment.json', 'utf8'));
  const contract = await ethers.getContractAt('EVoting', deployment.contractAddress);
  
  console.log('Testing LSAG verification...\n');
  
  // Prepare LSAG signature
  const lsagSignature = {
    keyImageX: lsagData.lsagSignature.keyImageX,
    keyImageY: lsagData.lsagSignature.keyImageY,
    c: lsagData.lsagSignature.c,
    s: lsagData.lsagSignature.s
  };
  
  const electionId = lsagData.electionIdHash;
  
  console.log('Election ID:', electionId);
  console.log('Key Image X:', lsagSignature.keyImageX);
  console.log('Key Image Y:', lsagSignature.keyImageY);
  console.log('Challenge c:', lsagSignature.c);
  console.log('Responses s:', lsagSignature.s.length);
  
  // Test LSAGver
  try {
    console.log('\n1. Testing LSAGver...');
    const isValid = await contract.LSAGver(electionId, lsagSignature);
    console.log('   LSAGver result:', isValid);
    
    if (!isValid) {
      console.log('   ❌ LSAG signature verification FAILED');
      return;
    }
  } catch (e) {
    console.log('   ❌ LSAGver threw error:', e.message);
    return;
  }
  
  // Test for duplicate by checking registration table
  try {
    console.log('\n2. Checking registration table for duplicates...');
    const tableSize = await contract.getRegistrationTableSize();
    console.log('   Registration table size:', tableSize.toString());
    
    if (tableSize > 0) {
      for (let i = 0; i < tableSize; i++) {
        const entry = await contract.registrationTable(i);
        if (entry.lsagSig.keyImageX === lsagSignature.keyImageX &&
            entry.lsagSig.keyImageY === lsagSignature.keyImageY) {
          console.log(`   ❌ Duplicate found at index ${i}`);
          console.log('   This voter already registered!');
          return;
        }
      }
      console.log('   No duplicate found');
    }
  } catch (e) {
    console.log('   ⚠️  Could not check registration table:', e.message);
  }
  
  console.log('\n✅ All checks passed!');
  
  // Try calling BBverify
  console.log('\n3. Attempting BBverify call...');
  try {
    const newPublicKey = lsagData.newPublicKey.startsWith('0x') 
      ? lsagData.newPublicKey 
      : '0x' + lsagData.newPublicKey;
    
    const [signer] = await ethers.getSigners();
    const tx = await contract.connect(signer).BBverify(
      electionId,
      lsagSignature,
      newPublicKey,
      { gasLimit: 10000000 }
    );
    
    console.log('   Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('   ✅ SUCCESS! kv:', receipt.logs.length);
  } catch (e) {
    console.log('   ❌ BBverify failed:', e.message);
    if (e.reason) console.log('   Reason:', e.reason);
    if (e.data) console.log('   Data:', e.data);
  }
}

debugBBVerify()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
