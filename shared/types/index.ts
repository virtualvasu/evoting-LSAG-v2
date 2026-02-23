// Common TypeScript types used across voter and government portals

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyX: string;
  publicKeyY: string;
  generatedAt: string;
}

export interface VoterCertificate {
  voterName: string;
  sid: string;
  voterPublicKey: string;
  signature: string;
  governmentPublicKey: string;
  timestamp?: string;
}

export interface LSAGSignature {
  keyImageX: string;
  keyImageY: string;
  c: string;
  s: string[];
}

export interface LSAGRegistration {
  voterName: string;
  sid: string;
  electionId: number;
  newPublicKey: string;
  newPublicKeyX: string;
  newPublicKeyY: string;
  lsagSignature: LSAGSignature;
  timestamp: string;
}

export interface VoteData {
  voterIndex: number;
  candidateChoice: 'A' | 'B' | 'C' | 'D' | 'E';
  hashedVote: string;
  revealValue: string;
  timestamp: string;
  newPrivateKey: string;
}

export interface ElectionStatus {
  phase: number;
  voterCount: number;
  registeredVoters: number;
  votesCount: number;
  results: number[];
  isActive: boolean;
}

export interface NetworkConfig {
  name: string;
  rpc: string;
  chainId: number;
  currency: string;
  contractAddress: string;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: number;
}

export interface WalletConnection {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  balance?: string;
}

// Government portal specific types
export interface GovernmentConfig {
  privateKey: string;
  publicKey: string;
  authorityName: string;
  electionId: number;
}

export interface VoterRingMember {
  index: number;
  publicKeyX: string;
  publicKeyY: string;
  isRegistered: boolean;
  voterName?: string;
  sid?: string;
}

// Voter portal specific types  
export interface RegistrationStatus {
  hasCertificate: boolean;
  isInRing: boolean;
  hasLSAGSignature: boolean;
  isRegistered: boolean;
  canVote: boolean;
}

export interface VotingSessionData {
  voterIndex: number;
  newPrivateKey: string;
  hasVoted: boolean;
  voteData?: VoteData;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface BlockchainError {
  code: number;
  message: string;
  reason?: string;
  transaction?: string;
}