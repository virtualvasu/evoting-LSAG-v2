import { ethers } from 'ethers';

export interface Certificate {
  voterName: string;
  sid: string;
  voterPublicKey: string;
  signature: string;
  governmentPublicKey: string;
}

export interface UpdateRingResult {
  success: boolean;
  voterName: string;
  sid: string;
  ringPosition: string;
  ringSize: string;
  voterRing: string[];
  transactionHash: string;
}

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Signer | null = null;
  private contractABI: any[] = [];
  
  constructor(private contractAddress: string, private rpcUrl: string = 'http://localhost:8545') {}

  /**
   * Load contract ABI from API
   */
  async loadABI(): Promise<void> {
    const response = await fetch('/api/contract');
    if (!response.ok) {
      throw new Error('Failed to load contract config');
    }
    const data = await response.json();
    this.contractABI = data.abi;
  }

  /**
   * Connect to MetaMask or browser wallet
   */
  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Please install MetaMask or another Web3 wallet');
    }

    // Load ABI first
    if (this.contractABI.length === 0) {
      await this.loadABI();
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    this.signer = await this.provider.getSigner();
    const address = await this.signer.getAddress();
    
    // Check network
    const network = await this.provider.getNetwork();
    console.log('Connected to network:', network.chainId.toString());
    
    // Verify contract exists at address
    const code = await this.provider.getCode(this.contractAddress);
    if (code === '0x') {
      throw new Error(
        `No contract found at ${this.contractAddress}. ` +
        `Please check: 1) Contract address is correct, 2) You're connected to the right network (chainId: ${network.chainId}), 3) Contract is deployed.`
      );
    }
    
    this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);
    
    return address;
  }

  /**
   * Connect with read-only access via RPC
   */
  async connectReadOnly(): Promise<void> {
    // Load ABI first
    if (this.contractABI.length === 0) {
      await this.loadABI();
    }
    
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.contract = new ethers.Contract(this.contractAddress, this.contractABI, provider);
  }

  /**
   * Get current ring size
   */
  async getRingSize(): Promise<bigint> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return await this.contract.getRingSize();
  }

  /**
   * Get complete voter ring
   */
  async getVoterRing(): Promise<string[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    const ring = await this.contract.getVoterRing();
    // Convert bytes32[] to string[]
    return ring.map((hash: string) => hash);
  }

  /**
   * Store voter's public key certificate on blockchain
   */
  async storePub(certificate: Certificate): Promise<UpdateRingResult> {
    if (!this.contract || !this.signer) {
      throw new Error('Wallet not connected');
    }

    // Validate certificate format
    if (!certificate.voterName || !certificate.sid || !certificate.voterPublicKey || 
        !certificate.signature || !certificate.governmentPublicKey) {
      throw new Error('Invalid certificate format. Required fields: voterName, sid, voterPublicKey, signature, governmentPublicKey');
    }

    // Get current ring size
    const currentRingSize = await this.getRingSize();

    // Convert hex strings to bytes format for Solidity
    const certForContract = {
      sigma_tilde_v: certificate.signature,
      P_ugov: certificate.governmentPublicKey,
      P_uv: certificate.voterPublicKey,
      voterName: certificate.voterName,
      sid: certificate.sid
    };

    // Submit certificate to contract
    const tx = await this.contract.storePub(certForContract);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Transaction failed');
    }

    // Get updated ring
    const newRingSize = await this.getRingSize();
    const voterRing = await this.getVoterRing();

    return {
      success: true,
      voterName: certificate.voterName,
      sid: certificate.sid,
      ringPosition: (newRingSize - 1n).toString(),
      ringSize: newRingSize.toString(),
      voterRing: voterRing,
      transactionHash: receipt.hash
    };
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
