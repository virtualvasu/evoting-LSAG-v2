const { ethers } = require('hardhat');

async function testContract() {
    console.log('\n🧪 Testing Contract Deployment\n');
    console.log('='.repeat(50));
    
    const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const contract = await ethers.getContractAt('EVoting', contractAddress);
    
    console.log('✅ Contract connected:', contractAddress);
    
    const ringSize = await contract.getRingSize();
    console.log('Current ring size:', ringSize.toString());
    
    console.log('\n='.repeat(50));
    console.log('✅ Contract is working!\n');
}

testContract()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
