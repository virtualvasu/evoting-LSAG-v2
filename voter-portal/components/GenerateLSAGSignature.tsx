'use client';

import { useState, useEffect } from 'react';
import { BlockchainService } from '@/lib/blockchain-utils';
import { generateLSAGSignatureForVoter, LSAGSignatureResult } from '@/lib/lsag-utils';

export default function GenerateLSAGSignature() {
  const [originalPrivateKey, setOriginalPrivateKey] = useState('');
  const [registeredPublicKey, setRegisteredPublicKey] = useState('');
  const [voterName, setVoterName] = useState('');
  const [sid, setSid] = useState('');
  const [electionId, setElectionId] = useState('election_001');
  const [contractAddress, setContractAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');

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

  // Load deployment configuration on mount
  useEffect(() => {
    loadContractConfig();
  }, []);

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
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Auto-loaded</span>
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
              <h3 className="font-semibold text-gray-800">Keys</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Private Key * (from key generation step)
                </label>
                <input
                  type="password"
                  value={originalPrivateKey}
                  onChange={(e) => setOriginalPrivateKey(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Keep this secure! It&apos;s used for signing.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registered Public Key * (the one you registered in voter ring)
                </label>
                <input
                  type="text"
                  value={registeredPublicKey}
                  onChange={(e) => setRegisteredPublicKey(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isProcessing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isProcessing ? 'Generating LSAG Signature...' : 'Generate LSAG Signature'}
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
              <h3 className="font-semibold text-purple-900">New PKS Key Pair</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-purple-900">Public Key:</span>
                  <p className="text-xs font-mono text-purple-800 bg-white p-2 rounded break-all mt-1">
                    {result.newPublicKey}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-purple-900">Private Key (Keep Secure!):</span>
                  <p className="text-xs font-mono text-purple-800 bg-white p-2 rounded break-all mt-1">
                    {result.newPrivateKey}
                  </p>
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
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Download Signature as JSON
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
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
    </div>
  );
}
