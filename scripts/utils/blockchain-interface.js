const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Blockchain Interface Utilities for LSAG E-Voting System
 * Handles all interactions with the deployed EVoting smart contract
 */

class BlockchainInterface {
    constructor(contractAddress, providerUrl = 'http://10.10.0.60:8550') {
        this.contractAddress = contractAddress;
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.contract = null;
        this.wallet = null;
        
        // Load contract ABI
        this.contractABI = this.loadContractABI();
    }

    /**
     * Load contract ABI from artifacts
     * @returns {Array} Contract ABI
     */
    loadContractABI() {
        try {
            const artifactPath = path.join(__dirname, '../../artifacts/contracts/Evoting.sol/EVoting.json');
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            return artifact.abi;
        } catch (error) {
            console.error('Failed to load contract ABI:', error);
            throw new Error('Contract ABI not found. Make sure the contract is compiled.');
        }
    }

    /**
     * Connect with a wallet using private key
     * @param {string} privateKey - Wallet private key
     */
    connectWallet(privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.wallet);
        console.log(`Connected wallet: ${this.wallet.address}`);
    }

    /**
     * Connect with read-only access (no wallet)
     */
    connectReadOnly() {
        this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.provider);
        console.log('Connected in read-only mode');
    }

    /**
     * Get contract instance
     * @returns {Contract} Ethers contract instance
     */
    getContract() {
        if (!this.contract) {
            throw new Error('Contract not initialized. Call connectWallet() or connectReadOnly() first.');
        }
        return this.contract;
    }

    // ==================== REGISTRATION PHASE METHODS ====================

    /**
     * Store voter's public key certificate on blockchain
     * @param {Object} certificate - Certificate object {sigma_tilde_v, P_ugov, P_uv}
     * @returns {Object} Transaction receipt
     */
    async storePub(certificate) {
        try {
            const tx = await this.contract.storePub(certificate);
            const receipt = await tx.wait();
            
            console.log('Certificate stored successfully!');
            console.log('Transaction hash:', receipt.hash);
            console.log('Gas used:', receipt.gasUsed.toString());
            
            return receipt;
        } catch (error) {
            console.error('Failed to store certificate:', error);
            throw error;
        }
    }

    /**
     * Verify and register voter with LSAG signature
     * @param {Buffer} sigma_vu - LSAG signature
     * @param {Buffer} P_vu - Voter's public key  
     * @param {string} privateKey - Private key for transaction (optional)
     * @returns {Object} Transaction receipt
     */
    async verify(sigma_vu, P_vu, privateKey = null) {
        try {
            let contractToUse = this.contract;
            
            // Use provided private key if given
            if (privateKey) {
                const wallet = new ethers.Wallet(privateKey, this.provider);
                // Use the same ABI that's already loaded
                contractToUse = this.contract.connect(wallet);
            }
            
            const tx = await contractToUse.verify(sigma_vu, P_vu);
            const receipt = await tx.wait();
            
            console.log('Voter registration verified successfully!');
            console.log('Transaction hash:', receipt.hash);
            console.log('Gas used:', receipt.gasUsed.toString());
            
            return {
                success: true,
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                receipt: receipt
            };
        } catch (error) {
            console.error('Failed to verify registration:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ==================== QUERY METHODS ====================

    /**
     * Check if a public key is stored
     * @param {Buffer} publicKey - Public key to check
     * @returns {boolean} True if public key exists
     */
    async isPublicKeyStored(publicKey) {
        try {
            const result = await this.contract.publicKeys(publicKey);
            return result.exists;
        } catch (error) {
            console.error('Failed to check public key:', error);
            return false;
        }
    }

    /**
     * Get voter ring (all registered public key hashes)
     * @returns {Array} Array of public key hashes
     */
    async getVoterRing() {
        try {
            const ring = await this.contract.getVoterRing();
            console.log(`Voter ring size: ${ring.length}`);
            return ring;
        } catch (error) {
            console.error('Failed to get voter ring:', error);
            throw error;
        }
    }

    /**
     * Get total number of registrations
     * @returns {number} Total registrations
     */
    async getTotalRegistrations() {
        try {
            const total = await this.contract.getTotalRegistrations();
            return Number(total);
        } catch (error) {
            console.error('Failed to get total registrations:', error);
            throw error;
        }
    }

    /**
     * Check if a signature is already registered
     * @param {Buffer} sigma_vu - LSAG signature to check
     * @returns {boolean} True if signature is registered
     */
    async isSignatureRegistered(sigma_vu) {
        try {
            const result = await this.contract.isSignatureRegistered(sigma_vu);
            return result;
        } catch (error) {
            console.error('Failed to check signature registration:', error);
            return false;
        }
    }

    /**
     * Check if public key is in the ring
     * @param {Buffer} publicKey - Public key to check
     * @returns {boolean} True if public key is in ring
     */
    async isPublicKeyInRing(publicKey) {
        try {
            const result = await this.contract.isPublicKeyInRing(publicKey);
            return result;
        } catch (error) {
            console.error('Failed to check ring membership:', error);
            return false;
        }
    }

    /**
     * Get registration details by index
     * @param {number} index - Registration index
     * @returns {Object} Registration details
     */
    async getRegistration(index) {
        try {
            const registration = await this.contract.getRegistration(index);
            return {
                sigma_vu: registration.sigma_vu,
                P_vu: registration.P_vu,
                exists: registration.exists
            };
        } catch (error) {
            console.error('Failed to get registration:', error);
            throw error;
        }
    }

    /**
     * Get ring size
     * @returns {number} Size of the voter ring
     */
    async getRingSize() {
        try {
            const size = await this.contract.getRingSize();
            return Number(size);
        } catch (error) {
            console.error('Failed to get ring size:', error);
            throw error;
        }
    }

    // ==================== EVENT LISTENING ====================

    /**
     * Listen for PublicKeyStored events
     * @param {Function} callback - Callback function to handle events
     */
    onPublicKeyStored(callback) {
        this.contract.on('PublicKeyStored', (signature, publicKey, event) => {
            console.log('🔑 Public Key Stored Event:', {
                signature: signature,
                publicKey: publicKey,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
            callback({ signature, publicKey, event });
        });
    }

    /**
     * Listen for VoterVerified events
     * @param {Function} callback - Callback function to handle events
     */
    onVoterVerified(callback) {
        this.contract.on('VoterVerified', (sigma_vu, P_vu, event) => {
            console.log('✅ Voter Verified Event:', {
                sigma_vu: sigma_vu,
                P_vu: P_vu,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
            callback({ sigma_vu, P_vu, event });
        });
    }

    /**
     * Listen for RegistrationAdded events
     * @param {Function} callback - Callback function to handle events
     */
    onRegistrationAdded(callback) {
        this.contract.on('RegistrationAdded', (registrationIndex, sigma_vu, P_vu, event) => {
            console.log('📝 Registration Added Event:', {
                registrationIndex: Number(registrationIndex),
                sigma_vu: sigma_vu,
                P_vu: P_vu,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            });
            callback({ registrationIndex: Number(registrationIndex), sigma_vu, P_vu, event });
        });
    }

    /**
     * Stop listening to all events
     */
    removeAllListeners() {
        if (this.contract) {
            this.contract.removeAllListeners();
            console.log('Stopped listening to all events');
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get current block number
     * @returns {number} Current block number
     */
    async getCurrentBlockNumber() {
        return await this.provider.getBlockNumber();
    }

    /**
     * Get transaction receipt
     * @param {string} txHash - Transaction hash
     * @returns {Object} Transaction receipt
     */
    async getTransactionReceipt(txHash) {
        return await this.provider.getTransactionReceipt(txHash);
    }

    /**
     * Get wallet balance
     * @returns {string} Balance in ETH
     */
    async getBalance() {
        if (!this.wallet) {
            throw new Error('No wallet connected');
        }
        const balance = await this.provider.getBalance(this.wallet.address);
        return ethers.formatEther(balance);
    }

    /**
     * Estimate gas for a transaction
     * @param {string} methodName - Contract method name
     * @param {Array} params - Method parameters
     * @returns {bigint} Estimated gas
     */
    async estimateGas(methodName, params = []) {
        try {
            const gasEstimate = await this.contract[methodName].estimateGas(...params);
            return gasEstimate;
        } catch (error) {
            console.error(`Failed to estimate gas for ${methodName}:`, error);
            throw error;
        }
    }

    /**
     * Create contract instance with different address
     * @param {string} contractAddress - Contract address
     * @returns {BlockchainInterface} New interface instance
     */
    static createInstance(contractAddress, providerUrl) {
        return new BlockchainInterface(contractAddress, providerUrl);
    }
}

module.exports = BlockchainInterface;