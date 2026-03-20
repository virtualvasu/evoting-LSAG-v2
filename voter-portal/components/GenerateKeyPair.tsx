'use client';

import { useState } from 'react';
import { generateKeyPair, KeyPair } from '@/lib/keypair-utils';

export default function GenerateKeyPair() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const newKeyPair = generateKeyPair();
      setKeyPair(newKeyPair);
    } catch (error) {
      console.error('Error generating key pair:', error);
      alert('Failed to generate key pair. Please try again.');
    } finally {
      setIsGenerating(false);
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
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Generate Key Pair</h2>
        <p className="text-gray-600 mb-6">
          Generate a new secp256k1 key pair for voting. Keep your private key secure!
        </p>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isGenerating ? 'Generating...' : 'Generate New Key Pair'}
        </button>

        {keyPair && (
          <div className="mt-6 space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> Save these values securely! You&apos;ll need the private key for signing and the public key for registration.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Private Key */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-red-900">Private Key (Keep Secret!)</h3>
                  <button
                    onClick={() => handleCopy(keyPair.privateKey, 'private')}
                    className="text-xs bg-red-600 hover:bg-red-700 text-black px-3 py-1 rounded"
                  >
                    {copied === 'private' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-red-800 bg-white p-2 rounded">
                  {keyPair.privateKey}
                </p>
              </div>

              {/* Public Key */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-green-900">Public Key (64 bytes, government-ready)</h3>
                  <button
                    onClick={() => handleCopy(keyPair.publicKey, 'public')}
                    className="text-xs bg-green-600 hover:bg-green-700 text-black px-3 py-1 rounded"
                  >
                    {copied === 'public' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-green-800 bg-white p-2 rounded">
                  {keyPair.publicKey}
                </p>
                <p className="text-xs text-green-700 mt-2">Use this value exactly as-is in Government Portal. Do not add an extra 04 prefix.</p>
              </div>

              {/* Public Key X */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-blue-900">Public Key X</h3>
                  <button
                    onClick={() => handleCopy(keyPair.publicKeyX, 'x')}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-black px-3 py-1 rounded"
                  >
                    {copied === 'x' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-blue-800 bg-white p-2 rounded">
                  {keyPair.publicKeyX}
                </p>
              </div>

              {/* Public Key Y */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-purple-900">Public Key Y</h3>
                  <button
                    onClick={() => handleCopy(keyPair.publicKeyY, 'y')}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-black px-3 py-1 rounded"
                  >
                    {copied === 'y' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-purple-800 bg-white p-2 rounded">
                  {keyPair.publicKeyY}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleDownload}
                className="w-full bg-gray-800 hover:bg-gray-900 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Download Key Pair as JSON
              </button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Usage:</h3>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Private Key: for signing LSAG signatures</li>
                <li>Public Key: for registration in the voter ring</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
