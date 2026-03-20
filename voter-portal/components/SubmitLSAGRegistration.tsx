'use client';

import { useState, useEffect } from 'react';
import { BlockchainService } from '@/lib/blockchain-utils';
import type { LSAGSignatureResult } from '@/lib/lsag-utils';

interface RegistrationResult {
  voterName: string;
  sid: string;
  electionId: string;
  registrationIndex: string;
  newPublicKey: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  timestamp: string;
}

export default function SubmitLSAGRegistration() {
  const [lsagInput, setLsagInput] = useState('');
  const [lsagData, setLsagData] = useState<LSAGSignatureResult | null>(null);
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
  const [walletAddress, setWalletAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'connected' | 'result'>('input');
  
  // Phase checking state
  const [electionStatus, setElectionStatus] = useState<{
    electionId: string;
    isActive: boolean;
    phaseString: string;
    currentPhase: number;
    registeredVoters: string;
  } | null>(null);
  const [isCheckingPhase, setIsCheckingPhase] = useState(false);

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
      
      // Check election phase after loading config
      await checkElectionPhase(config.contractAddress, config.rpcUrl || 'http://10.10.0.61:8550');
    } catch (err) {
      setError('Failed to load contract config: ' + (err as Error).message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const checkElectionPhase = async (address?: string, rpc?: string) => {
    setIsCheckingPhase(true);
    try {
      const blockchain = new BlockchainService(
        address || contractAddress, 
        rpc || rpcUrl
      );
      await blockchain.connectReadOnly();
      
      const status = await blockchain.getElectionStatus();
      setElectionStatus({
        electionId: status.electionId,
        isActive: status.isActive,
        phaseString: status.phaseString,
        currentPhase: status.currentPhase,
        registeredVoters: status.registeredVoters.toString()
      });
      
      // Show warning if not in registration phase
      if (status.currentPhase !== 1) {
        setError(
          `Registration is currently NOT ACTIVE. Current phase: ${status.phaseString}. ` +
          `Please wait for the government authority to start the registration phase.`
        );
      }
    } catch (err) {
      console.error('Failed to check election phase:', err);
      setError('Warning: Could not verify election phase. ' + (err as Error).message);
    } finally {
      setIsCheckingPhase(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLsagInput(content);
      try {
        const data = JSON.parse(content);
        setLsagData(data);
        setError(null);
      } catch (err) {
        setError('Invalid JSON format in LSAG file');
      }
    };
    reader.readAsText(file);
  };

  const handleParseLSAG = () => {
    try {
      const data = JSON.parse(lsagInput);
      
      // Validate required fields
      if (!data.voterName || !data.sid || !data.electionId || 
          !data.newPublicKey || !data.lsagSignature) {
        throw new Error('Missing required fields in LSAG data');
      }
      
      setLsagData(data);
      setError(null);
    } catch (err) {
      setError('Invalid LSAG JSON: ' + (err as Error).message);
    }
  };

  const handleConnectWallet = async () => {
    if (!contractAddress) {
      setError('Contract address not loaded');
      return;
    }

    if (!lsagData) {
      setError('Please provide valid LSAG signature first');
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
    if (!lsagData || !contractAddress) {
      setError('Missing required information');
      return;
    }

    // Check if registration phase is active
    if (electionStatus && electionStatus.currentPhase !== 1) {
      setError(
        `Cannot register: Registration phase is not active. Current phase: ${electionStatus.phaseString}. ` +
        `Please wait for the government authority to start the registration phase.`
      );
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const blockchain = new BlockchainService(contractAddress, rpcUrl);
      await blockchain.connectWallet();

      // Double-check phase right before submitting
      const isRegistrationActive = await blockchain.isRegistrationPhaseActive();
      if (!isRegistrationActive) {
        throw new Error('Registration phase is not active. Please refresh and check the current phase.');
      }

      // Submit LSAG registration
      const registrationResult = await blockchain.submitLSAGRegistration(
        lsagData.electionIdHash || lsagData.electionId,
        lsagData.lsagSignature,
        lsagData.newPublicKey
      );

      const finalResult: RegistrationResult = {
        voterName: lsagData.voterName,
        sid: lsagData.sid,
        electionId: lsagData.electionId,
        registrationIndex: registrationResult.kv,
        newPublicKey: lsagData.newPublicKey,
        transactionHash: registrationResult.transactionHash,
        blockNumber: registrationResult.blockNumber,
        gasUsed: registrationResult.gasUsed,
        timestamp: new Date().toISOString()
      };

      setResult(finalResult);
      setStep('result');
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('Operation not allowed in current phase')) {
        setError('Registration failed: Registration phase is not active. The government authority needs to start the registration phase first.');
      } else {
        setError('Failed to submit LSAG registration: ' + errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setLsagInput('');
    setLsagData(null);
    setResult(null);
    setError(null);
    setStep('input');
    setWalletAddress('');
  };

  const handleDownloadResult = () => {
    if (!result) return;
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registration_result_${result.sid}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Submit LSAG Registration</h2>
        <p className="text-gray-600 mb-6">
          Submit your LSAG signature to the blockchain for BB.verify registration. This completes your voter registration.
        </p>

        {/* Step 1: LSAG Input */}
        {step === 'input' && (
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

            {/* Election Phase Status */}
            {electionStatus && (
              <div className={`p-4 rounded-lg border-l-4 ${
                electionStatus.currentPhase === 1 
                  ? 'bg-green-50 border-green-500' 
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Election Phase Status</h3>
                  <button
                    onClick={() => checkElectionPhase()}
                    disabled={isCheckingPhase}
                    className="text-xs bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-3 py-1 rounded"
                  >
                    {isCheckingPhase ? 'Checking...' : 'Refresh'}
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Election ID:</span>{' '}
                    <span className="text-gray-900">{electionStatus.electionId || 'None'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Election Active:</span>{' '}
                    <span className={electionStatus.isActive ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {electionStatus.isActive ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Current Phase:</span>{' '}
                    <span className={`font-semibold ${
                      electionStatus.currentPhase === 1 ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {electionStatus.phaseString}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Registered Voters:</span>{' '}
                    <span className="text-gray-900">{electionStatus.registeredVoters}</span>
                  </div>
                  {electionStatus.currentPhase === 1 && (
                    <div className="mt-2 p-2 bg-green-100 rounded text-green-800 font-medium">
                      ✓ Registration is ACTIVE - You can register now
                    </div>
                  )}
                  {electionStatus.currentPhase !== 1 && (
                    <div className="mt-2 p-2 bg-yellow-100 rounded text-yellow-800 font-medium">
                      ⚠ Registration is NOT ACTIVE - Wait for government to start registration phase
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LSAG Input Options */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">LSAG Signature Input</h3>
              
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload LSAG Signature JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>

              <div className="text-center text-gray-500 font-semibold">OR</div>

              {/* Paste JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste LSAG Signature JSON
                </label>
                <textarea
                  value={lsagInput}
                  onChange={(e) => setLsagInput(e.target.value)}
                  placeholder='{"voterName": "...", "sid": "...", "electionId": "...", "lsagSignature": {...}, "newPublicKey": "..."}'
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={handleParseLSAG}
                  disabled={!lsagInput}
                  className="mt-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-black rounded-lg text-sm"
                >
                  Parse LSAG Signature
                </button>
              </div>
            </div>

            {/* LSAG Preview */}
            {lsagData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3">✓ LSAG Signature Loaded</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-green-900">Voter Name:</span>{' '}
                    <span className="text-green-800">{lsagData.voterName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">SID:</span>{' '}
                    <span className="text-green-800">{lsagData.sid}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Election ID:</span>{' '}
                    <span className="text-green-800">{lsagData.electionId}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">New Public Key:</span>{' '}
                    <span className="text-green-800 font-mono text-xs break-all">
                      {lsagData.newPublicKey.substring(0, 30)}...
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Key Image:</span>{' '}
                    <span className="text-green-800 font-mono text-xs break-all">
                      {lsagData.lsagSignature.keyImageX.substring(0, 20)}...
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-green-900">Ring Size:</span>{' '}
                    <span className="text-green-800">{lsagData.lsagSignature.s.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Connect Wallet Button */}
            <button
              onClick={handleConnectWallet}
              disabled={!lsagData || !contractAddress || isProcessing}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isProcessing ? 'Connecting...' : 'Connect Wallet & Proceed'}
            </button>
          </div>
        )}

        {/* Step 2: Connected - Submit to Blockchain */}
        {step === 'connected' && lsagData && (
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

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">LSAG Signature to Submit</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Voter:</span> {lsagData.voterName}</div>
                <div><span className="font-medium">SID:</span> {lsagData.sid}</div>
                <div><span className="font-medium">Election:</span> {lsagData.electionId}</div>
                <div className="text-xs text-gray-600">
                  This will call BB.verify to complete your registration on the blockchain.
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
                    <strong>Important:</strong> This transaction will verify your LSAG signature and complete your registration. Make sure MetaMask is connected to the correct network.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={isProcessing || (electionStatus ? electionStatus.currentPhase !== 1 : false)}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {isProcessing ? 'Submitting to Blockchain...' : 
                 (electionStatus ? electionStatus.currentPhase !== 1 : false) ? 
                  `Cannot Submit - Phase: ${electionStatus?.phaseString ?? 'Unknown'}` : 
                 'Submit Registration'}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-black rounded-lg"
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
                  <p className="font-semibold text-green-900">Registration Complete!</p>
                  <p className="text-sm text-green-800">Your LSAG signature has been verified and registered.</p>
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
                  <span className="font-medium text-gray-700">Election ID:</span>
                  <p className="text-gray-900">{result.electionId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Registration Index (kv):</span>
                  <p className="text-gray-900 font-bold text-lg">{result.registrationIndex}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">New Public Key:</span>
                  <p className="text-xs font-mono text-gray-900 break-all bg-gray-50 p-2 rounded mt-1">
                    {result.newPublicKey}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-gray-800">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Transaction Hash:</span>
                  <p className="text-xs font-mono text-blue-600 break-all">{result.transactionHash}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-700">Block Number:</span>
                    <p className="text-gray-900">{result.blockNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Gas Used:</span>
                    <p className="text-gray-900">{result.gasUsed}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownloadResult}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-lg border border-slate-300 transition-colors"
              >
                Download Registration Result
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-black rounded-lg"
              >
                Register Another
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
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
          <h3 className="text-sm font-semibold text-orange-900 mb-2">What does this do?</h3>
          <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
            <li>Submits your LSAG signature to the blockchain</li>
            <li>Calls BB.verify function to verify the signature</li>
            <li>Checks for double registration (prevents duplicate votes)</li>
            <li>Adds you to the registration table</li>
            <li>Returns your registration index (kv) - save this!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
