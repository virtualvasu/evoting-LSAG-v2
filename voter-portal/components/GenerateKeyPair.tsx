'use client';

import { useState, useEffect } from 'react';
import { generateKeyPair, KeyPair } from '@/lib/keypair-utils';
import { encryptPrivateKey } from '@/lib/key-encryption-service';
import { saveKeyPair, getAllKeyPairs, StoredKeyPair } from '@/lib/key-storage-service';

export default function GenerateKeyPair() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [storedKeys, setStoredKeys] = useState<StoredKeyPair[]>([]);
  const [passwordError, setPasswordError] = useState('');

  // Load stored keys on mount
  useEffect(() => {
    loadStoredKeys();
  }, []);

  const loadStoredKeys = async () => {
    try {
      const keys = await getAllKeyPairs();
      setStoredKeys(keys);
    } catch (error) {
      console.error('Failed to load stored keys:', error);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain number';
    if (!/[!@#$%^&*]/.test(pwd)) return 'Password must contain special character (!@#$%^&*)';
    return null;
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setPasswordError('');
    try {
      const newKeyPair = generateKeyPair();
      setKeyPair(newKeyPair);
      setShowPasswordSetup(true);
      setPassword('');
      setPasswordConfirm('');
    } catch (error) {
      console.error('Error generating key pair:', error);
      alert('Failed to generate key pair. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWithPassword = async () => {
    setPasswordError('');

    // Validate passwords match
    if (password !== passwordConfirm) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Validate password strength
    const pwdError = validatePassword(password);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    if (!keyPair) return;

    setIsSaving(true);
    try {
      // Encrypt private key
      const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, password);

      // Save to IndexedDB
      const storedKey = await saveKeyPair(keyPair, encryptedPrivateKey, 'registration', 'Registration Key');

      // Refresh stored keys list
      await loadStoredKeys();

      // Reset form
      setKeyPair(null);
      setShowPasswordSetup(false);
      setPassword('');
      setPasswordConfirm('');

      alert('✓ Keys encrypted and saved successfully!');
    } catch (error) {
      console.error('Error saving encrypted keys:', error);
      alert(`Failed to save keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = () => {
    if (!keyPair) return;
    
    const data = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyX: keyPair.publicKeyX,
      publicKeyY: keyPair.publicKeyY,
      generatedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keypair-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generate Cryptographic Keypair</h1>
              <p className="text-gray-600 mt-1">Phase 1: Create your secure voting identity</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="card p-8 mb-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Create Your Voting Keys</h2>
            <p className="text-gray-600 mb-6">
              Generate a secp256k1 key pair that will be used for cryptographic operations throughout the voting process. Your private key is generated locally and should be kept secure - it will never be transmitted to any server.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Generated Locally</p>
                  <p className="text-sm text-gray-600">All key generation happens in your browser</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Cryptographically Secure</p>
                  <p className="text-sm text-gray-600">Uses secp256k1 ECDSA encryption</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Generating Keys...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate New Keypair
                </>
              )}
            </button>
          </div>

          {/* Stored Keys Section */}
          {storedKeys.length > 0 && (
            <div className="mb-10 pb-10 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
                Your Stored Keys
              </h2>

              <div className="space-y-3">
                {storedKeys.map((storedKey) => (
                  <div key={storedKey.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-200 rounded-lg">
                          <svg className="w-5 h-5 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{storedKey.label}</h3>
                          <p className="text-xs text-gray-600">Created: {new Date(storedKey.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${storedKey.isLocked ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {storedKey.isLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 bg-white bg-opacity-50 p-2 rounded border border-green-100 break-all font-mono">
                      Public Key: {storedKey.publicKey}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {keyPair && !showPasswordSetup && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-t border-gray-200 pt-6">
                {/* Security Warning */}
                <div className="alert alert-warning mb-6">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold mb-1">Important Security Notice</p>
                    <p className="text-sm">Save your keys securely. You'll need the private key for signing operations and the public key for registration. Never share your private key with anyone.</p>
                  </div>
                </div>

                {/* Key Display Cards */}
                <div className="space-y-4 mb-6">
                  {/* Private Key */}
                  <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                    <div className="bg-red-100 px-4 py-3 border-b border-red-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Private Key (KEEP SECRET)
                      </h3>
                      <button
                        onClick={() => handleCopy(keyPair.privateKey, 'private')}
                        className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                          copied === 'private'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {copied === 'private' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-mono break-all text-red-900 bg-white p-3 rounded border border-red-200">
                        {keyPair.privateKey}
                      </p>
                    </div>
                  </div>

                  {/* Public Key */}
                  <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                    <div className="bg-green-100 px-4 py-3 border-b border-green-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-green-900 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                        Public Key (64 bytes)
                      </h3>
                      <button
                        onClick={() => handleCopy(keyPair.publicKey, 'public')}
                        className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                          copied === 'public'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {copied === 'public' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-mono break-all text-green-900 bg-white p-3 rounded border border-green-200">
                        {keyPair.publicKey}
                      </p>
                      <p className="text-xs text-green-700 mt-3 bg-green-100 p-2 rounded">
                        💡 Use this value exactly as-is in the Government Portal. Do not add any prefix or suffix.
                      </p>
                    </div>
                  </div>

                  {/* Public Key X */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-100 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-blue-900">Public Key X Coordinate</h3>
                      <button
                        onClick={() => handleCopy(keyPair.publicKeyX, 'x')}
                        className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                          copied === 'x'
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {copied === 'x' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-mono break-all text-blue-900 bg-white p-3 rounded border border-blue-200">
                        {keyPair.publicKeyX}
                      </p>
                    </div>
                  </div>

                  {/* Public Key Y */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                    <div className="bg-purple-100 px-4 py-3 border-b border-purple-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-purple-900">Public Key Y Coordinate</h3>
                      <button
                        onClick={() => handleCopy(keyPair.publicKeyY, 'y')}
                        className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${
                          copied === 'y'
                            ? 'bg-green-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {copied === 'y' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-mono break-all text-purple-900 bg-white p-3 rounded border border-purple-200">
                        {keyPair.publicKeyY}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-4 rounded-lg border border-slate-300 transition-all duration-300 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0 0l-3 3m3-3l3 3M4 12a8 8 0 1116 0 8 8 0 01-16 0z" />
                    </svg>
                    Download as JSON
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 hover:shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Generate New Pair
                  </button>
                </div>

                {/* Usage Guide */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Next Steps:</h3>
                  <ol className="text-sm text-gray-700 space-y-2">
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">1.</span>
                      <span>Create an encryption password to protect your private key</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">2.</span>
                      <span>Your keys will be encrypted and stored securely on this device</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-semibold text-blue-600 flex-shrink-0">3.</span>
                      <span>Use your password to unlock keys when needed for voting</span>
                    </li>
                  </ol>
                </div>

                {/* Save Keys Button */}
                <button
                  onClick={() => setShowPasswordSetup(true)}
                  className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                  </svg>
                  Encrypt & Save Keys
                </button>
              </div>
            </div>
          )}

          {/* Password Setup Form */}
          {keyPair && showPasswordSetup && (
            <div className="border-t border-gray-200 pt-6 animate-fadeIn">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Create Encryption Password
                </h3>

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-900 mb-3">
                    <strong>This password will:</strong>
                  </p>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    <li>Encrypt your private key for secure storage</li>
                    <li>Be required to unlock and use your keys during voting</li>
                    <li>NOT be stored or transmitted anywhere</li>
                    <li>Make your key unrecoverable if forgotten</li>
                  </ul>
                </div>

                {/* Password Input Fields */}
                <div className="space-y-4">
                  {/* Password Strength Requirements */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
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
                            className={`w-4 h-4 ${
                              password && req.regex.test(password) ? 'text-green-600' : 'text-gray-400'
                            }`}
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

                  {/* Password Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Enter Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Enter a strong password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Confirm Password Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => {
                        setPasswordConfirm(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Re-enter your password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Error Message */}
                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800 flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {passwordError}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowPasswordSetup(false);
                    setPassword('');
                    setPasswordConfirm('');
                    setPasswordError('');
                  }}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveWithPassword}
                  disabled={isSaving || !password || !passwordConfirm}
                  className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Encrypting & Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Save Encrypted Keys
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Card */}
        {!keyPair && (
          <div className="card p-6 border-l-4 border-blue-500">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">What is a Keypair?</h3>
                <p className="text-gray-600 text-sm mb-4">
                  A cryptographic keypair consists of a private key (secret) and public key (shareable). Your private key will be used to sign anonymous voting data, while your public key will be registered in the voter ring.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li><strong>Private Key:</strong> Used for signing LSAG signatures (keep secret)</li>
                  <li><strong>Public Key:</strong> Used for blockchain registration and verification</li>
                  <li><strong>Key Security:</strong> Keys are generated locally and never transmitted</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
