'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TallyService, DEFAULT_CANDIDATES, type Candidate, type VoteReveal, type ElectionResults } from '@/lib/tally-service';
import { BlockchainService } from '@/lib/blockchain-utils';

export default function TallyInterface() {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [info, setInfo] = useState('');
  const infoAlertRef = useRef<HTMLDivElement | null>(null);

  // Tally inputs
  const [kv, setKv] = useState<string>('');
  const [candidateChoice, setCandidateChoice] = useState<Candidate>('Alice');
  const [r, setR] = useState<string>('');

  // Vote file upload
  const [voteFile, setVoteFile] = useState<File | null>(null);

  // Results
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Available candidates for current election
  const [availableCandidates, setAvailableCandidates] = useState<string[]>([...DEFAULT_CANDIDATES]);

  // Verification
  const [verification, setVerification] = useState<{
    valid: boolean;
    storedHash: string;
    calculatedHash: string;
    message?: string;
  } | null>(null);

  // Service instance
  const [tallyService, setTallyService] = useState<TallyService | null>(null);

  // Phase checking state
  const [electionStatus, setElectionStatus] = useState<{
    electionId: string;
    isActive: boolean;
    phaseString: string;
    currentPhase: number;
    registeredVoters: string;
  } | null>(null);
  const [isCheckingPhase, setIsCheckingPhase] = useState(false);
  const [rpcUrl, setRpcUrl] = useState('http://10.10.0.61:8550');

  // Load contract config on mount
  useEffect(() => {
    loadContractConfig();
  }, []);

  useEffect(() => {
    if (info && infoAlertRef.current) {
      infoAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [info]);

  const loadContractConfig = async () => {
    try {
      const response = await fetch('/api/contract');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load contract configuration');
      }
      const data = await response.json();
      
      if (!data.address && !data.contractAddress) {
        throw new Error('Contract address not found in configuration');
      }
      
      const address = data.address || data.contractAddress;
      setContractAddress(address);
      setRpcUrl(data.rpcUrl || 'http://10.10.0.61:8550');

      // Initialize service
      const service = new TallyService(address);
      await service.loadABI();
      setTallyService(service);
      
      // Check election phase
      await checkElectionPhase(address, data.rpcUrl || 'http://10.10.0.61:8550');
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load contract config:', err);
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
      
      // Show warning if not in tallying phase
      if (status.currentPhase !== 3) {
        setError(
          `Tallying is currently NOT ACTIVE. Current phase: ${status.phaseString}. ` +
          `Please wait for the government authority to start the tallying phase.`
        );
      }
    } catch (err) {
      console.error('Failed to check election phase:', err);
      setError('Warning: Could not verify election phase. ' + (err as Error).message);
    } finally {
      setIsCheckingPhase(false);
    }
  };

  const handleConnect = async () => {
    if (!tallyService) {
      setError('Service not initialized');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const address = await tallyService.connectWallet();
      setWalletAddress(address);
      setConnected(true);
      setSuccess(`Connected: ${address}`);

      // Fetch available candidates for the current election
      try {
        const candidates = await tallyService.getElectionCandidates();
        setAvailableCandidates(candidates);
        if (candidates.length > 0) {
          setCandidateChoice(candidates[0] as Candidate);
        }
      } catch (err: any) {
        console.warn('Could not fetch election candidates:', err);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setVoteFile(file);
      const text = await file.text();
      const voteData = JSON.parse(text);

      // Populate fields from vote file
      if (voteData.kv !== undefined) setKv(voteData.kv.toString());
      if (voteData.candidateChoice) setCandidateChoice(voteData.candidateChoice);
      if (voteData.r) setR(voteData.r);

      setSuccess('Vote file loaded successfully!');
      setError('');
    } catch (err: any) {
      setError('Failed to parse vote file: ' + err.message);
      setVoteFile(null);
    }
  };

  const handleVerify = async () => {
    if (!tallyService || !connected) {
      setError('Please connect wallet first');
      return;
    }

    if (!kv || !candidateChoice || !r) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVerification(null);

    try {
      // Call the verifyVoteIntegrity method from TallyService
      const result = await tallyService.verifyVoteIntegrity(
        parseInt(kv),
        candidateChoice,
        r
      );

      setVerification({
        valid: result.valid,
        storedHash: result.storedHash,
        calculatedHash: result.calculatedHash,
        message: result.message,
      });

      if (result.valid) {
        setSuccess('✅ Verification successful! You can now proceed to tally.');
      } else {
        setError('❌ Verification failed. ' + (result.message || 'The vote data does not match the stored hash.'));
      }
    } catch (err: any) {
      setError('Verification error: ' + err.message);
      setVerification(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTally = async () => {
    if (!tallyService || !connected) {
      setError('Please connect wallet first');
      return;
    }

    if (!kv || !candidateChoice || !r) {
      setError('Please fill in all fields');
      return;
    }

    // Check if tallying phase is active
    if (electionStatus && electionStatus.currentPhase !== 3) {
      setError(
        `Cannot tally vote: Tallying phase is not active. Current phase: ${electionStatus.phaseString}. ` +
        `Please wait for the government authority to start the tallying phase.`
      );
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Double-check phase right before submitting
      const blockchain = new BlockchainService(contractAddress, rpcUrl);
      await blockchain.connectReadOnly();
      const isTallyingActive = await blockchain.isTallyingPhaseActive();
      if (!isTallyingActive) {
        throw new Error('Tallying phase is not active. Please refresh and check the current phase.');
      }

      const voteReveal: VoteReveal = {
        kv: parseInt(kv),
        candidateChoice,
        r,
      };

      const result = await tallyService.tallyVote(voteReveal);

      if (result.success) {
        setSuccess(
          `✅ Vote tallied successfully!\n` +
          `Transaction: ${result.transactionHash}\n` +
          `Gas used: ${result.gasUsed}\n` +
          `Vote counted for Candidate ${candidateChoice}`
        );
        
        if (result.results) {
          setResults(result.results);
          setShowResults(true);
        }

        // Clear sensitive data
        setKv('');
        setR('');
        setVoteFile(null);
        setVerification(null);
      } else {
        setError(result.error || 'Failed to tally vote');
      }
    } catch (err: any) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('Operation not allowed in current phase')) {
        setError('Vote tallying failed: Tallying phase is not active. The government authority needs to start the tallying phase first.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGetResults = async () => {
    if (!tallyService) {
      setError('Service not initialized');
      return;
    }

    setInfo('');
    setSuccess('');

    // Initialize contract for read-only if not connected
    if (!connected) {
      try {
        await tallyService.connectWallet();
        setConnected(true);
      } catch (err: any) {
        setError('Please connect wallet to view results');
        return;
      }
    }

    if (electionStatus && !electionStatus.isActive) {
      setError('');
      setShowResults(false);
      setResults(null);
      setInfo(
        'No active election right now. Results are unavailable until a new election is initialized and tallying is started.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const currentResults = await tallyService.getResults();
      setResults(currentResults);
      setShowResults(true);
      setSuccess('Results fetched successfully!');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch results';
      const noResultsAvailable =
        errorMessage.includes('No election results available') ||
        errorMessage.includes('Election may not be initialized');

      if (noResultsAvailable) {
        setError('');
        setShowResults(false);
        setResults(null);
        setInfo(
          'No election results available yet. This usually means no election is currently active or tallying has not started.'
        );
      } else {
        setInfo('');
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">View Election Results</h1>
              <p className="text-gray-600 mt-1">Phase 4: Reveal your vote and verify results</p>
            </div>
          </div>
        </div>

        {/* Election Status */}
        {electionStatus && (
          <div className={`card p-6 mb-6 border-l-4 animate-fadeIn ${
            electionStatus.currentPhase === 3 
              ? 'border-indigo-500 bg-indigo-50' 
              : 'border-yellow-500 bg-yellow-50'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  Election Status
                </h2>
              </div>
              <button
                onClick={() => checkElectionPhase()}
                disabled={isCheckingPhase}
                className="text-xs font-semibold px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isCheckingPhase ? 'Checking...' : '↻ Refresh'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-1">Election ID</p>
                <p className="text-sm font-mono font-semibold text-gray-900">{electionStatus.electionId || '—'}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-1">Current Phase</p>
                <p className="text-sm font-semibold text-gray-900">{electionStatus.phaseString}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-1">Election Active</p>
                <p className={`text-sm font-semibold ${electionStatus.isActive ? 'text-green-700' : 'text-red-700'}`}>
                  {electionStatus.isActive ? '✓ Yes' : '✗ No'}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-1">Registered Voters</p>
                <p className="text-sm font-semibold text-gray-900">{electionStatus.registeredVoters}</p>
              </div>
            </div>

            {electionStatus.currentPhase === 3 && (
              <div className="mt-4 p-3 bg-indigo-100 border border-indigo-400 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-indigo-900">Tallying is active - You can submit your vote tally now!</span>
              </div>
            )}
            {electionStatus.currentPhase !== 3 && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-yellow-900">Tallying phase not active yet. Wait for the government authority to start it.</span>
              </div>
            )}
          </div>
        )}

        {/* Wallet Connection */}
        {!connected ? (
          <div className="card p-6 border-2 border-dashed border-indigo-300 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Connect Your Wallet</h3>
                <p className="text-sm text-gray-600 mt-1">MetaMask is required to submit your vote tally</p>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 9a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Connect Wallet
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-6 bg-indigo-50 border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">Wallet Connected</p>
                <p className="text-xs font-mono text-indigo-800 mt-1">{walletAddress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="alert alert-error mb-6">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-6">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-sm whitespace-pre-wrap">{success}</p>
            </div>
          </div>
        )}

        {info && (
          <div ref={infoAlertRef} className="alert alert-info mb-6">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-8-4a1 1 0 100 2 1 1 0 000-2zm-1 4a1 1 0 000 2h1v2a1 1 0 102 0v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Info</p>
              <p className="text-sm whitespace-pre-wrap">{info}</p>
            </div>
          </div>
        )}

        {/* Tally Form */}
        <div className="card p-8 mb-6 animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <div className="phase-number" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>4</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Submit Your Vote Tally</h2>
              <p className="text-gray-600 mt-1">Reveal your vote and contribute to the election results</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Load Vote File (Optional)</label>
              <div className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="vote-file"
                />
                <label htmlFor="vote-file" className="cursor-pointer block">
                  <svg className="w-12 h-12 text-indigo-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-4m0 0l-3 3m3-3l3 3M12 8v4m0-12a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <p className="font-semibold text-indigo-700">{voteFile ? voteFile.name : 'Upload vote file'}</p>
                  <p className="text-sm text-gray-600">Drag and drop or click to select</p>
                </label>
              </div>
            </div>

            {/* Registration Index */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Registration Index (k_v)</label>
              <input
                type="number"
                value={kv}
                onChange={(e) => setKv(e.target.value)}
                placeholder="Enter your registration index"
                className=" w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-600 mt-2">The index from your LSAG registration</p>
            </div>

            {/* Candidate Choice */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Your Vote Choice</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableCandidates.map((candidate) => (
                  <button
                    key={candidate}
                    onClick={() => setCandidateChoice(candidate)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all duration-300 border-2 ${
                      candidateChoice === candidate
                        ? 'border-indigo-600 bg-indigo-100 text-indigo-900'
                        : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400'
                    }`}
                    disabled={loading}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>

            {/* Random Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Random Number (r)</label>
              <input
                type="password"
                value={r}
                onChange={(e) => setR(e.target.value.trim())}
                placeholder="0x... or 64 hex characters"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                disabled={loading}
              />
              <p className="text-xs text-gray-600 mt-2">The random number (r) from your vote</p>
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={loading || !kv || !candidateChoice || !r || !connected}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Verifying Vote...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verify Vote Integrity
                </>
              )}
            </button>
          </div>
        </div>

        {/* Verification Result */}
        {verification && (
          <div className={`card p-6 mb-6 border-l-4 animate-fadeIn ${
            verification.valid 
              ? 'border-green-500 bg-green-50' 
              : 'border-red-500 bg-red-50'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              {verification.valid ? (
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${verification.valid ? 'text-green-900' : 'text-red-900'}`}>
                  {verification.valid ? 'Vote Verified Successfully' : 'Vote Verification Failed'}
                </h3>
                {verification.message && (
                  <p className={`text-sm mt-1 ${verification.valid ? 'text-green-800' : 'text-red-800'}`}>
                    {verification.message}
                  </p>
                )}
              </div>
            </div>

            {verification.valid && (
              <button
                onClick={handleTally}
                disabled={loading || !connected || (electionStatus ? electionStatus.currentPhase !== 3 : false)}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tallying...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Submit Tally to Blockchain
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Results Display */}
        {showResults && results && (
          <div className="card p-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-l-4 border-indigo-500 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-2">
              <svg className="w-8 h-8 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              Election Results
            </h2>

            <div className="space-y-4 mb-8">
              {Object.keys(results).filter(key => key !== 'total').map((candidate) => {
                const count = parseInt(results[candidate]);
                const total = parseInt(results.total);
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                
                return (
                  <div key={candidate} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-lg text-gray-900">{candidate}</span>
                      <span className="text-3xl font-bold text-indigo-600">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 font-semibold">{percentage}% of total votes</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border-2 border-indigo-300 rounded-lg p-6">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Total Votes Cast:</span>
                <span className="text-4xl font-bold text-indigo-600">{results.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* View Results Button */}
        <div className="mt-8">
          <button
            onClick={handleGetResults}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Loading Results...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                {showResults ? 'Refresh Results' : 'View Election Results'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
