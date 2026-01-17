'use client';

import React, { useState, useEffect } from 'react';
import { VotingService, CANDIDATES, type Candidate, type VoteData } from '@/lib/voting-service';

export default function VotingInterface() {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Vote generation inputs
  const [newPrivateKey, setNewPrivateKey] = useState('');
  const [candidateChoice, setCandidateChoice] = useState<Candidate>('A');
  const [kv, setKv] = useState<string>('');

  // Vote data
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);

  // Service instance
  const [votingService, setVotingService] = useState<VotingService | null>(null);

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

      // Initialize service
      const service = new VotingService(address);
      await service.loadABI();
      setVotingService(service);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load contract config:', err);
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

    setLoading(true);
    setError('');
    setSuccess('');

    try {
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
      setError(err.message);
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🗳️ Cast Your Vote
        </h1>
        <p className="text-gray-600 mb-6">
          Generate and submit your encrypted vote to the blockchain
        </p>

        {/* Contract Info */}
        {contractAddress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              <strong>Contract Address:</strong>
            </p>
            <p className="text-xs font-mono text-gray-800 break-all">
              {contractAddress}
            </p>
          </div>
        )}

        {/* Wallet Connection */}
        <div className="mb-6">
          {!connected ? (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Connecting...' : '🔐 Connect Wallet'}
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Connected Wallet:</strong>
              </p>
              <p className="text-xs font-mono text-gray-800 break-all">
                {walletAddress}
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm whitespace-pre-wrap">{success}</p>
          </div>
        )}

        {/* Vote Generation Form */}
        {!voteData && (
          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Step 1: Generate Vote
            </h2>

            {/* Registration Index */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registration Index (k_v)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={kv}
                  onChange={(e) => setKv(e.target.value)}
                  placeholder="Enter your registration index (e.g., 0)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  onClick={handleCheckVoteStatus}
                  disabled={loading || !kv}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                >
                  Check Status
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This is the index you received after successful LSAG registration
              </p>
              {hasVoted !== null && (
                <p className={`text-sm mt-2 ${hasVoted ? 'text-red-600' : 'text-green-600'}`}>
                  {hasVoted ? '❌ Already voted' : '✓ Can vote'}
                </p>
              )}
            </div>

            {/* New Private Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Private Key (P_rv&apos;)
              </label>
              <input
                type="password"
                value={newPrivateKey}
                onChange={(e) => setNewPrivateKey(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                The new private key you generated during registration
              </p>
            </div>

            {/* Candidate Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candidate Choice
              </label>
              <div className="flex gap-2">
                {CANDIDATES.map((candidate) => (
                  <button
                    key={candidate}
                    onClick={() => setCandidateChoice(candidate)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                      candidateChoice === candidate
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={loading}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateVote}
              disabled={loading || !newPrivateKey || !kv || hasVoted === true}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Generating...' : '🎲 Generate Vote'}
            </button>
          </div>
        )}

        {/* Vote Data Display and Cast */}
        {voteData && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Step 2: Review and Cast Vote
            </h2>

            {/* Vote Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Vote Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration Index:</span>
                  <span className="font-mono">{voteData.kv}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Candidate:</span>
                  <span className="font-bold text-lg">{voteData.candidateChoice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vote Hash (h_v):</span>
                  <span className="font-mono text-xs break-all">
                    {voteData.h_v.substring(0, 20)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Timestamp:</span>
                  <span className="text-xs">{voteData.timestamp}</span>
                </div>
              </div>
            </div>

            {/* Signature Details */}
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="cursor-pointer font-semibold text-gray-700">
                📝 Signature Details (σ_v&apos;)
              </summary>
              <div className="mt-3 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-gray-600">r:</span>
                  <p className="break-all text-gray-800">{voteData.sigma_v_prime.r}</p>
                </div>
                <div>
                  <span className="text-gray-600">s:</span>
                  <p className="break-all text-gray-800">{voteData.sigma_v_prime.s}</p>
                </div>
                <div>
                  <span className="text-gray-600">v:</span>
                  <p className="text-gray-800">{voteData.sigma_v_prime.v}</p>
                </div>
                <div>
                  <span className="text-gray-600">Random (r):</span>
                  <p className="break-all text-gray-800">{voteData.r}</p>
                </div>
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCastVote}
                disabled={loading || !connected}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {loading ? 'Casting Vote...' : '📤 Cast Vote on Blockchain'}
              </button>
              <button
                onClick={handleDownloadVote}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
              >
                💾 Download
              </button>
              <button
                onClick={() => {
                  setVoteData(null);
                  setError('');
                  setSuccess('');
                }}
                className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-semibold"
              >
                ✖️ Cancel
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>⚠️ Important:</strong> Once you cast your vote, it cannot be changed.
                Please review your choice carefully before submitting.
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">📋 Instructions</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>Connect your wallet to interact with the blockchain</li>
            <li>Enter your registration index (k_v) from LSAG registration</li>
            <li>Check if you have already voted</li>
            <li>Enter your new private key (P_rv&apos;) from registration</li>
            <li>Select your candidate choice (A, B, C, D, or E)</li>
            <li>Click &quot;Generate Vote&quot; to create your encrypted vote</li>
            <li>Review the vote summary carefully</li>
            <li>Click &quot;Cast Vote on Blockchain&quot; to submit your vote</li>
            <li>Wait for transaction confirmation</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
