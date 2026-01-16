'use client';

import { useState, useEffect } from 'react';
import { BlockchainService, Certificate, UpdateRingResult } from '@/lib/blockchain-utils';

export default function UpdateVoterRing() {
  const [certificateInput, setCertificateInput] = useState('');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('http://localhost:8545');
  const [walletAddress, setWalletAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [result, setResult] = useState<UpdateRingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'connected' | 'result'>('input');

  // Load deployment configuration on mount
  useEffect(() => {
    loadDeploymentConfig();
  }, []);

  const loadDeploymentConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch('/api/contract');
      if (!response.ok) {
        throw new Error('Failed to load contract config');
      }
      const config = await response.json();
      setContractAddress(config.contractAddress);
      setRpcUrl(config.rpcUrl || 'http://localhost:8545');
    } catch (err) {
      setError('Failed to load contract config: ' + (err as Error).message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCertificateInput(content);
      try {
        const cert = JSON.parse(content);
        setCertificate(cert);
        setError(null);
      } catch (err) {
        setError('Invalid JSON format in certificate file');
      }
    };
    reader.readAsText(file);
  };

  const handleParseCertificate = () => {
    try {
      const cert = JSON.parse(certificateInput);
      
      // Validate required fields
      if (!cert.voterName || !cert.sid || !cert.voterPublicKey || 
          !cert.signature || !cert.governmentPublicKey) {
        throw new Error('Missing required fields in certificate');
      }
      
      setCertificate(cert);
      setError(null);
    } catch (err) {
      setError('Invalid certificate JSON: ' + (err as Error).message);
    }
  };

  const handleConnectWallet = async () => {
    if (!contractAddress) {
      setError('Please enter contract address');
      return;
    }

    if (!certificate) {
      setError('Please provide a valid certificate first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blockchain = new BlockchainService(contractAddress, rpcUrl);
      const address = await blockchain.connectWallet();
      setWalletAddress(address);
      setStep('connected');
    } catch (err) {
      setError('Failed to connect wallet: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!certificate || !contractAddress) {
      setError('Missing required information');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blockchain = new BlockchainService(contractAddress, rpcUrl);
      await blockchain.connectWallet();

      const updateResult = await blockchain.storePub(certificate);
      setResult(updateResult);
      setStep('result');
    } catch (err) {
      setError('Failed to update voter ring: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCertificateInput('');
    setCertificate(null);
    setResult(null);
    setError(null);
    setStep('input');
    setWalletAddress('');
  };

  const handleDownloadResult = () => {
    if (!result) return;
    
    const data = {
      ...result,
      certificate: certificate,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voter_ring_update_${result.sid}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Update Voter Ring</h2>
        <p className="text-gray-600 mb-6">
          Submit your government-issued certificate to register your public key in the voter ring on the blockchain.
        </p>

        {/* Loading State */}
        {isLoadingConfig && (
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-blue-800">Loading blockchain configuration...</p>
          </div>
        )}

        {/* Step 1: Certificate Input */}
        {!isLoadingConfig && step === 'input' && (
          <div className="space-y-6">
            {/* Contract Configuration - Display Only */}
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Blockchain Configuration</h3>
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Auto-loaded</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Address
                </label>
                <div className="w-full px-4 py-2 bg-white border border-blue-300 rounded-lg font-mono text-sm text-gray-800">
                  {contractAddress || 'Not configured'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RPC URL
                </label>
                <div className="w-full px-4 py-2 bg-white border border-blue-300 rounded-lg font-mono text-sm text-gray-800">
                  {rpcUrl}
                </div>
              </div>
            </div>

            {/* Certificate Input Options */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Certificate Input</h3>
              
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Certificate JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="text-center text-gray-500 font-semibold">OR</div>

              {/* Paste JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste Certificate JSON
                </label>
                <textarea
                  value={certificateInput}
                  onChange={(e) => setCertificateInput(e.target.value)}
                  placeholder='{"voterName": "...", "sid": "...", "voterPublicKey": "...", "signature": "...", "governmentPublicKey": "..."}'
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleParseCertificate}
                  disabled={!certificateInput}
                  className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg text-sm"
                >
                  Parse Certificate
                </button>
              </div>
            </div>

            {/* Certificate Preview */}
            {certificate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3">✓ Certificate Loaded</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-green-900">Voter Name:</span>{' '}
                    <span className="text-green-800">{certificate.voterName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">SID:</span>{' '}
                    <span className="text-green-800">{certificate.sid}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Public Key:</span>{' '}
                    <span className="text-green-800 font-mono text-xs break-all">
                      {certificate.voterPublicKey.substring(0, 30)}...
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Signature:</span>{' '}
                    <span className="text-green-800 font-mono text-xs break-all">
                      {certificate.signature.substring(0, 30)}...
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Government Public Key:</span>{' '}
                    <span className="text-green-800 font-mono text-xs break-all">
                      {certificate.governmentPublicKey.substring(0, 30)}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Connect Wallet Button */}
            <button
              onClick={handleConnectWallet}
              disabled={!certificate || !contractAddress || isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isProcessing ? 'Connecting...' : 'Connect Wallet & Proceed'}
            </button>
          </div>
        )}

        {/* Step 2: Connected - Submit to Blockchain */}
        {step === 'connected' && certificate && (
          <div className="space-y-6">
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-green-900">Wallet Connected</p>
                  <p className="text-sm text-green-800 font-mono">{walletAddress}</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> Make sure MetaMask is connected to the same network as your contract (usually Localhost 8545 for local development).
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Certificate to Submit</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Voter:</span> {certificate.voterName}</div>
                <div><span className="font-medium">SID:</span> {certificate.sid}</div>
                <div className="text-xs text-gray-600">
                  This will add your public key to the voter ring on the blockchain.
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {isProcessing ? 'Submitting to Blockchain...' : 'Submit to Blockchain'}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-green-900">Successfully Added to Voter Ring!</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Registration Details</h3>
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
                  <span className="font-medium text-gray-700">Ring Position:</span>
                  <p className="text-gray-900">{result.ringPosition}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ring Size:</span>
                  <p className="text-gray-900">{result.ringSize}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Transaction Hash:</span>
                <p className="text-xs font-mono text-blue-600 break-all">{result.transactionHash}</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Updated Voter Ring ({result.voterRing.length} voters)</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {result.voterRing.map((pubKeyHash, index) => (
                  <div
                    key={index}
                    className={`text-xs font-mono p-2 rounded ${
                      index.toString() === result.ringPosition
                        ? 'bg-green-100 border border-green-300 font-semibold'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <span className="text-gray-600">[{index}]</span> {pubKeyHash}
                    {index.toString() === result.ringPosition && (
                      <span className="ml-2 text-green-700">← You are here</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownloadResult}
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Download Result as JSON
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Register Another Voter
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4">
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">What does this do?</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Submits your government-issued certificate to the blockchain</li>
            <li>Adds your public key to the voter ring</li>
            <li>Your position in the ring is used for anonymous voting with LSAG signatures</li>
            <li>Requires MetaMask or another Web3 wallet</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Common Issues</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li><strong>Network mismatch:</strong> Make sure MetaMask is connected to Localhost 8545 (chainId: 31337)</li>
            <li><strong>Contract not found:</strong> Verify the contract address in contract-config.json</li>
            <li><strong>Wrong RPC:</strong> Check browser console for network errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
