'use client';

import React, { useState, useEffect } from 'react';
import { VotingService, DEFAULT_CANDIDATES, type Candidate, type VoteData } from '@/lib/voting-service';
import { BlockchainService } from '@/lib/blockchain-utils';

export default function VotingInterface() {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Vote generation inputs
  const [newPrivateKey, setNewPrivateKey] = useState('');
  const [candidateChoice, setCandidateChoice] = useState<Candidate>('Alice');
  const [kv, setKv] = useState<string>('');

  // Available candidates for current election
  const [availableCandidates, setAvailableCandidates] = useState<string[]>([...DEFAULT_CANDIDATES]);

  // Vote data
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);

  // Service instance
  const [votingService, setVotingService] = useState<VotingService | null>(null);

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
      const service = new VotingService(address);
      await service.loadABI();
      setVotingService(service);
      
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
      
      // Show warning if not in voting phase
      if (status.currentPhase !== 2) {
        setError(
          `Voting is currently NOT ACTIVE. Current phase: ${status.phaseString}. ` +
          `Please wait for the government authority to start the voting phase.`
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
    if (!votingService) {
      setError('Service not initialized');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const address = await votingService.connectWallet();
      setWalletAddress(address);
      setConnected(true);
      setSuccess(`Connected: ${address}`);

      // Fetch available candidates for the current election
      try {
        // Get candidates from contract if election is active
        const candidatesFromContract = await votingService.getElectionCandidates();
        if (candidatesFromContract && candidatesFromContract.length > 0) {
          setAvailableCandidates(candidatesFromContract);
          setCandidateChoice(candidatesFromContract[0]);
        }
      } catch (err: any) {
        console.warn('Could not fetch election candidates, using defaults:', err);
        // Keep default candidates if fetch fails
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVoteStatus = async () => {
    if (!votingService || !kv) {
      setError('Please connect wallet and enter registration index');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const voted = await votingService.hasVoted(parseInt(kv));
      setHasVoted(voted);
      
      if (voted) {
        setError('This registration index has already voted!');
      } else {
        setSuccess('Registration index is valid and has not voted yet.');
      }
    } catch (err: any) {
      setError(`Error checking vote status: ${err.message}`);
      setHasVoted(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVote = async () => {
    if (!votingService) {
      setError('Service not initialized');
      return;
    }

    if (!newPrivateKey || !candidateChoice || !kv) {
      setError('Please fill in all fields');
      return;
    }

    // Validate private key format
    const cleanKey = newPrivateKey.startsWith('0x') ? newPrivateKey.slice(2) : newPrivateKey;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      setError('Invalid private key format. Must be 64 hexadecimal characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVoteData(null);

    try {
      const result = await votingService.generateVote(
        newPrivateKey,
        candidateChoice,
        parseInt(kv)
      );

      if (result.success && result.voteData) {
        setVoteData(result.voteData);
        setSuccess('Vote generated successfully! Review and cast your vote below.');
      } else {
        setError(result.error || 'Failed to generate vote');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (!votingService || !voteData) {
      setError('No vote data available');
      return;
    }

    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    // Check if voting phase is active
    if (electionStatus && electionStatus.currentPhase !== 2) {
      setError(
        `Cannot cast vote: Voting phase is not active. Current phase: ${electionStatus.phaseString}. ` +
        `Please wait for the government authority to start the voting phase.`
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
      const isVotingActive = await blockchain.isVotingPhaseActive();
      if (!isVotingActive) {
        throw new Error('Voting phase is not active. Please refresh and check the current phase.');
      }

      const result = await votingService.castVote(voteData);

      if (result.success) {
        setSuccess(
          `Vote cast successfully!\nTransaction: ${result.transactionHash}\nGas used: ${result.gasUsed}`
        );
        // Clear sensitive data
        setNewPrivateKey('');
        setVoteData(null);
      } else {
        setError(result.error || 'Failed to cast vote');
      }
    } catch (err: any) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('Operation not allowed in current phase')) {
        setError('Vote casting failed: Voting phase is not active. The government authority needs to start the voting phase first.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVote = () => {
    if (!voteData) return;

    const dataStr = JSON.stringify(voteData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vote_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-rose-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-red-600 to-rose-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cast Your Vote</h1>
              <p className="text-gray-600 mt-1">Phase 3: Securely submit your anonymous vote</p>
            </div>
          </div>
        </div>

        {/* Election Status Card */}
        {electionStatus && (
          <div className={`card p-6 mb-6 border-l-4 animate-fadeIn ${
            electionStatus.currentPhase === 2 
              ? 'border-green-500 bg-green-50' 
              : 'border-yellow-500 bg-yellow-50'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 11a3 3 0 110-6 3 3 0 010 6zM9 3a6 6 0 100 12 6 6 0 000-12zM0 16.68A19.919 19.919 0 0112 15c2.997 0 5.846.65 8.75 1.764M19 18a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Election Status
                </h2>
                <p className="text-sm text-gray-600 mt-1">Current blockchain state</p>
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

            {electionStatus.currentPhase === 2 && (
              <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-green-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-green-900">Voting is active - You can vote now!</span>
              </div>
            )}
            {electionStatus.currentPhase !== 2 && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-yellow-900">Voting is not active yet. Wait for the voting phase to start.</span>
              </div>
            )}
          </div>
        )}

        {/* Wallet Connection */}
        {!connected ? (
          <div className="card p-6 border-2 border-dashed border-blue-300 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Connect Your Wallet</h3>
                <p className="text-sm text-gray-600 mt-1">MetaMask is required to cast votes on the blockchain</p>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="card p-4 mb-6 bg-green-50 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900">Wallet Connected</p>
                <p className="text-xs font-mono text-green-800 mt-1">{walletAddress}</p>
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

        {/* Main Content */}
        {!voteData ? (
          <div className="card p-8 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="phase-number" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>3</div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Generate Your Vote</h2>
                <p className="text-gray-600 mt-1">Create and encrypt your anonymous vote</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Registration Index */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Registration Index (k_v)</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={kv}
                    onChange={(e) => setKv(e.target.value)}
                    placeholder="Enter your registration index (e.g., 0)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    onClick={handleCheckVoteStatus}
                    disabled={loading || !kv}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    Check Status
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">The index you received after successful LSAG registration</p>
                {hasVoted !== null && (
                  <div className={`mt-3 p-3 rounded-lg ${hasVoted ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}`}>
                    <p className={`font-semibold ${hasVoted ? 'text-red-900' : 'text-green-900'}`}>
                      {hasVoted ? '❌ This index has already voted' : '✓ This index can vote'}
                    </p>
                  </div>
                )}
              </div>

              {/* Private Key */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">New Private Key (P_rv')</label>
                <input
                  type="password"
                  value={newPrivateKey}
                  onChange={(e) => setNewPrivateKey(e.target.value.trim())}
                  placeholder="0x... or 64 hex characters"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                  disabled={loading}
                />
                <p className="text-xs text-gray-600 mt-2">The private key from your LSAG registration (64 hexadecimal characters)</p>
              </div>

              {/* Candidate Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Select Your Candidate</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableCandidates.map((candidate) => (
                    <button
                      key={candidate}
                      onClick={() => setCandidateChoice(candidate)}
                      className={`py-4 px-4 rounded-lg font-semibold transition-all duration-300 border-2 ${
                        candidateChoice === candidate
                          ? 'border-red-600 bg-red-100 text-red-900'
                          : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400'
                      }`}
                      disabled={loading}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleGenerateVote}
                disabled={loading || !newPrivateKey || !kv || hasVoted === true}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Generating Vote...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 17v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                    </svg>
                    Generate & Encrypt Vote
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* Vote Summary */}
            <div className="card p-8 border-l-4 border-green-500 bg-green-50">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Vote Generated Successfully
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Registration Index</p>
                  <p className="text-lg font-bold text-gray-900 font-mono">{voteData.kv}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Your Choice</p>
                  <p className="text-lg font-bold text-red-600">{voteData.candidateChoice}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Timestamp</p>
                  <p className="text-xs text-gray-900 font-mono">{voteData.timestamp}</p>
                </div>
              </div>

              <details className="bg-white p-4 rounded-lg border border-green-200">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 10l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Cryptographic Details
                </summary>
                <div className="mt-4 space-y-3 text-xs font-mono">
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">Vote Hash (h_v):</p>
                    <p className="text-gray-800 break-all bg-gray-50 p-2 rounded">{voteData.h_v.substring(0, 50)}...</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">Signature (r):</p>
                    <p className="text-gray-800 break-all bg-gray-50 p-2 rounded">{voteData.sigma_v_prime.r.substring(0, 50)}...</p>
                  </div>
                </div>
              </details>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleCastVote}
                disabled={loading || !connected || (electionStatus ? electionStatus.currentPhase !== 2 : false)}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg disabled:cursor-notallowed"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Submitting Vote...
                  </>
                ) : (electionStatus ? electionStatus.currentPhase !== 2 : false) ? (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 112.5 8a1 1 0 011.414 1.414A4 4 0 1013.5 8a1 1 0 01-1.414-1.414l.707-.707a1 1 0 11-1.414-1.414L13.5 6.086A6 6 0 0113.477 14.89z" clipRule="evenodd" />
                    </svg>
                    {`Voting Closed (${electionStatus?.phaseString ?? 'Unknown'})`}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 1a1 1 0 011-1h12a1 1 0 011 1H3zm0 4a1 1 0 001 1h12a1 1 0 100-2H4a1 1 0 00-1 1zm0 10a1 1 0 001 1h6a1 1 0 100-2H4a1 1 0 00-1 1zm0-5a1 1 0 001 1h9a1 1 0 100-2H4a1 1 0 00-1 1z" />
                    </svg>
                    Submit Vote to Blockchain
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadVote}
                className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg border border-slate-300 transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0 0l-3 3m3-3l3 3m8-6V9a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-3" />
                </svg>
                Download
              </button>
              <button
                onClick={() => { setVoteData(null); setError(''); setSuccess(''); }}
                className="px-6 py-4 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="alert alert-warning">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold mb-1">Final Confirmation</p>
                <p className="text-sm">Your vote cannot be changed after submission. Please review your choice once more before clicking Submit.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
