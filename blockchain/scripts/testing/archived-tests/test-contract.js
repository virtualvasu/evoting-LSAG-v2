const { ethers } = require('hardhat');

async function testContract() {
    console.log('\n🧪 Testing Contract Deployment\n');
    console.log('='.repeat(50));
    
    const contractAddress = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
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
