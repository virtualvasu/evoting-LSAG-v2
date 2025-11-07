const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CryptoUtils = require('../utils/crypto-utils');

/**
 * Government Certificate Generator for LSAG E-Voting System
 * Generates certificates for eligible voters to enable registration
 */

class GovernmentCertificateGenerator {
    constructor(configPath = null) {
        // Load government configuration
        this.configPath = configPath || path.join(__dirname, '../config/government-config.json');
        this.loadGovernmentConfig();
        
        // Initialize voter database
        this.voterDatabase = new Map();
        this.certificateDatabase = new Map();
        
        console.log('🏛️  Government Certificate Generator initialized');
        console.log('Government Address:', this.governmentAddress);
    }

    /**
     * Load government configuration from file
     */
    loadGovernmentConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Government config not found at ${this.configPath}`);
            }
            
            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            this.governmentAddress = config.address;
            this.governmentPublicKey = CryptoUtils.hexToBuffer(config.publicKey);
            this.governmentPrivateKey = CryptoUtils.hexToBuffer(config.privateKey);
            
            console.log('✅ Government configuration loaded successfully');
        } catch (error) {
            console.error('Failed to load government configuration:', error);
            throw error;
        }
    }

    /**
     * Add eligible voter to the system
     * @param {string} voterId - Unique voter identifier
     * @param {Object} voterInfo - Voter information
     * @returns {Object} Voter record
     */
    addEligibleVoter(voterId, voterInfo) {
        if (this.voterDatabase.has(voterId)) {
            throw new Error(`Voter ${voterId} already exists`);
        }

        const voterRecord = {
            id: voterId,
            name: voterInfo.name || 'Anonymous',
            email: voterInfo.email || null,
            publicKey: null, // Will be set when voter generates keys
            certificateIssued: false,
            certificateHash: null,
            registeredAt: null,
            createdAt: new Date().toISOString()
        };

        this.voterDatabase.set(voterId, voterRecord);
        console.log(`✅ Added eligible voter: ${voterId} (${voterRecord.name})`);
        
        return voterRecord;
    }

    /**
     * Add multiple eligible voters from a list
     * @param {Array} voterList - Array of voter objects
     * @returns {Array} Array of voter records
     */
    addEligibleVoters(voterList) {
        const addedVoters = [];
        
        for (const voter of voterList) {
            try {
                const voterRecord = this.addEligibleVoter(voter.id, voter);
                addedVoters.push(voterRecord);
            } catch (error) {
                console.warn(`Failed to add voter ${voter.id}:`, error.message);
            }
        }

        console.log(`✅ Added ${addedVoters.length} eligible voters out of ${voterList.length}`);
        return addedVoters;
    }

    /**
     * Generate certificate for a voter
     * @param {string} voterId - Voter identifier
     * @param {Buffer} voterPublicKey - Voter's public key (64 bytes)
     * @returns {Object} Certificate object
     */
    generateCertificate(voterId, voterPublicKey) {
        // Check if voter exists and is eligible
        if (!this.voterDatabase.has(voterId)) {
            throw new Error(`Voter ${voterId} not found in eligible voter list`);
        }

        const voter = this.voterDatabase.get(voterId);
        
        if (voter.certificateIssued) {
            throw new Error(`Certificate already issued for voter ${voterId}`);
        }

        // Validate public key format
        if (!Buffer.isBuffer(voterPublicKey) || voterPublicKey.length !== 64) {
            throw new Error('Voter public key must be 64 bytes (uncompressed format)');
        }

        try {
            // Create certificate using PKS (Public Key Signature)
            const certificate = CryptoUtils.createCertificate(
                voterPublicKey,
                this.governmentPrivateKey,
                this.governmentPublicKey
            );

            // Generate certificate hash for tracking
            const certificateHash = CryptoUtils.bufferToHex(
                crypto.createHash('sha256')
                    .update(Buffer.concat([
                        certificate.sigma_tilde_v,
                        certificate.P_ugov,
                        certificate.P_uv
                    ]))
                    .digest()
            );

            // Update voter record
            voter.publicKey = CryptoUtils.bufferToHex(voterPublicKey);
            voter.certificateIssued = true;
            voter.certificateHash = certificateHash;
            voter.registeredAt = new Date().toISOString();

            // Store certificate
            this.certificateDatabase.set(certificateHash, {
                voterId: voterId,
                certificate: {
                    sigma_tilde_v: CryptoUtils.bufferToHex(certificate.sigma_tilde_v),
                    P_ugov: CryptoUtils.bufferToHex(certificate.P_ugov),
                    P_uv: CryptoUtils.bufferToHex(certificate.P_uv)
                },
                issuedAt: new Date().toISOString(),
                used: false
            });

            console.log(`✅ Certificate generated for voter ${voterId}`);
            console.log(`Certificate Hash: ${certificateHash}`);

            return {
                voterId: voterId,
                certificateHash: certificateHash,
                certificate: {
                    sigma_tilde_v: CryptoUtils.bufferToHex(certificate.sigma_tilde_v),
                    P_ugov: CryptoUtils.bufferToHex(certificate.P_ugov),
                    P_uv: CryptoUtils.bufferToHex(certificate.P_uv)
                }
            };

        } catch (error) {
            console.error(`Failed to generate certificate for ${voterId}:`, error);
            throw error;
        }
    }

    /**
     * Verify certificate authenticity
     * @param {Object} certificate - Certificate to verify
     * @returns {boolean} True if certificate is valid
     */
    verifyCertificate(certificate) {
        try {
            const voterPublicKey = CryptoUtils.hexToBuffer(certificate.P_uv);
            const governmentPublicKey = CryptoUtils.hexToBuffer(certificate.P_ugov);
            const signature = CryptoUtils.hexToBuffer(certificate.sigma_tilde_v);

            // Verify government public key matches
            if (Buffer.compare(governmentPublicKey, this.governmentPublicKey) !== 0) {
                console.error('Government public key mismatch');
                return false;
            }

            // Verify signature
            const messageHash = Buffer.from(CryptoUtils.hashVote(certificate.P_uv, Buffer.alloc(0)).slice(2), 'hex');
            return CryptoUtils.verifySignature(messageHash, signature, governmentPublicKey);

        } catch (error) {
            console.error('Certificate verification failed:', error);
            return false;
        }
    }

    /**
     * Get voter information
     * @param {string} voterId - Voter identifier
     * @returns {Object} Voter information
     */
    getVoterInfo(voterId) {
        return this.voterDatabase.get(voterId) || null;
    }

    /**
     * Get certificate by hash
     * @param {string} certificateHash - Certificate hash
     * @returns {Object} Certificate information
     */
    getCertificate(certificateHash) {
        return this.certificateDatabase.get(certificateHash) || null;
    }

    /**
     * List all eligible voters
     * @returns {Array} Array of voter records
     */
    listEligibleVoters() {
        return Array.from(this.voterDatabase.values());
    }

    /**
     * List all issued certificates
     * @returns {Array} Array of certificate records
     */
    listIssuedCertificates() {
        return Array.from(this.certificateDatabase.values());
    }

    /**
     * Get statistics
     * @returns {Object} System statistics
     */
    getStatistics() {
        const totalEligible = this.voterDatabase.size;
        const certificatesIssued = Array.from(this.voterDatabase.values())
            .filter(voter => voter.certificateIssued).length;
        
        return {
            totalEligibleVoters: totalEligible,
            certificatesIssued: certificatesIssued,
            pendingCertificates: totalEligible - certificatesIssued,
            certificatesUsed: Array.from(this.certificateDatabase.values())
                .filter(cert => cert.used).length
        };
    }

    /**
     * Save voter database to file
     * @param {string} filePath - Path to save the database
     */
    saveDatabase(filePath = null) {
        const savePath = filePath || path.join(__dirname, '../config/voter-database.json');
        
        const database = {
            voters: Object.fromEntries(this.voterDatabase),
            certificates: Object.fromEntries(this.certificateDatabase),
            savedAt: new Date().toISOString()
        };

        fs.writeFileSync(savePath, JSON.stringify(database, null, 2));
        console.log(`💾 Database saved to: ${savePath}`);
    }

    /**
     * Load voter database from file
     * @param {string} filePath - Path to load the database from
     */
    loadDatabase(filePath = null) {
        const loadPath = filePath || path.join(__dirname, '../config/voter-database.json');
        
        if (!fs.existsSync(loadPath)) {
            console.log('No existing database found, starting fresh');
            return;
        }

        try {
            const database = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
            
            this.voterDatabase = new Map(Object.entries(database.voters || {}));
            this.certificateDatabase = new Map(Object.entries(database.certificates || {}));
            
            console.log(`✅ Database loaded from: ${loadPath}`);
            console.log(`Loaded ${this.voterDatabase.size} voters and ${this.certificateDatabase.size} certificates`);
        } catch (error) {
            console.error('Failed to load database:', error);
            throw error;
        }
    }

    /**
     * Mark certificate as used (after successful blockchain registration)
     * @param {string} certificateHash - Certificate hash to mark as used
     */
    markCertificateAsUsed(certificateHash) {
        const certificate = this.certificateDatabase.get(certificateHash);
        if (certificate) {
            certificate.used = true;
            certificate.usedAt = new Date().toISOString();
            console.log(`✅ Certificate ${certificateHash} marked as used`);
        }
    }
}

module.exports = GovernmentCertificateGenerator;

// CLI interface for direct usage
if (require.main === module) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    async function runCLI() {
        console.log('🏛️  Government Certificate Generator CLI');
        console.log('========================================\n');

        try {
            const generator = new GovernmentCertificateGenerator();
            generator.loadDatabase(); // Load existing data

            while (true) {
                console.log('\nOptions:');
                console.log('1. Add eligible voter');
                console.log('2. Generate certificate');
                console.log('3. View statistics');
                console.log('4. List voters');
                console.log('5. Save and exit');
                
                const choice = await new Promise(resolve => {
                    rl.question('Enter choice (1-5): ', resolve);
                });

                if (choice === '1') {
                    // Add eligible voter
                    const voterId = await new Promise(resolve => {
                        rl.question('Enter voter ID: ', resolve);
                    });
                    const voterName = await new Promise(resolve => {
                        rl.question('Enter voter name: ', resolve);
                    });
                    const voterEmail = await new Promise(resolve => {
                        rl.question('Enter voter email (optional): ', resolve);
                    });
                    
                    try {
                        const voterInfo = {
                            name: voterName,
                            email: voterEmail || null
                        };
                        generator.addEligibleVoter(voterId, voterInfo);
                        console.log(`✅ Added voter: ${voterId} (${voterName})`);
                    } catch (error) {
                        console.error(`❌ Failed to add voter: ${error.message}`);
                    }
                    
                } else if (choice === '2') {
                    // Generate certificate
                    const voterId = await new Promise(resolve => {
                        rl.question('Enter voter ID for certificate generation: ', resolve);
                    });
                    const voterPublicKey = await new Promise(resolve => {
                        rl.question('Enter voter public key (64-byte hex): ', resolve);
                    });
                    
                    try {
                        const CryptoUtils = require('../utils/crypto-utils');
                        const publicKeyBuffer = CryptoUtils.hexToBuffer(voterPublicKey);
                        const result = generator.generateCertificate(voterId, publicKeyBuffer);
                        
                        console.log('\n✅ Certificate Generated!');
                        console.log('Voter ID:', result.voterId);
                        console.log('Certificate Hash:', result.certificateHash);
                        console.log('\n📜 Certificate (share this with the voter):');
                        console.log(JSON.stringify(result.certificate, null, 2));
                        
                    } catch (error) {
                        console.error(`❌ Failed to generate certificate: ${error.message}`);
                    }
                    
                } else if (choice === '3') {
                    console.log('\n📊 Statistics:', generator.getStatistics());
                } else if (choice === '4') {
                    console.log('\n📋 Eligible Voters:');
                    const voters = generator.listEligibleVoters();
                    if (voters.length === 0) {
                        console.log('No voters registered yet.');
                    } else {
                        voters.forEach((voter, index) => {
                            console.log(`${index + 1}. ${voter.id} - ${voter.name} - Certificate: ${voter.certificateIssued ? '✅' : '❌'}`);
                        });
                    }
                } else if (choice === '5') {
                    generator.saveDatabase();
                    console.log('👋 Goodbye!');
                    break;
                } else {
                    console.log('❌ Invalid choice. Please enter 1-5.');
                }
            }
        } catch (error) {
            console.error('CLI error:', error);
        } finally {
            rl.close();
        }
    }

    runCLI();
}