const fs = require('fs');
const path = require('path');
const CryptoUtils = require('../utils/crypto-utils');
const BlockchainInterface = require('../utils/blockchain-interface');

/**
 * Voter Registration System for LSAG E-Voting
 * Handles complete voter registration process including certificate submission and LSAG registration
 */

class VoterRegistration {
    constructor(contractAddress, providerUrl = 'http://10.10.0.60:8550') {
        this.blockchain = new BlockchainInterface(contractAddress, providerUrl);
        this.voterKeyPair = null;
        this.certificate = null;
        this.registrationStatus = {
            keyGenerated: false,
            certificateReceived: false,
            publicKeyStored: false,
            lsagRegistered: false
        };

        console.log('🗳️  Voter Registration System initialized');
    }

    /**
     * Step 1: Generate voter key pair
     * @returns {Object} Generated key pair
     */
    generateVoterKeys() {
        try {
            this.voterKeyPair = CryptoUtils.generateKeyPair();
            this.registrationStatus.keyGenerated = true;
            
            console.log('🔑 Voter keys generated successfully!');
            console.log('Public Key:', CryptoUtils.bufferToHex(this.voterKeyPair.publicKey));
            
            return {
                privateKey: CryptoUtils.bufferToHex(this.voterKeyPair.privateKey),
                publicKey: CryptoUtils.bufferToHex(this.voterKeyPair.publicKey)
            };
        } catch (error) {
            console.error('Failed to generate voter keys:', error);
            throw error;
        }
    }

    /**
     * Load existing voter keys from file or hex string
     * @param {string} privateKeyHex - Private key in hex format
     */
    loadVoterKeys(privateKeyHex) {
        try {
            const privateKey = CryptoUtils.hexToBuffer(privateKeyHex);
            const publicKey = CryptoUtils.generateKeyPair().publicKey; // This should derive from private key
            
            // Properly derive public key from private key
            const secp256k1 = require('secp256k1');
            const actualPublicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
            
            this.voterKeyPair = {
                privateKey: privateKey,
                publicKey: actualPublicKey
            };
            
            this.registrationStatus.keyGenerated = true;
            console.log('🔑 Voter keys loaded successfully!');
            
        } catch (error) {
            console.error('Failed to load voter keys:', error);
            throw error;
        }
    }

    /**
     * Step 2: Receive certificate from government
     * @param {Object} certificate - Certificate object from government
     */
    receiveCertificate(certificate) {
        try {
            // Validate certificate structure
            if (!certificate.sigma_tilde_v || !certificate.P_ugov || !certificate.P_uv) {
                throw new Error('Invalid certificate structure');
            }

            // Verify certificate is for our public key
            const ourPublicKey = CryptoUtils.bufferToHex(this.voterKeyPair.publicKey);
            if (certificate.P_uv !== ourPublicKey) {
                throw new Error('Certificate public key does not match voter public key');
            }

            this.certificate = certificate;
            this.registrationStatus.certificateReceived = true;
            
            console.log('📜 Certificate received and validated!');
            console.log('Certificate Hash:', this.getCertificateHash());
            
        } catch (error) {
            console.error('Failed to receive certificate:', error);
            throw error;
        }
    }

    /**
     * Step 3: Submit certificate to store public key on blockchain
     * @param {string} privateKey - Private key for transaction signing
     * @returns {Object} Transaction receipt
     */
    async submitCertificate(privateKey) {
        try {
            if (!this.certificate) {
                throw new Error('No certificate available. Receive certificate first.');
            }

            // Connect to blockchain with wallet
            this.blockchain.connectWallet(privateKey);

            // Convert certificate to proper format for contract
            const certificateForContract = {
                sigma_tilde_v: this.certificate.sigma_tilde_v,
                P_ugov: this.certificate.P_ugov,
                P_uv: this.certificate.P_uv
            };

            console.log('📤 Submitting certificate to blockchain...');
            
            // Submit certificate via storePub function
            const receipt = await this.blockchain.storePub(certificateForContract);
            
            this.registrationStatus.publicKeyStored = true;
            console.log('✅ Public key stored on blockchain successfully!');
            
            return receipt;

        } catch (error) {
            console.error('Failed to submit certificate:', error);
            throw error;
        }
    }

    /**
     * Step 4: Generate LSAG signature for registration
     * @returns {Object} LSAG signature components
     */
    async generateLSAGSignature() {
        try {
            if (!this.registrationStatus.publicKeyStored) {
                throw new Error('Public key not stored. Submit certificate first.');
            }

            // Get current voter ring from blockchain
            const voterRing = await this.blockchain.getVoterRing();
            console.log(`📊 Current voter ring size: ${voterRing.length}`);

            // Create message for LSAG signature (registration message)
            const registrationMessage = Buffer.from('VOTER_REGISTRATION_' + Date.now().toString(), 'utf8');

            // Convert ring to public key format (this is simplified - real LSAG needs actual public keys)
            const ringPublicKeys = [this.voterKeyPair.publicKey]; // Simplified: just our key for now

            // Generate LSAG signature
            const lsagSignature = CryptoUtils.generateLSAGSignature(
                this.voterKeyPair.privateKey,
                ringPublicKeys,
                registrationMessage
            );

            console.log('🖊️  LSAG signature generated for registration');
            console.log('Linking Tag:', lsagSignature.linkingTag);

            return {
                signature: lsagSignature,
                message: CryptoUtils.bufferToHex(registrationMessage),
                publicKey: CryptoUtils.bufferToHex(this.voterKeyPair.publicKey)
            };

        } catch (error) {
            console.error('Failed to generate LSAG signature:', error);
            throw error;
        }
    }

    /**
     * Step 5: Submit LSAG signature for verification and registration
     * @param {Object} lsagData - LSAG signature data
     * @returns {Object} Transaction receipt
     */
    async submitLSAGRegistration(lsagData) {
        try {
            console.log('📤 Submitting LSAG registration...');

            // Convert signature to format expected by contract (simplified)
            const signatureBytes = Buffer.concat([
                CryptoUtils.hexToBuffer(lsagData.signature.c[0]),
                CryptoUtils.hexToBuffer(lsagData.signature.s[0])
            ]);

            const publicKeyBytes = CryptoUtils.hexToBuffer(lsagData.publicKey);

            // Submit to blockchain via verify function
            const receipt = await this.blockchain.verify(signatureBytes, publicKeyBytes);

            this.registrationStatus.lsagRegistered = true;
            console.log('✅ LSAG registration completed successfully!');
            console.log('🎉 Voter is now fully registered and can participate in voting!');

            return receipt;

        } catch (error) {
            console.error('Failed to submit LSAG registration:', error);
            throw error;
        }
    }

    /**
     * Complete registration workflow
     * @param {string} transactionPrivateKey - Private key for blockchain transactions
     * @param {Object} certificate - Certificate from government (optional if already set)
     * @returns {Object} Complete registration result
     */
    async completeRegistration(transactionPrivateKey, certificate = null) {
        try {
            console.log('🚀 Starting complete voter registration process...\n');

            // Step 1: Generate keys if not already done
            if (!this.registrationStatus.keyGenerated) {
                this.generateVoterKeys();
            }

            // Step 2: Receive certificate if provided
            if (certificate) {
                this.receiveCertificate(certificate);
            }

            if (!this.registrationStatus.certificateReceived) {
                throw new Error('Certificate required for registration. Contact government authority.');
            }

            // Step 3: Submit certificate
            console.log('\n📋 Phase 1: Certificate Submission');
            const certificateReceipt = await this.submitCertificate(transactionPrivateKey);

            // Step 4: Generate LSAG signature
            console.log('\n📋 Phase 2: LSAG Signature Generation');
            const lsagData = await this.generateLSAGSignature();

            // Step 5: Submit LSAG registration
            console.log('\n📋 Phase 3: LSAG Registration Submission');
            const lsagReceipt = await this.submitLSAGRegistration(lsagData);

            // Final verification
            const ringSize = await this.blockchain.getRingSize();
            const totalRegistrations = await this.blockchain.getTotalRegistrations();

            const result = {
                status: 'SUCCESS',
                registrationStatus: this.registrationStatus,
                transactions: {
                    certificate: certificateReceipt.hash,
                    lsagRegistration: lsagReceipt.hash
                },
                voterInfo: {
                    publicKey: CryptoUtils.bufferToHex(this.voterKeyPair.publicKey),
                    certificateHash: this.getCertificateHash(),
                    ringPosition: ringSize.toString(),
                    registrationIndex: totalRegistrations.toString()
                },
                completedAt: new Date().toISOString()
            };

            console.log('\n🎊 REGISTRATION COMPLETE! 🎊');
            console.log('Registration Summary:', result);

            return result;

        } catch (error) {
            console.error('❌ Registration failed:', error);
            return {
                status: 'FAILED',
                error: error.message,
                registrationStatus: this.registrationStatus,
                failedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Check registration status on blockchain
     * @returns {Object} Current registration status
     */
    async checkRegistrationStatus() {
        try {
            if (!this.voterKeyPair) {
                return { status: 'NO_KEYS_GENERATED' };
            }

            const publicKey = this.voterKeyPair.publicKey;
            
            // Check if public key is stored
            const isStored = await this.blockchain.isPublicKeyStored(publicKey);
            
            // Check if in ring
            const inRing = await this.blockchain.isPublicKeyInRing(publicKey);

            return {
                keyGenerated: this.registrationStatus.keyGenerated,
                certificateReceived: this.registrationStatus.certificateReceived,
                publicKeyStored: isStored,
                inVoterRing: inRing,
                fullyRegistered: isStored && inRing
            };

        } catch (error) {
            console.error('Failed to check registration status:', error);
            return { status: 'ERROR', error: error.message };
        }
    }

    /**
     * Save voter credentials to file
     * @param {string} filePath - Path to save credentials
     * @param {string} password - Password for encryption (optional)
     */
    saveCredentials(filePath, password = null) {
        if (!this.voterKeyPair) {
            throw new Error('No credentials to save');
        }

        const credentials = {
            privateKey: CryptoUtils.bufferToHex(this.voterKeyPair.privateKey),
            publicKey: CryptoUtils.bufferToHex(this.voterKeyPair.publicKey),
            certificate: this.certificate,
            registrationStatus: this.registrationStatus,
            createdAt: new Date().toISOString()
        };

        // Simple encryption if password provided (in production, use proper encryption)
        if (password) {
            const crypto = require('crypto');
            const cipher = crypto.createCipher('aes256', password);
            const encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex') + cipher.final('hex');
            fs.writeFileSync(filePath, JSON.stringify({ encrypted: true, data: encrypted }));
        } else {
            fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2));
        }

        console.log(`💾 Credentials saved to: ${filePath}`);
    }

    /**
     * Load voter credentials from file
     * @param {string} filePath - Path to credentials file
     * @param {string} password - Password for decryption (if encrypted)
     */
    loadCredentials(filePath, password = null) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Credentials file not found: ${filePath}`);
        }

        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let credentials;
        if (fileData.encrypted && password) {
            const crypto = require('crypto');
            const decipher = crypto.createDecipher('aes256', password);
            const decrypted = decipher.update(fileData.data, 'hex', 'utf8') + decipher.final('utf8');
            credentials = JSON.parse(decrypted);
        } else {
            credentials = fileData;
        }

        this.loadVoterKeys(credentials.privateKey);
        if (credentials.certificate) {
            this.certificate = credentials.certificate;
            this.registrationStatus.certificateReceived = true;
        }
        this.registrationStatus = { ...this.registrationStatus, ...credentials.registrationStatus };

        console.log('✅ Credentials loaded from file');
    }

    /**
     * Get certificate hash for tracking
     * @returns {string} Certificate hash
     */
    getCertificateHash() {
        if (!this.certificate) return null;
        
        const crypto = require('crypto');
        return crypto.createHash('sha256')
            .update(this.certificate.sigma_tilde_v + this.certificate.P_ugov + this.certificate.P_uv)
            .digest('hex');
    }
}

module.exports = VoterRegistration;

// CLI interface for direct usage
if (require.main === module) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    async function runVoterRegistrationCLI() {
        console.log('🗳️  Voter Registration CLI');
        console.log('===========================\n');

        try {
            // Load deployment configuration
            const deploymentPath = path.join(__dirname, '../config/deployment.json');
            if (!fs.existsSync(deploymentPath)) {
                throw new Error('Deployment configuration not found. Run deploy-contracts.js first.');
            }

            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            const registration = new VoterRegistration(deployment.contractAddress);

            console.log('Contract Address:', deployment.contractAddress);

            const voterPrivateKey = await new Promise(resolve => {
                rl.question('Enter your private key for transactions (or press Enter to generate new keys): ', resolve);
            });

            if (voterPrivateKey.trim()) {
                registration.loadVoterKeys(voterPrivateKey);
            } else {
                registration.generateVoterKeys();
            }

            const certificateJson = await new Promise(resolve => {
                rl.question('Enter certificate JSON (from government): ', resolve);
            });

            const certificate = JSON.parse(certificateJson);
            
            console.log('\n🚀 Starting registration...');
            const result = await registration.completeRegistration(voterPrivateKey || registration.voterKeyPair.privateKey, certificate);
            
            if (result.status === 'SUCCESS') {
                console.log('\n🎉 Registration successful!');
                const credentialsPath = path.join(__dirname, '../config/voter-credentials.json');
                registration.saveCredentials(credentialsPath);
            } else {
                console.log('\n❌ Registration failed:', result.error);
            }

        } catch (error) {
            console.error('CLI error:', error);
        } finally {
            rl.close();
        }
    }

    runVoterRegistrationCLI();
}