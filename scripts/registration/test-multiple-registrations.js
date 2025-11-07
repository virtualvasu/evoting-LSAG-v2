const { testCompleteRegistration } = require('./test-complete-registration');

/**
 * Test multiple voter registrations to build a larger ring
 */

async function testMultipleVoterRegistrations() {
    console.log('🔄 Testing Multiple Voter Registrations\n');
    console.log('=' .repeat(50));

    const results = [];

    for (let i = 0; i < 3; i++) {
        console.log(`\n👤 Registering Voter ${i + 1}/3`);
        console.log('-'.repeat(30));
        
        try {
            const result = await testCompleteRegistration();
            
            if (result.status === 'SUCCESS') {
                results.push({
                    voterNumber: i + 1,
                    voterId: result.voterInfo?.voterId || `VOTER_${i + 1}`,
                    certificateTx: result.transactions.certificate,
                    lsagTx: result.transactions.lsagRegistration,
                    ringPosition: result.voterInfo.ringPosition,
                    status: 'SUCCESS'
                });
                console.log(`✅ Voter ${i + 1} registered successfully!`);
            } else {
                results.push({
                    voterNumber: i + 1,
                    status: 'FAILED',
                    error: result.error
                });
                console.log(`❌ Voter ${i + 1} registration failed:`, result.error);
            }
        } catch (error) {
            results.push({
                voterNumber: i + 1,
                status: 'ERROR',
                error: error.message
            });
            console.log(`💥 Voter ${i + 1} registration error:`, error.message);
        }

        // Small delay between registrations
        if (i < 2) {
            console.log('⏳ Waiting 2 seconds before next registration...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 MULTI-VOTER REGISTRATION SUMMARY');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.status === 'SUCCESS');
    const failed = results.filter(r => r.status !== 'SUCCESS');

    console.log(`✅ Successful registrations: ${successful.length}/3`);
    console.log(`❌ Failed registrations: ${failed.length}/3`);

    if (successful.length > 0) {
        console.log('\n🎉 Successful Voters:');
        successful.forEach(voter => {
            console.log(`- Voter ${voter.voterNumber}: Ring position ${voter.ringPosition}`);
            console.log(`  Certificate: ${voter.certificateTx}`);
            console.log(`  LSAG: ${voter.lsagTx}`);
        });
    }

    if (failed.length > 0) {
        console.log('\n❌ Failed Registrations:');
        failed.forEach(voter => {
            console.log(`- Voter ${voter.voterNumber}: ${voter.error}`);
        });
    }

    console.log('\n🚀 NEXT PHASE: VOTING SYSTEM');
    console.log('With', successful.length, 'registered voters, we can now:');
    console.log('1. Implement vote casting');
    console.log('2. Test anonymous voting');
    console.log('3. Implement vote tallying');
    console.log('4. Complete the full e-voting workflow');

    return {
        totalVoters: 3,
        successful: successful.length,
        failed: failed.length,
        results: results,
        readyForVoting: successful.length > 0
    };
}

// Run test if called directly
if (require.main === module) {
    testMultipleVoterRegistrations()
        .then((summary) => {
            console.log('\n🎊 Multi-voter registration test completed!');
            console.log('Ready for voting phase:', summary.readyForVoting ? 'YES' : 'NO');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Multi-voter test failed:', error);
            process.exit(1);
        });
}

module.exports = { testMultipleVoterRegistrations };