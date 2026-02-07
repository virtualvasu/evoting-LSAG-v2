/**
 * Pre-Registration Service
 * Standalone implementation - no external script dependencies
 * Ported from scripts/pre_registration/pre-register-voter.js
 * 
 * This service handles:
 * - Voter details validation
 * - Government signature generation and verification
 * - Certificate creation and storage
 */

import { CryptoUtils } from './crypto-utils';
import fs from 'fs';
import path from 'path';

export interface VoterDetails {
  name: string;
  publicKey: string;
  studentId: string;
}

export interface Certificate {
  voterName: string;
  sid: string;
  voterPublicKey: string;
  signature: string;
  governmentPublicKey: string;
}

export interface GovernmentConfig {
  address: string;
  publicKey: string;
  privateKey: string;
  createdAt?: string;
}

export class PreRegistrationService {
  /**
   * Validate voter public key format
   * Must be 128 hex characters (64 bytes) representing uncompressed point
   */
  static validatePublicKey(publicKey: string): { isValid: boolean; cleanedKey?: string; error?: string } {
    if (!publicKey || typeof publicKey !== 'string') {
      return { isValid: false, error: 'Public key must be a string' };
    }

    let cleanedPubKey = publicKey.toLowerCase().replace(/^0x/, '');
    
    // Remove 04 prefix if present (uncompressed point indicator)
    if (cleanedPubKey.startsWith('04')) {
      cleanedPubKey = cleanedPubKey.slice(2);
    }
    
    if (cleanedPubKey.length !== 128) {
      return { 
        isValid: false, 
        error: `Invalid public key length. Expected 64 bytes (128 hex chars), got ${cleanedPubKey.length / 2} bytes` 
      };
    }

    // Verify all characters are valid hex
    if (!/^[0-9a-f]{128}$/.test(cleanedPubKey)) {
      return { isValid: false, error: 'Public key must contain only hexadecimal characters' };
    }

    return { isValid: true, cleanedKey: '0x' + cleanedPubKey };
  }

  /**
   * Validate voter details
   */
  static validateVoterDetails(details: Partial<VoterDetails>): { isValid: boolean; error?: string } {
    if (!details.name || typeof details.name !== 'string' || details.name.trim().length === 0) {
      return { isValid: false, error: 'Voter name must be a non-empty string' };
    }

    if (!details.studentId || typeof details.studentId !== 'string' || details.studentId.trim().length === 0) {
      return { isValid: false, error: 'Student ID must be a non-empty string' };
    }

    if (!details.publicKey || typeof details.publicKey !== 'string') {
      return { isValid: false, error: 'Public key is required' };
    }

    const pubKeyValidation = this.validatePublicKey(details.publicKey);
    if (!pubKeyValidation.isValid) {
      return { isValid: false, error: pubKeyValidation.error };
    }

    return { isValid: true };
  }

  /**
   * Load government configuration from file
   */
  static loadGovernmentConfig(configPath: string): GovernmentConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Government configuration not found at ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (!config.privateKey || !config.address || !config.publicKey) {
      throw new Error('Invalid government configuration. Missing required keys: privateKey, address, or publicKey');
    }

    return config as GovernmentConfig;
  }

  /**
   * Generate a signed certificate for a voter
   */
  static generateCertificate(
    voterDetails: VoterDetails,
    governmentConfig: GovernmentConfig
  ): { certificate: Certificate; signature: string } {
    // Validate voter details
    const validation = this.validateVoterDetails(voterDetails);
    if (!validation.isValid) {
      throw new Error(`Voter details validation failed: ${validation.error}`);
    }

    // Clean and validate public key
    const pubKeyValidation = this.validatePublicKey(voterDetails.publicKey);
    if (!pubKeyValidation.isValid || !pubKeyValidation.cleanedKey) {
      throw new Error(`Public key validation failed: ${pubKeyValidation.error}`);
    }

    const cleanedPubKey = pubKeyValidation.cleanedKey;
    const name = voterDetails.name.trim();
    const studentId = voterDetails.studentId.trim();

    // Generate signature
    // This implements the PKS signature: σ̃_v = PKS.sign({voterName, sid, publicKey}, P_rgov)
    const signature = CryptoUtils.signVoterCredentials(
      name,
      studentId,
      cleanedPubKey,
      governmentConfig.privateKey
    );

    // Verify the signature
    const isValid = CryptoUtils.verifySignature(
      name,
      studentId,
      cleanedPubKey,
      signature,
      governmentConfig.address
    );
    
    if (!isValid) {
      throw new Error('Signature verification failed. Certificate could not be generated.');
    }

    // Create certificate object (matching original script format)
    const certificate: Certificate = {
      voterName: name,
      sid: studentId,
      voterPublicKey: cleanedPubKey,
      signature: signature,
      governmentPublicKey: governmentConfig.publicKey
    };

    return { certificate, signature };
  }

  /**
   * Complete pre-registration flow (in-memory only - no file saving)
   * Returns the certificate data for display/download
   */
  static preRegisterVoter(
    voterDetails: VoterDetails,
    governmentConfigPath: string,
    certificateOutputDir?: string  // Made optional since we don't save files
  ): { certificate: Certificate; signature: string } {
    try {
      // Load government config
      const govConfig = this.loadGovernmentConfig(governmentConfigPath);

      // Generate signed certificate
      const { certificate, signature } = this.generateCertificate(voterDetails, govConfig);

      // Return certificate data (no file saving)
      return { certificate, signature };
    } catch (error) {
      throw new Error(`Pre-registration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save certificate to file (optional utility function)
   * Only called if user explicitly wants to save to project directory
   */
  static saveCertificateToFile(
    certificate: Certificate,
    outputDir: string
  ): string {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create certificate file with same naming convention as script
    const fileName = `CERT_${certificate.sid}.json`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(certificate, null, 2));

    return filePath;
  }
}
