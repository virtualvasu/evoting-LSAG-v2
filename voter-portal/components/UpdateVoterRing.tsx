'use client';

import { useState, useEffect } from 'react';
import { BlockchainService, Certificate, UpdateRingResult } from '@/lib/blockchain-utils';

export default function UpdateVoterRing() {
  const [certificateInput, setCertificateInput] = useState('');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
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
      const response = await fetch('/contract-config.json');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Update Voter Ring</h1>
              <p className="text-gray-600 mt-1">Phase 2a: Register your certificate on the blockchain</p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingConfig && (
          <div className="card p-8 text-center">
            <svg className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-gray-600 font-medium">Loading blockchain configuration...</p>
          </div>
        )}

        {/* Main Content */}
        {!isLoadingConfig && step === 'input' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Step Indicator */}
            <div className="card p-6 border-l-4 border-green-500">
              <div className="flex items-center gap-4">
                <div className="phase-number" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>2a</div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">Load Your Certificate</h2>
                  <p className="text-gray-600 mt-1">Upload or paste your government-issued certificate JSON file</p>
                </div>
                <span className="badge badge-success">Blockchain Interaction</span>
              </div>
            </div>

            {/* Configuration Display */}
            <div className="card p-6 bg-green-50 border border-green-200">
              <h3 className="text-sm font-semibold text-green-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 3.062v6.72a1.066 1.066 0 01-1.879.687L12.823 9.9a6.6 6.6 0 00-5.646 0l-1.276 1.988A1.066 1.066 0 014.455 9.517V3.517a3.066 3.066 0 012.812-3.062zM12.331 9.75a1.066 1.066 0 100-2.132 1.066 1.066 0 000 2.132zm1.595-4.133a1.066 1.066 0 11-2.132 0 1.066 1.066 0 012.132 0zM9 15.904v1.192A7.965 7.965 0 012.458 21H0v-1.192a6 6 0 0111.842 0h2.812zM8.5 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" clipRule="evenodd" />
                </svg>
                Blockchain Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-green-800 font-medium mb-1">Contract Address</p>
                  <div className="bg-white p-3 rounded border border-green-300">
                    <p className="text-xs font-mono text-gray-900 break-all">{contractAddress || 'Loading...'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-green-800 font-medium mb-1">RPC URL</p>
                  <div className="bg-white p-3 rounded border border-green-300">
                    <p className="text-xs font-mono text-gray-900 break-all">{rpcUrl}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate Input Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Provide Your Certificate</h3>
              
              {/* File Upload */}
              <div className="card p-6 border-2 border-dashed border-green-300 hover:border-green-400 transition-colors">
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <svg className="w-12 h-12 text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-4m0 0l-3 3m3-3l3 3M4 20h16a2 2 0 002-2V4a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-green-700 font-semibold">Upload Certificate JSON</span>
                  <span className="text-sm text-gray-600 mt-1">or drag and drop</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-gray-500 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Paste JSON */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Paste Certificate JSON</label>
                <textarea
                  value={certificateInput}
                  onChange={(e) => setCertificateInput(e.target.value)}
                  placeholder='Paste your certificate JSON here...'
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                />
                <button
                  onClick={handleParseCertificate}
                  disabled={!certificateInput}
                  className="mt-3 w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  Parse & Validate Certificate
                </button>
              </div>
            </div>

            {/* Certificate Preview */}
            {certificate && (
              <div className="card p-6 border-l-4 border-green-500 bg-green-50 animate-fadeIn">
                <div className="flex items-start gap-3 mb-4">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-green-900">Certificate Loaded Successfully</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded border border-green-200">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Voter Name</p>
                    <p className="text-sm font-semibold text-gray-900">{certificate.voterName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">SID</p>
                    <p className="text-sm font-mono text-gray-900">{certificate.sid}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Public Key (Truncated)</p>
                    <p className="text-xs font-mono text-gray-900 break-all">{certificate.voterPublicKey.substring(0, 60)}...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleConnectWallet}
              disabled={!certificate || !contractAddress || isProcessing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Connecting Wallet...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect Wallet & Proceed
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Blockchain Submission */}
        {step === 'connected' && certificate && (
          <div className="space-y-6 animate-fadeIn">
            <div className="card p-6 border-l-4 border-green-500 bg-green-50">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold text-green-900">Wallet Connected</p>
                  <p className="text-xs text-green-800 font-mono mt-1">{walletAddress}</p>
                </div>
              </div>
            </div>

            <div className="alert alert-warning">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold mb-1">Network Verification</p>
                <p className="text-sm">MetaMask must be connected to IITBH Private Network (Chain ID: 491002). Please verify before submitting.</p>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Review Before Submitting</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Voter Name</p>
                  <p className="text-sm font-semibold text-gray-900">{certificate.voterName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Student ID</p>
                  <p className="text-sm font-mono text-gray-900">{certificate.sid}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  📋 This will submit your certificate to the blockchain and add your public key to the voter ring. This action is permanent and will be recorded on the blockchain.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Submitting to Blockchain...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Submit to Blockchain
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'result' && result && (
          <div className="space-y-6 animate-fadeIn">
            <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-600 rounded-full">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-900">Successfully Registered!</h2>
                  <p className="text-green-800 text-sm mb-2">Your certificate has been added to the voter ring</p>
                  <p className="text-xs font-mono text-green-700 break-all">TX: {result.transactionHash}</p>
                </div>
              </div>
            </div>

            {/* Details Card */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Voter Name</p>
                  <p className="font-semibold text-gray-900">{result.voterName}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">SID</p>
                  <p className="font-mono text-sm text-gray-900">{result.sid}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Ring Position</p>
                  <p className="text-lg font-bold text-blue-600">{result.ringPosition}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">Ring Size</p>
                  <p className="text-lg font-bold text-emerald-600">{result.ringSize}</p>
                </div>
              </div>
            </div>

            {/* Election Info */}
            {result.candidates && result.candidates.length > 0 && (
              <div className="card p-6 border-l-4 border-blue-500 bg-blue-50">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Election Information</h3>
                <div>
                  <p className="text-sm text-blue-800 mb-3">Available Candidates:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.candidates.map((candidate, idx) => (
                      <span key={idx} className="badge badge-primary">{candidate}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Voter Ring Preview */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Voter Ring ({result.voterRing.length} total)</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {result.voterRing.map((pubKeyHash, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs font-mono break-all transition-colors ${
                      idx.toString() === result.ringPosition
                        ? 'bg-green-100 border-green-400 text-green-900 font-semibold'
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-gray-600">[{idx}]</span> {pubKeyHash}
                    {idx.toString() === result.ringPosition && (
                      <span className="ml-2 text-green-700 font-bold">← You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Next Steps */}
            <div className="card p-6 bg-indigo-50 border-l-4 border-indigo-500">
              <h3 className="font-semibold text-indigo-900 mb-3">What's Next?</h3>
              <ol className="text-sm text-indigo-900 space-y-2 list-decimal list-inside">
                <li>Download and save your registration details</li>
                <li>Proceed to Phase 2b: Generate LSAG Signature</li>
                <li>Then proceed to Phase 2c: Submit LSAG Registration</li>
                <li>Finally, you can vote in Phase 3</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleDownloadResult}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-lg border border-slate-300 transition-all duration-300 hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm0-10V7a2 2 0 012-2h6a2 2 0 012 2v4" />
                </svg>
                Download Details
              </button>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Register Another
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="alert alert-error fixed bottom-4 right-4 max-w-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
