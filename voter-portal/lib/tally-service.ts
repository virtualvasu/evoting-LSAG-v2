import { ethers } from 'ethers';

export interface VoteReveal {
  kv: number;
  candidateChoice: string;
  r: string;
}

export interface TallyResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: string;
  results?: ElectionResults;
  error?: string;
}

export interface ElectionResults {
  [candidateName: string]: string; // Dynamic candidate names with vote counts
  total: string;
}

export interface VoteVerification {
  valid: boolean;
  storedHash: string;
  calculatedHash: string;
  message?: string;
}

// List of default candidates (can be overridden by current election)
export const DEFAULT_CANDIDATES = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'] as const;
export type Candidate = string;

/**
 * Tally Service for E-Voting System
 * Handles vote tallying and result retrieval
 */
export class TallyService {
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
   * Verify vote integrity locally before tallying
   * Checks if keccak256(c || r) matches stored h_v
   */
  async verifyVoteIntegrity(
    kv: number,
    candidateChoice: Candidate,
    r: string
  ): Promise<VoteVerification> {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect wallet first.');
    }

    try {
      // Get stored vote hash
      const storedHash = await this.contract.getVoteHash(kv);
      
      if (storedHash === ethers.ZeroHash) {
        return {
          valid: false,
          storedHash: storedHash,
          calculatedHash: '',
          message: 'No vote found for this registration index',
        };
      }

      // Calculate hash locally: keccak256(c || r)
      // Use full candidate string (must match contract's abi.encodePacked)
      const candidateBytes = ethers.toUtf8Bytes(candidateChoice);
      const rBytes = ethers.getBytes(r);
      const messageToHash = ethers.concat([candidateBytes, rBytes]);
      const calculatedHash = ethers.keccak256(messageToHash);

      const valid = storedHash === calculatedHash;

      return {
        valid,
        storedHash,
        calculatedHash,
        message: valid
          ? 'Vote integrity verified successfully'
          : 'Hash mismatch! Vote may have been cast with different parameters',
      };
    } catch (error: any) {
      throw new Error(`Failed to verify vote: ${error.message}`);
    }
  }

  /**
   * Get current election status including available candidates
   */
  async getElectionCandidates(): Promise<string[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const candidates = await this.contract.getCandidates();
      return candidates;
    } catch (error: any) {
      throw new Error(`Failed to get election candidates: ${error.message}`);
    }
  }

  /**
   * Tally a vote by revealing (c, r)
   * Calls BB.tally(k, c, r) on blockchain
   * 
   * Steps per protocol:
   * 1. Verify k < |T|
   * 2. Verify T[k][2] != 0 (vote exists)
   * 3. Verify keccak256(c || r) == T[k][2]
   * 4. R[c]++
   */
  async tallyVote(voteReveal: VoteReveal): Promise<TallyResult> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect wallet first.');
      }

      const { kv, candidateChoice, r } = voteReveal;

      // Validate inputs
      if (!candidateChoice) {
        throw new Error('Candidate choice is required');
      }

      if (!r || !r.startsWith('0x')) {
        throw new Error('Invalid random number format. Must be hex string starting with 0x');
      }

      console.log('Tallying vote...');
      console.log('Registration index:', kv);
      console.log('Candidate:', candidateChoice);
      console.log('Random:', r.substring(0, 20) + '...');

      // Fetch current election's available candidates
      let electionCandidates: string[] = [];
      try {
        electionCandidates = await this.getElectionCandidates();
        console.log('Election candidates:', electionCandidates);
      } catch (err) {
        console.warn('Could not fetch election candidates:', err);
      }

      // Validate candidate is in current election
      if (electionCandidates.length > 0 && !electionCandidates.includes(candidateChoice)) {
        throw new Error(
          `Candidate '${candidateChoice}' is not valid for this election. ` +
          `Valid candidates are: ${electionCandidates.join(', ')}`
        );
      }

      // Verify locally first
      const verification = await this.verifyVoteIntegrity(
        kv,
        candidateChoice as Candidate,
        r
      );

      console.log('Local verification:', verification.message);
      console.log('Stored hash:', verification.storedHash);
      console.log('Calculated hash:', verification.calculatedHash);

      if (!verification.valid) {
        throw new Error(verification.message || 'Vote verification failed');
      }

      // Convert candidate choice to string name (no conversion needed)
      const rBytes = ethers.getBytes(r);

      // Call BBtally function
      console.log('Submitting tally transaction...');
      const tx = await this.contract.BBtally(kv, candidateChoice, rBytes);

      console.log('Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');

      const receipt = await tx.wait();

      console.log('Vote tallied successfully!');
      console.log('Gas used:', receipt.gasUsed.toString());

      // Get updated results
      const results = await this.getResults();

      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        results,
      };
    } catch (error: any) {
      console.error('Error tallying vote:', error);
      return {
        success: false,
        error: error.message || 'Failed to tally vote',
      };
    }
  }

  /**
   * Get current election results
   */
  async getResults(): Promise<ElectionResults> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Fetch both candidates and results from contract
      const [candidates, allResults] = await Promise.all([
        this.contract.getCandidates(),
        this.contract.getAllResults()
      ]);
      
      console.log('Candidates from contract:', candidates);
      console.log('Raw results from contract:', allResults);
      console.log('Results array length:', allResults.length);
      
      // Check if we have valid data
      if (!allResults || allResults.length === 0) {
        throw new Error('No election results available. Election may not be initialized.');
      }
      
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates found. Election may not be initialized.');
      }
      
      if (candidates.length !== allResults.length) {
        console.warn(`Mismatch: ${candidates.length} candidates but ${allResults.length} results`);
      }
      
      // Build results object with actual candidate names
      const results: ElectionResults = {
        total: '0',
      };
      
      let total = BigInt(0);
      
      for (let i = 0; i < candidates.length; i++) {
        const candidateName = candidates[i];
        const count = BigInt(allResults[i] || 0);
        results[candidateName] = count.toString();
        total += count;
      }
      
      results.total = total.toString();

      return results;
    } catch (error: any) {
      console.error('Error fetching results:', error);
      
      // Try to get more debugging info
      try {
        const electionStatus = await this.getElectionStatus();
        console.log('Election status for debugging:', electionStatus);
      } catch (debugError) {
        console.error('Could not fetch election status for debugging:', debugError);
      }
      
      throw new Error(`Failed to get results: ${error.message}`);
    }
  }

  /**
   * Get vote count for a specific candidate
   */
  async getVoteCount(candidate: Candidate): Promise<string> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const candidateByte = ethers.toBeHex(candidate.charCodeAt(0), 1);
      const count = await this.contract.getVoteCount(candidateByte);
      return count.toString();
    } catch (error: any) {
      console.error('Error fetching vote count:', error);
      throw error;
    }
  }

  /**
   * Check if voter has voted
   */
  async hasVoted(kv: number): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.hasVoted(kv);
    } catch (error: any) {
      console.error('Error checking vote status:', error);
      throw error;
    }
  }

  /**
   * Get vote hash for a registration index
   */
  async getVoteHash(kv: number): Promise<string> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const hash = await this.contract.getVoteHash(kv);
      return hash;
    } catch (error: any) {
      console.error('Error fetching vote hash:', error);
      throw error;
    }
  }

  /**
   * Check election status and configuration
   */
  async getElectionStatus(): Promise<any> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Try to get current election info
      const currentElection = await this.contract.currentElection();
      console.log('Current Election:', currentElection);
      return currentElection;
    } catch (error: any) {
      console.error('Error fetching election status:', error);
      throw error;
    }
  }
}
