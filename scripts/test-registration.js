const updateVoterRing = require('./registration_new/update_voter_ring');

async function main() {
    const certPath = 'scripts/pre_registration/CERT_12340450.json';
    await updateVoterRing(certPath);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('\nFatal error:', error);
        process.exit(1);
    });
