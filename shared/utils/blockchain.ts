// Shared blockchain interaction utilities
import { ethers } from 'ethers';
import { NETWORKS } from '../constants';
import type { NetworkConfig, TransactionResult, ElectionStatus } from '../types';

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

export class SharedBlockchainUtils {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private networkConfig: NetworkConfig;

  constructor(networkName: 'iitbh' | 'localhost' = 'iitbh') {
    this.networkConfig = NETWORKS[networkName];
  }

  /**
   * Initialize blockchain connection
   */
  async initialize(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        // Browser environment with MetaMask
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await (this.provider as ethers.BrowserProvider).getSigner();
      } else {
        // Node.js environment or server-side
        this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpc);
        // Signer will be set separately if needed
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain connection:', error);
      return false;
    }
  }

  /**
   * Set signer for transactions (useful in Node.js environment)
   */
  setSigner(privateKey: string): void {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    this.signer = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Initialize contract instance
   */
  initializeContract(abi: any[]): void {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    this.contract = new ethers.Contract(
      this.networkConfig.contractAddress,
      abi,
      this.signer || this.provider
    );
  }

  /**
   * Get current election status
   */
  async getElectionStatus(): Promise<ElectionStatus | null> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const [phase, voterCount, registeredVoters, votesCount] = await Promise.all([
        this.contract.currentPhase(),
        this.contract.getVoterRingSize(),
        this.contract.getRegisteredVoterCount(), 
        this.contract.getTotalVotes()
      ]);

      const results = await this.contract.getResults();

      return {
        phase: Number(phase),
        voterCount: Number(voterCount),
        registeredVoters: Number(registeredVoters),
        votesCount: Number(votesCount),
        results: results.map((r: any) => Number(r)),
        isActive: Number(phase) >= 1 && Number(phase) <= 3
      };
    } catch (error) {
      console.error('Failed to get election status:', error);
      return null;
    }
  }

  /**
   * Get voter ring information
   */
  async getVoterRing(): Promise<Array<{publicKeyX: string, publicKeyY: string}> | null> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const ringSize = await this.contract.getVoterRingSize();
      const ring = [];

      for (let i = 0; i < Number(ringSize); i++) {
        const voterInfo = await this.contract.getVoterInRing(i);
        ring.push({
          publicKeyX: voterInfo[0],
          publicKeyY: voterInfo[1]
        });
      }

      return ring;
    } catch (error) {
      console.error('Failed to get voter ring:', error);
      return null;
    }
  }

  /**
   * Check if voter is registered for voting
   */
  async isVoterRegistered(voterIndex: number): Promise<boolean> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      return await this.contract.isVoterRegistered(voterIndex);
    } catch (error) {
      console.error('Failed to check voter registration:', error);
      return false;
    }
  }

  /**
   * Check if voter has voted
   */
  async hasVoterVoted(voterIndex: number): Promise<boolean> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      return await this.contract.hasVoted(voterIndex);
    } catch (error) {
      console.error('Failed to check if voter voted:', error);
      return false;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string): Promise<TransactionResult> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const receipt = await this.provider.waitForTransaction(txHash);
      
      if (!receipt) {
        return { success: false, error: 'Transaction not found' };
      }

      if (receipt.status === 0) {
        return { success: false, error: 'Transaction reverted' };
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: Number(receipt.gasUsed)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash: string): Promise<any> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      return await this.provider.getTransaction(txHash);
    } catch (error) {
      console.error('Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Failed to get block number:', error);
      return 0;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * Estimate gas for a contract call
   */
  async estimateGas(functionName: string, params: any[]): Promise<number> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const gasEstimate = await this.contract[functionName].estimateGas(...params);
      return Number(gasEstimate);
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return 0;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const feeData = await this.provider.getFeeData();
      return ethers.formatUnits(feeData.gasPrice || 0, 'gwei');
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return '0';
    }
  }

  /**
   * Check if connected to correct network
   */
  async isCorrectNetwork(): Promise<boolean> {
    try {
      if (!this.provider) {
        return false;
      }

      const network = await this.provider.getNetwork();
      return Number(network.chainId) === this.networkConfig.chainId;
    } catch (error) {
      console.error('Failed to check network:', error);
      return false;
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{name: string, chainId: number, blockNumber: number} | null> {
    try {
      if (!this.provider) {
        return null;
      }

      const [network, blockNumber] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber()
      ]);

      return {
        name: network.name,
        chainId: Number(network.chainId),
        blockNumber
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return null;
    }
  }

  /**
   * Get contract instance (for custom calls)
   */
  getContract(): ethers.Contract {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return this.contract;
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.Provider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  /**
   * Get signer instance
   */
  getSigner(): ethers.Signer {
    if (!this.signer) {
      throw new Error('Signer not available');
    }
    return this.signer;
  }
}