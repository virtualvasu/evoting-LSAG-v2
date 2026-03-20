'use client';

import { useState, useEffect, useRef } from 'react';
import { BlockchainService } from '@/lib/blockchain-utils';
import { generateLSAGSignatureForVoter, LSAGSignatureResult } from '@/lib/lsag-utils';
import { getAllKeyPairs, StoredKeyPair } from '@/lib/key-storage-service';
import { decryptPrivateKey, verifyPassword } from '@/lib/key-encryption-service';

export default function GenerateLSAGSignature() {
  const [originalPrivateKey, setOriginalPrivateKey] = useState('');
  const [registeredPublicKey, setRegisteredPublicKey] = useState('');
  const [voterName, setVoterName] = useState('');
  const [sid, setSid] = useState('');
  const [electionId, setElectionId] = useState('election_001');
  const [contractAddress, setContractAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');

  // Key storage state
  const [storedKeys, setStoredKeys] = useState<StoredKeyPair[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [keyUnlocked, setKeyUnlocked] = useState(false);
  const unlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load RPC URL from config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/contract-config.json');
        const config = await response.json();
        setRpcUrl(config.rpcUrl);
      } catch (error) {
        console.error('Failed to load config:', error);
        setRpcUrl('http://10.10.0.61:8550'); // fallback
      }
    };
    loadConfig();
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [result, setResult] = useState<LSAGSignatureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PKS Key encryption state
  const [showPKSPasswordSetup, setShowPKSPasswordSetup] = useState(false);
  const [pksPassword, setPksPassword] = useState('');
  const [pksPasswordConfirm, setPksPasswordConfirm] = useState('');
  const [pksPasswordError, setPksPasswordError] = useState('');
  const [isPKSSaving, setIsPKSSaving] = useState(false);
  const [pksKeysSaved, setPksKeysSaved] = useState(false);

  // Load stored keys on mount
  useEffect(() => {
    loadStoredKeys();
    loadContractConfig();
  }, []);

  // Auto-lock keys after 10 minutes of inactivity
  useEffect(() => {
    if (keyUnlocked) {
      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current);
      }
      unlockTimeoutRef.current = setTimeout(() => {
        lockKeys();
      }, 10 * 60 * 1000); // 10 minutes

      return () => {
        if (unlockTimeoutRef.current) {
          clearTimeout(unlockTimeoutRef.current);
        }
      };
    }
  }, [keyUnlocked]);

  const loadStoredKeys = async () => {
    try {
      const keys = await getAllKeyPairs();
      setStoredKeys(keys);
      if (keys.length > 0) {
        setSelectedKeyId(keys[0].id);
      }
    } catch (error) {
      console.error('Failed to load stored keys:', error);
      setError('Failed to load stored keys');
    }
  };

  const loadContractConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch('/api/contract');
      if (!response.ok) {
        throw new Error('Failed to load contract config');
      }
      const config = await response.json();
      setContractAddress(config.contractAddress);
      setRpcUrl(config.rpcUrl || 'http://10.10.0.61:8550');
    } catch (err) {
      setError('Failed to load contract config: ' + (err as Error).message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleUnlockKey = async () => {
    if (!selectedKeyId || !unlockPassword) {
      setUnlockError('Please select a key and enter password');
      return;
    }

    const selectedKey = storedKeys.find((k) => k.id === selectedKeyId);
    if (!selectedKey) {
      setUnlockError('Selected key not found');
      return;
    }

    setIsUnlocking(true);
    setUnlockError('');

    try {
      // Verify password
      const isValid = await verifyPassword(selectedKey.encryptedPrivateKey, unlockPassword);
      if (!isValid) {
        setUnlockError('Incorrect password');
        setIsUnlocking(false);
        return;
      }

      // Decrypt private key
      const decryptedPrivateKey = await decryptPrivateKey(selectedKey.encryptedPrivateKey, unlockPassword);

      // Set keys
      setOriginalPrivateKey(decryptedPrivateKey);
      setRegisteredPublicKey(selectedKey.publicKey);
      setKeyUnlocked(true);
      setShowUnlockModal(false);
      setUnlockPassword('');
    } catch (err) {
      setUnlockError('Failed to decrypt key: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const lockKeys = () => {
    setOriginalPrivateKey('');
    setRegisteredPublicKey('');
    setKeyUnlocked(false);
    setUnlockPassword('');
    setUnlockError('');
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
  };

  const validatePKSPassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain number';
    if (!/[!@#$%^&*]/.test(pwd)) return 'Password must contain special character (!@#$%^&*)';
    return null;
  };

  const handleSavePKSKeys = async () => {
    setPksPasswordError('');

    if (pksPassword !== pksPasswordConfirm) {
      setPksPasswordError('Passwords do not match');
      return;
    }

    const pwdError = validatePKSPassword(pksPassword);
    if (pwdError) {
      setPksPasswordError(pwdError);
      return;
    }

    if (!result) return;

    setIsPKSSaving(true);
    try {
      const { encryptPrivateKey } = await import('@/lib/key-encryption-service');
      const { saveKeyPair } = await import('@/lib/key-storage-service');

      // Create synthetic KeyPair object for PKS keys
      const pksKeyPair = {
        privateKey: result.newPrivateKey,
        publicKey: result.newPublicKey,
        publicKeyX: result.newPublicKey.substring(0, 66), // First 33 bytes (hex)
        publicKeyY: result.newPublicKey.substring(66), // Last 33 bytes (hex)
      };

      // Encrypt private key
      const encryptedPrivateKey = await encryptPrivateKey(result.newPrivateKey, pksPassword);

      // Save to IndexedDB as voting key
      await saveKeyPair(pksKeyPair, encryptedPrivateKey, 'voting', `Voting Key (${new Date().toLocaleDateString()})`);

      // Reset form and mark as saved
      setPksKeysSaved(true);
      setPksPassword('');
      setPksPasswordConfirm('');
      setShowPKSPasswordSetup(false);

      // Reload keys list
      await loadStoredKeys();
    } catch (error) {
      console.error('Error saving PKS keys:', error);
      setPksPasswordError(`Failed to save keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPKSSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!originalPrivateKey || !registeredPublicKey || !voterName || !sid) {
      setError('Please fill in all required fields');
      return;
    }

    if (!contractAddress) {
      setError('Contract address not loaded');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Connect to blockchain and fetch voter ring
      const blockchain = new BlockchainService(contractAddress, rpcUrl);
      await blockchain.connectReadOnly();
      
      const voterRing = await blockchain.getVoterRing();
      
      if (voterRing.length === 0) {
        throw new Error('Voter ring is empty. Please register voters first.');
      }

      // Get registered public keys (not hashes)
      const registeredPubKeys = await blockchain.getRegisteredPublicKeys();

      // Generate LSAG signature
      const signature = await generateLSAGSignatureForVoter(
        originalPrivateKey,
        registeredPublicKey,
        voterName,
        sid,
        registeredPubKeys,
        electionId
      );

      setResult(signature);
    } catch (err) {
      setError('Failed to generate LSAG signature: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadResult = () => {
    if (!result) return;
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LSAG_${result.sid}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  if (isLoadingConfig) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-center text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Generate LSAG Signature</h2>
        <p className="text-gray-600 mb-6">
          Generate a Linkable Spontaneous Anonymous Group (LSAG) signature for voter registration.
        </p>

        {!result ? (
          <div className="space-y-6">
            {/* Contract Configuration Display */}
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Blockchain Configuration</h3>
                <span className="text-xs bg-blue-600 text-black px-2 py-1 rounded">Auto-loaded</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Address</label>
                  <div className="w-full px-3 py-2 bg-white border border-blue-300 rounded text-sm font-mono text-gray-800">
                    {contractAddress || 'Not configured'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RPC URL</label>
                  <div className="w-full px-3 py-2 bg-white border border-blue-300 rounded text-sm font-mono text-gray-800">
                    {rpcUrl}
                  </div>
                </div>
              </div>
            </div>

            {/* Voter Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Voter Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voter Name *
                </label>
                <input
                  type="text"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voter SID/ID *
                </label>
                <input
                  type="text"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  placeholder="12345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Election ID
                </label>
                <input
                  type="text"
                  value={electionId}
                  onChange={(e) => setElectionId(e.target.value)}
                  placeholder="election_001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Keys */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Stored Registration Keys</h3>
              
              {storedKeys.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    No stored keys found. Please generate and encrypt keys first in the "Generate Key Pair" section.
                  </p>
                </div>
              ) : (
                <>
                  {/* Key Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Key</label>
                    <select
                      value={selectedKeyId || ''}
                      onChange={(e) => {
                        setSelectedKeyId(e.target.value);
                        if (keyUnlocked) {
                          lockKeys();
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                    >
                      {storedKeys.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.label} - Created: {new Date(key.createdAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Key Details */}
                  {selectedKeyId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium text-blue-900 mb-2">Public Key:</p>
                        <p className="text-xs font-mono text-blue-800 bg-white p-2 rounded break-all">
                          {storedKeys.find((k) => k.id === selectedKeyId)?.publicKey}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 mb-2">Status:</p>
                        <div className="flex items-center gap-2">
                          {keyUnlocked ? (
                            <>
                              <span className="inline-block w-3 h-3 bg-green-600 rounded-full"></span>
                              <span className="text-sm text-green-700 font-semibold">🔓 UNLOCKED</span>
                              <button
                                onClick={lockKeys}
                                className="ml-auto text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                              >
                                Lock Now
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="inline-block w-3 h-3 bg-yellow-600 rounded-full"></span>
                              <span className="text-sm text-yellow-700 font-semibold">🔒 LOCKED</span>
                              <button
                                onClick={() => setShowUnlockModal(true)}
                                className="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                              >
                                Unlock
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isProcessing || !keyUnlocked}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isProcessing ? 'Generating LSAG Signature...' : keyUnlocked ? 'Generate LSAG Signature' : 'Unlock Key First to Generate'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-green-900">LSAG Signature Generated Successfully!</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Signature Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Voter Name:</span>
                  <p className="text-gray-900">{result.voterName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">SID:</span>
                  <p className="text-gray-900">{result.sid}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Election ID:</span>
                  <p className="text-gray-900">{result.electionId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ring Size:</span>
                  <p className="text-gray-900">{result.lsagSignature.s.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-purple-900">New PKS Key Pair</h3>
                {!pksKeysSaved ? (
                  <button
                    onClick={() => setShowPKSPasswordSetup(true)}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-semibold"
                  >
                    🔒 Secure Keys
                  </button>
                ) : (
                  <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded font-semibold">✓ Secured</span>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-purple-900">Public Key:</span>
                  <p className="text-xs font-mono text-purple-800 bg-white p-2 rounded break-all mt-1">
                    {result.newPublicKey}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-purple-900">Private Key {pksKeysSaved ? '(✓ Encrypted & Secured)' : '(⚠️ Not yet secured)'}:</span>
                  <p className="text-xs font-mono text-purple-800 bg-white p-2 rounded break-all mt-1">
                    {pksKeysSaved ? '••••••••••••••••••••••••••••••••••••••••••' : result.newPrivateKey}
                  </p>
                  {!pksKeysSaved && (
                    <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 p-2 rounded">
                      ⚠️ <strong>Important:</strong> Click "Secure Keys" to encrypt and save these keys. You'll need them for voting!
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">LSAG Signature</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-gray-700">Key Image X:</span>
                  <p className="font-mono text-gray-800 bg-white p-2 rounded break-all mt-1">
                    {result.lsagSignature.keyImageX}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Key Image Y:</span>
                  <p className="font-mono text-gray-800 bg-white p-2 rounded break-all mt-1">
                    {result.lsagSignature.keyImageY}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Challenge c:</span>
                  <p className="font-mono text-gray-800 bg-white p-2 rounded break-all mt-1">
                    {result.lsagSignature.c}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Responses (s values): {result.lsagSignature.s.length}</span>
                  <div className="max-h-32 overflow-y-auto mt-1 space-y-1">
                    {result.lsagSignature.s.map((s, idx) => (
                      <p key={idx} className="font-mono text-gray-800 bg-white p-1 rounded text-xs">
                        [{idx}] {s}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownloadResult}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-lg border border-slate-300 transition-colors"
              >
                Download Signature as JSON
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-black rounded-lg"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-6">
            <div className="flex">
              <svg className="h-6 w-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-6">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">What does this do?</h3>
          <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
            <li>Generates a new key pair for voting (PKS keys)</li>
            <li>Creates an LSAG signature proving you&apos;re in the voter ring</li>
            <li>Uses your original private key for the signature</li>
            <li>The signature is linkable (prevents double voting) but anonymous</li>
            <li>Download and save the result - you&apos;ll need it for voting</li>
          </ul>
        </div>
      </div>
      
      {/* PKS Key Password Setup Modal */}
      {showPKSPasswordSetup && result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 my-8">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.657 14.243a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM11 17a1 1 0 102 0v-1a1 1 0 10-2 0v1zM5.757 15.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM4 11a1 1 0 01 1 1h1a1 1 0 110-2H5a1 1 0 00-1 1zM5.757 5.757a1 1 0 000-1.414L5.05 3.636a1 1 0 10-1.414 1.414l.707.707z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Secure Your Voting Keys</h3>
            </div>

            <p className="text-sm text-gray-600">
              These PKS keys will be used for voting. Create a password to securely encrypt and store them.
            </p>

            {/* Info Box */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-900">
                <strong>Why?</strong> These keys will be stored encrypted on your device. You'll unlock them with this password when voting.
              </p>
            </div>

            {/* Password Strength Requirements */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-3">Password Requirements:</p>
              <div className="space-y-2">
                {[
                  { regex: /.{8,}/, text: 'At least 8 characters' },
                  { regex: /[A-Z]/, text: 'One uppercase letter' },
                  { regex: /[a-z]/, text: 'One lowercase letter' },
                  { regex: /[0-9]/, text: 'One number' },
                  { regex: /[!@#$%^&*]/, text: 'One special character (!@#$%^&*)' },
                ].map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 ${pksPassword && req.regex.test(pksPassword) ? 'text-green-600' : 'text-gray-400'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-blue-900">{req.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Password Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter Password</label>
                <input
                  type="password"
                  value={pksPassword}
                  onChange={(e) => {
                    setPksPassword(e.target.value);
                    setPksPasswordError('');
                  }}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={pksPasswordConfirm}
                  onChange={(e) => {
                    setPksPasswordConfirm(e.target.value);
                    setPksPasswordError('');
                  }}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {pksPasswordError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {pksPasswordError}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowPKSPasswordSetup(false);
                  setPksPassword('');
                  setPksPasswordConfirm('');
                  setPksPasswordError('');
                }}
                disabled={isPKSSaving}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Skip for Now
              </button>
              <button
                onClick={handleSavePKSKeys}
                disabled={isPKSSaving || !pksPassword || !pksPasswordConfirm}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isPKSSaving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Secure Keys
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Password Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Unlock Your Encryption Key</h3>
            </div>

            <p className="text-sm text-gray-600">
              Enter the password you created when generating your keys to unlock and use them for LSAG generation.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Encryption Password</label>
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => {
                  setUnlockPassword(e.target.value);
                  setUnlockError('');
                }}
                placeholder="Enter your password"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlockKey();
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {unlockError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {unlockError}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockPassword('');
                  setUnlockError('');
                }}
                disabled={isUnlocking}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlockKey}
                disabled={isUnlocking || !unlockPassword}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isUnlocking ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Unlocking...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                    Unlock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}    </div>
  );
}
