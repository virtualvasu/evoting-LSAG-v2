// Network configuration constants for both portals
export const NETWORKS = {
  iitbh: {
    name: 'IITBH Blockchain',
    rpc: 'http://10.10.0.61:8550',
    chainId: 1337,
    currency: 'ETH',
    contractAddress: '0xED8CAB8a931A4C0489ad3E3FB5BdEA84f74fD23E'
  },
  localhost: {
    name: 'Localhost',
    rpc: 'http://localhost:8545', 
    chainId: 31337,
    currency: 'ETH',
    contractAddress: process.env.LOCALHOST_CONTRACT_ADDRESS || ''
  }
} as const;

// Election phases
export const ELECTION_PHASES = {
  SETUP: 0,
  REGISTRATION: 1,
  VOTING: 2,
  TALLYING: 3,
  COMPLETED: 4
} as const;

// Candidate options
export const CANDIDATES = ['A', 'B', 'C', 'D', 'E'] as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your MetaMask wallet',
  INVALID_NETWORK: 'Please switch to the correct network',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  INVALID_SIGNATURE: 'Invalid signature format',
  ELECTION_NOT_ACTIVE: 'Election is not in the correct phase',
  ALREADY_REGISTERED: 'You have already registered for this election',
  ALREADY_VOTED: 'You have already cast your vote',
  INVALID_CANDIDATE: 'Invalid candidate selection'
} as const;

// File types for uploads and downloads
export const FILE_TYPES = {
  KEYPAIR: '.json',
  CERTIFICATE: '.json',
  LSAG_SIGNATURE: '.json',
  VOTE_DATA: '.json'
} as const;