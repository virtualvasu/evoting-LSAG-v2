// Shared utility functions for both voter and government portals
import { ethers } from 'ethers';
import { NETWORKS, ERROR_MESSAGES, CANDIDATES } from '../constants';
import type { 
  KeyPair, 
  VoterCertificate, 
  NetworkConfig, 
  WalletConnection,
  ValidationError,
  TransactionResult 
} from '../types';

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

/**
 * Network and wallet utilities
 */
export class NetworkUtils {
  static getNetworkConfig(networkName: 'iitbh' | 'localhost'): NetworkConfig {
    return NETWORKS[networkName];
  }

  static async connectWallet(): Promise<WalletConnection> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(accounts[0]);

      return {
        isConnected: true,
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        balance: ethers.formatEther(balance)
      };
    } catch (error) {
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async switchToNetwork(networkConfig: NetworkConfig): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        return false;
      }

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }]
      });
      
      return true;
    } catch (error: any) {
      // If network doesn't exist, add it
      if (error.code === 4902) {
        return await NetworkUtils.addNetwork(networkConfig);
      }
      return false;
    }
  }

  static async addNetwork(networkConfig: NetworkConfig): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        return false;
      }

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${networkConfig.chainId.toString(16)}`,
          chainName: networkConfig.name,
          rpcUrls: [networkConfig.rpc],
          nativeCurrency: {
            name: networkConfig.currency,
            symbol: networkConfig.currency,
            decimals: 18
          }
        }]
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * File handling utilities
 */
export class FileUtils {
  static downloadJSON(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async uploadJSON<T>(file: File): Promise<T> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static validateFileType(file: File, expectedExtension: string): boolean {
    return file.name.toLowerCase().endsWith(expectedExtension.toLowerCase());
  }

  static generateTimestamp(): string {
    return new Date().toISOString();
  }

  static generateFilename(prefix: string, extension: string): string {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}${extension}`;
  }
}

/**
 * Cryptographic utilities
 */
export class CryptoUtils {
  static isValidPrivateKey(key: string): boolean {
    try {
      return key.startsWith('0x') && key.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(key);
    } catch {
      return false;
    }
  }

  static isValidPublicKey(key: string): boolean {
    try {
      return key.startsWith('0x') && key.length === 130 && /^0x[0-9a-fA-F]{128}$/.test(key);
    } catch {
      return false;
    }
  }

  static isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  static formatAddress(address: string): string {
    if (!ethers.isAddress(address)) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  static generateSecureRandomBytes(length: number = 32): Uint8Array {
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto.getRandomValues(new Uint8Array(length));
    } else {
      // Node.js environment
      return require('crypto').randomBytes(length);
    }
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  static validateKeyPair(keyPair: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!keyPair.privateKey) {
      errors.push({ field: 'privateKey', message: 'Private key is required' });
    } else if (!CryptoUtils.isValidPrivateKey(keyPair.privateKey)) {
      errors.push({ field: 'privateKey', message: 'Invalid private key format' });
    }

    if (!keyPair.publicKey) {
      errors.push({ field: 'publicKey', message: 'Public key is required' });
    } else if (!CryptoUtils.isValidPublicKey(keyPair.publicKey)) {
      errors.push({ field: 'publicKey', message: 'Invalid public key format' });
    }

    return errors;
  }

  static validateVoterCertificate(certificate: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!certificate.voterName?.trim()) {
      errors.push({ field: 'voterName', message: 'Voter name is required' });
    }

    if (!certificate.sid?.trim()) {
      errors.push({ field: 'sid', message: 'Student ID is required' });
    }

    if (!certificate.voterPublicKey) {
      errors.push({ field: 'voterPublicKey', message: 'Voter public key is required' });
    } else if (!CryptoUtils.isValidPublicKey(certificate.voterPublicKey)) {
      errors.push({ field: 'voterPublicKey', message: 'Invalid voter public key format' });
    }

    if (!certificate.signature) {
      errors.push({ field: 'signature', message: 'Government signature is required' });
    }

    if (!certificate.governmentPublicKey) {
      errors.push({ field: 'governmentPublicKey', message: 'Government public key is required' });
    }

    return errors;
  }

  static validateCandidate(candidate: string): boolean {
    return CANDIDATES.includes(candidate as any);
  }

  static validateElectionId(electionId: any): boolean {
    return Number.isInteger(electionId) && electionId >= 0;
  }
}

/**
 * Local storage utilities
 */
export class StorageUtils {
  static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  static parseBlockchainError(error: any): string {
    if (error?.reason) {
      return error.reason;
    }
    
    if (error?.message) {
      // Parse common error patterns
      if (error.message.includes('user rejected')) {
        return 'Transaction was rejected by user';
      }
      if (error.message.includes('insufficient funds')) {
        return 'Insufficient funds for gas';
      }
      if (error.message.includes('nonce too high')) {
        return 'Transaction nonce error. Please reset MetaMask account.';
      }
      return error.message;
    }

    return 'An unknown error occurred';
  }

  static isNetworkError(error: any): boolean {
    return error?.code === 'NETWORK_ERROR' || 
           error?.message?.includes('network') ||
           error?.message?.includes('connection');
  }

  static createErrorResponse(message: string, code?: string): { success: false; error: string; code?: string } {
    return { success: false, error: message, code };
  }
}

/**
 * Format utilities
 */
export class FormatUtils {
  static formatTimestamp(timestamp: string | number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  static formatGasUsed(gasUsed: number): string {
    return gasUsed.toLocaleString();
  }

  static formatElectionPhase(phase: number): string {
    const phases = ['Setup', 'Registration', 'Voting', 'Tallying', 'Completed'];
    return phases[phase] || 'Unknown';
  }

  static formatCandidateResults(results: number[]): Array<{candidate: string, votes: number}> {
    return CANDIDATES.map((candidate, index) => ({
      candidate,
      votes: results[index] || 0
    }));
  }
}