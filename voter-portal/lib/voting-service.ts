import { ethers } from 'ethers';

export interface VoteData {
  kv: number;
  candidateChoice: string;
  r: string;
  h_v: string;
  sigma_v_prime: {
    r: string;
    s: string;
    v: number;
  };
  timestamp: string;
}

export interface VoteGenerationResult {
  success: boolean;
  voteData?: VoteData;
  error?: string;
}

export interface VoteCastResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
}

// List of default candidates (can be updated based on current election)
export const DEFAULT_CANDIDATES = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'] as const;
export type Candidate = string;

/**
 * Voting Service for E-Voting System
 * Handles vote generation and casting
 */
export class VotingService {
  private provider: ethers.BrowserProvider | null = null;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Signer | null = null;
  private contractABI: any[] = [];

  constructor(
    private contractAddress: string,
    private rpcUrl: string = 'http://10.10.0.61:8550'
  ) {
    if (!contractAddress || contractAddress === 'undefined' || contractAddress === 'null') {
      throw new Error('Invalid contract address provided');
    }
  }

  /**
   * Load contract ABI from API
   */
  async loadABI(): Promise<void> {
    const response = await fetch('/api/contract');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load contract config');
    }
    const data = await response.json();
    
    if (!data.abi || data.abi.length === 0) {
      throw new Error('ABI not found in contract configuration');
    }
    
    this.contractABI = data.abi;
  }

  /**
   * Connect to wallet
   */
  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Please install MetaMask or another Web3 wallet');
    }

    if (this.contractABI.length === 0) {
      await this.loadABI();
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    this.signer = await this.provider.getSigner();
    const address = await this.signer.getAddress();

    const network = await this.provider.getNetwork();
    console.log('Connected to network:', network.chainId.toString());

    if (!this.contractAddress || this.contractAddress === 'undefined' || this.contractAddress === 'null') {
      throw new Error('Contract address is not set. Please ensure contract-config.json is properly configured.');
    }

    const code = await this.provider.getCode(this.contractAddress);
    if (code === '0x') {
      throw new Error(
        `No contract found at ${this.contractAddress}. ` +
        `Please check contract deployment.`
      );
    }

    this.contract = new ethers.Contract(
      this.contractAddress,
      this.contractABI,
      this.signer
    );

    return address;
  }

  /**
   * Generate vote data
   * 
   * Steps per protocol:
   * 1. Get candidate choice (c)
   * 2. Generate random number r
   * 3. Calculate h_v = hash(c || r)
   * 4. Calculate sigma_v_prime = PKS.sign(h_v, new_private_key)
   * 5. Return sigma_v_prime, h_v, k_v
   */
  async generateVote(
    newPrivateKey: string,
    candidateChoice: Candidate,
    kv: number
  ): Promise<VoteGenerationResult> {
    try {
      // Validate inputs
      if (!newPrivateKey || !candidateChoice || kv === undefined) {
        throw new Error('Missing required parameters');
      }

      // Validate private key format
      let cleanPrivateKey = newPrivateKey.startsWith('0x') 
        ? newPrivateKey.slice(2) 
        : newPrivateKey;
      
      // Pad with leading zero if needed (common case for keys that start with 0)
      if (cleanPrivateKey.length === 63 && /^[0-9a-fA-F]{63}$/.test(cleanPrivateKey)) {
        cleanPrivateKey = '0' + cleanPrivateKey;
      }
      
      if (!/^[0-9a-fA-F]{64}$/.test(cleanPrivateKey)) {
        throw new Error(`Invalid private key format. Must be 64 hexadecimal characters. Current length: ${cleanPrivateKey.length}`);
      }

      if (cleanPrivateKey === '0'.repeat(64)) {
        throw new Error('Invalid private key. Cannot be all zeros.');
      }

      console.log('Generating vote...');
      console.log('Candidate:', candidateChoice);
      console.log('Registration index (kv):', kv);

      // Step 1: Candidate choice (keep original case)
      const c = candidateChoice;

      // Step 2: Generate random number r (32 bytes)
      const randomBytes = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomBytes);
      } else {
        throw new Error('Web Crypto API not available');
      }
      const rHex = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      console.log('Generated random r');

      // Step 3: Calculate h_v = keccak256(c || r)
      // Use full candidate string (must match contract's abi.encodePacked)
      const cBytes = ethers.toUtf8Bytes(c);
      const rBytes = ethers.getBytes(rHex);
      const messageToHash = ethers.concat([cBytes, rBytes]);
      const h_vHex = ethers.keccak256(messageToHash);

      console.log('Generated hash h_v:', h_vHex);

      // Step 4: Sign h_v with new private key using PKS (Ethereum signing)
      const privateKeyHex = '0x' + cleanPrivateKey;

      const wallet = new ethers.Wallet(privateKeyHex);

      // Convert hash to bytes for signing
      const h_vBytes = ethers.getBytes(h_vHex);

      // Create Ethereum signed message hash
      const ethSignedHash = ethers.hashMessage(h_vBytes);

      // Sign the message
      const signature = wallet.signingKey.sign(ethSignedHash);
      const sig = ethers.Signature.from(signature);

      const sigma_v_prime = {
        r: ethers.zeroPadValue(sig.r, 32),
        s: ethers.zeroPadValue(sig.s, 32),
        v: sig.v,
      };

      console.log('Generated PKS signature');

      // Step 5: Prepare output
      const voteData: VoteData = {
        kv: kv,
        candidateChoice: c,
        r: rHex,
        h_v: h_vHex,
        sigma_v_prime: sigma_v_prime,
        timestamp: new Date().toISOString(),
      };

      console.log('Vote generated successfully!');

      return {
        success: true,
        voteData,
      };
    } catch (error: any) {
      console.error('Error generating vote:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate vote',
      };
    }
  }

  /**
   * Cast vote on blockchain
   * Calls BB.voting(k, h_v, r, s, v)
   */
  async castVote(voteData: VoteData): Promise<VoteCastResult> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect wallet first.');
      }

      console.log('Casting vote on blockchain...');
      console.log('Registration index:', voteData.kv);
      console.log('Vote hash:', voteData.h_v);

      // Call BBvoting function
      const tx = await this.contract.BBvoting(
        voteData.kv,
        voteData.h_v,
        voteData.sigma_v_prime.r,
        voteData.sigma_v_prime.s,
        voteData.sigma_v_prime.v
      );

      console.log('Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');

      const receipt = await tx.wait();

      console.log('Vote cast successfully!');
      console.log('Gas used:', receipt.gasUsed.toString());

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      console.error('Error casting vote:', error);
      return {
        success: false,
        error: error.message || 'Failed to cast vote on blockchain',
      };
    }
  }

  /**
   * Get registration entry from blockchain
   */
  async getRegistrationEntry(kv: number): Promise<any> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.registrationTable(kv);
    } catch (error) {
      console.error('Error fetching registration entry:', error);
      throw error;
    }
  }

  /**
   * Check if voter has already voted
   */
  async hasVoted(kv: number): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.hasVoted(kv);
    } catch (error) {
      console.error('Error checking vote status:', error);
      throw error;
    }
  }

  /**
   * Get current election candidates
   */
  async getElectionCandidates(): Promise<string[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.getCandidates();
    } catch (error: any) {
      console.error('Error fetching election candidates:', error);
      throw new Error(`Failed to get election candidates: ${error.message}`);
    }
  }

  /**
   * Get election results
   */
  async getResults(): Promise<Record<string, bigint>> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const allResults = await this.contract.getAllResults();
      const candidates = await this.contract.getCandidates();
      
      const results: Record<string, bigint> = {};
      for (let i = 0; i < candidates.length && i < allResults.length; i++) {
        results[candidates[i]] = BigInt(allResults[i]);
      }
      return results;
    } catch (error) {
      console.error('Error fetching results:', error);
      throw error;
    }
  }
}
