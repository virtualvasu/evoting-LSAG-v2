const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ethers } = require('ethers');

/**
 * Pre-Registration Script for LSAG E-Voting System
 * Collects voter details and generates a government-signed certificate
 */

class PreRegistrationService {
    constructor() {
        // Load government configuration
        const govConfigPath = path.join(__dirname, '../config/government-config.json');
        this.governmentConfig = JSON.parse(fs.readFileSync(govConfigPath, 'utf8'));
        
        // Setup readline interface for user input
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('🏛️  Pre-Registration Service initialized');
        console.log('Government Address:', this.governmentConfig.address);
    }

    /**
     * Prompt user for input
     */
    prompt(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * Collect voter details from user input
     */
    async collectVoterDetails() {
        console.log('\n📋 Voter Pre-Registration');
        console.log('='.repeat(50));
        
        const name = await this.prompt('Enter voter name: ');
        const publicKey = await this.prompt('Enter voter public key (64 bytes hex, with or without 0x): ');
        const studentId = await this.prompt('Enter student ID: ');

        // Validate public key format
        let cleanedPubKey = publicKey.toLowerCase().replace(/^0x/, '');
        
        // Remove 04 prefix if present (uncompressed point indicator)
        if (cleanedPubKey.startsWith('04')) {
            cleanedPubKey = cleanedPubKey.slice(2);
        }
        
        if (cleanedPubKey.length !== 128) {
            throw new Error(`Invalid public key length. Expected 64 bytes (128 hex chars), got ${cleanedPubKey.length / 2} bytes`);
        }

        // Add 0x prefix
        cleanedPubKey = '0x' + cleanedPubKey;

        //
        //
        //struct to be signed by gov private key to create signature
        return {
            name,
            publicKey: cleanedPubKey,
            studentId
        };
    }

    /**
     * Sign voter's public key using government's private key
     * This generates a PKS signature (σ̃_v = PKS.sign(P_uv, P_rgov))
     */
    signVoterPublicKey(voterPublicKey) {
        // Create wallet from government private key
        const wallet = new ethers.Wallet(this.governmentConfig.privateKey);

        // Hash the voter's public key
        const messageHash = ethers.keccak256(voterPublicKey);

        // Sign the hash using Ethereum's personal_sign method
        // This automatically adds the Ethereum message prefix
        const messageBytes = ethers.getBytes(messageHash);
        const ethSignedHash = ethers.hashMessage(messageBytes);
        const signature = wallet.signingKey.sign(ethSignedHash);

        // Return the serialized signature (65 bytes: r + s + v)
        return signature.serialized;
    }

    /**
     * Verify the signature
     */
    verifySignature(voterPublicKey, signature) {
        try {
            // Hash the voter's public key
            const messageHash = ethers.keccak256(voterPublicKey);
            const messageBytes = ethers.getBytes(messageHash);
            const ethSignedHash = ethers.hashMessage(messageBytes);

            // Recover the address from the signature
            const recoveredAddress = ethers.recoverAddress(ethSignedHash, signature);

            // Compare with government address
            return recoveredAddress.toLowerCase() === this.governmentConfig.address.toLowerCase();
        } catch (error) {
            console.error('Verification failed:', error);
            return false;
        }
    }

    /**
     * Save pre-registration data to JSON file
     */
    savePreRegistration(voterDetails, signature) {
        const output = {
            voter: voterDetails,
            signature: signature,
            signatureLength: ethers.getBytes(signature).length,
            government: {
                address: this.governmentConfig.address,
                publicKey: this.governmentConfig.publicKey
            },
            timestamp: new Date().toISOString()
        };

        // Create output filename based on student ID
        const outputFilename = `pre-registration-${voterDetails.studentId}.json`;
        const outputPath = path.join(__dirname, outputFilename);

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`\n✅ Pre-registration data saved to: ${outputFilename}`);
    }

    /**
     * Run the pre-registration process
     */
    async run() {
        try {
            // Collect voter details
            const voterDetails = await this.collectVoterDetails();

            console.log('\n🔐 Generating signature...');
            
            // Sign the voter's public key with government's private key
            const signature = this.signVoterPublicKey(voterDetails.publicKey);
            const signatureBytes = ethers.getBytes(signature);

            console.log('\n✅ Signature Generated!');
            console.log('Signature:', signature);
            console.log('Signature Length:', signatureBytes.length, 'bytes');

            // Verify the signature
            console.log('\n🔍 Verifying signature...');
            const isValid = this.verifySignature(voterDetails.publicKey, signature);
            
            if (isValid) {
                console.log('✅ Signature verification PASSED');
            } else {
                console.log('❌ Signature verification FAILED');
                throw new Error('Signature verification failed');
            }

            // Save to file
            this.savePreRegistration(voterDetails, signature);

            // Display summary
            console.log('\n📊 Pre-Registration Summary');
            console.log('='.repeat(50));
            console.log('Voter Name:', voterDetails.name);
            console.log('Student ID:', voterDetails.studentId);
            console.log('Public Key:', voterDetails.publicKey);
            console.log('Signature:', signature);
            console.log('Signature Length:', signatureBytes.length, 'bytes');
            console.log('Government Address:', this.governmentConfig.address);

        } catch (error) {
            console.error('\n❌ Pre-registration failed:', error);
            throw error;
        } finally {
            this.rl.close();
        }
    }
}

// Run the script
if (require.main === module) {
    const service = new PreRegistrationService();
    service.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = PreRegistrationService;
