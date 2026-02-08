'use client';

import React, { useState, useEffect } from 'react';
import { TallyService, CANDIDATES, type Candidate, type VoteReveal, type ElectionResults } from '@/lib/tally-service';

export default function TallyInterface() {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tally inputs
  const [kv, setKv] = useState<string>('');
  const [candidateChoice, setCandidateChoice] = useState<Candidate>('A');
  const [r, setR] = useState<string>('');

  // Vote file upload
  const [voteFile, setVoteFile] = useState<File | null>(null);

  // Results
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Verification
  const [verification, setVerification] = useState<{
    valid: boolean;
    storedHash: string;
    calculatedHash: string;
    message?: string;
  } | null>(null);

  // Service instance
  const [tallyService, setTallyService] = useState<TallyService | null>(null);

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
      const service = new TallyService(address);
      await service.loadABI();
      setTallyService(service);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load contract config:', err);
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
    setVerification(null);

    try {
      const result = await tallyService.verifyVoteIntegrity(
        parseInt(kv),
        candidateChoice,
        r
      );

      setVerification(result);
      
      if (result.valid) {
        setSuccess('✅ Vote verification successful! You can now tally this vote.');
      } else {
        setError('❌ ' + result.message);
      }
    } catch (err: any) {
      setError(err.message);
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

    setLoading(true);
    setError('');
    setSuccess('');

    try {
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetResults = async () => {
    if (!tallyService) {
      setError('Service not initialized');
      return;
    }

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

    setLoading(true);
    setError('');

    try {
      const currentResults = await tallyService.getResults();
      setResults(currentResults);
      setShowResults(true);
      setSuccess('Results fetched successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📊 Tally Votes
        </h1>
        <p className="text-gray-600 mb-6">
          Reveal your vote and contribute to the final tally
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
              className="w-full bg-blue-600 text-black py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
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

        {/* File Upload */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Step 1: Load Vote File (Optional)
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              id="vote-file-upload"
            />
            <label
              htmlFor="vote-file-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📁 Choose Vote File
            </label>
            {voteFile && (
              <p className="mt-2 text-sm text-gray-600">
                ✅ Loaded: {voteFile.name}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Upload the vote_*.json file from when you cast your vote
            </p>
          </div>
        </div>

        {/* Tally Form */}
        <div className="space-y-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Step 2: Reveal Vote Data
          </h2>

          {/* Registration Index */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registration Index (k_v)
            </label>
            <input
              type="number"
              value={kv}
              onChange={(e) => setKv(e.target.value)}
              placeholder="Enter your registration index (e.g., 0)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Random Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Random Number (r)
            </label>
            <input
              type="text"
              value={r}
              onChange={(e) => setR(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              The random number generated when you cast your vote
            </p>
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={loading || !connected || !kv || !r}
            className="w-full bg-purple-600 text-black py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? 'Verifying...' : '🔍 Verify Vote Integrity'}
          </button>
        </div>

        {/* Verification Result */}
        {verification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            verification.valid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <h3 className="font-semibold mb-2">
              {verification.valid ? '✅ Verification Passed' : '❌ Verification Failed'}
            </h3>
            <div className="text-sm space-y-1">
              <p className={verification.valid ? 'text-green-800' : 'text-red-800'}>
                {verification.message}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Hash Details</summary>
                <div className="mt-2 font-mono text-xs space-y-1">
                  <div>
                    <span className="text-gray-600">Stored:</span>
                    <p className="break-all">{verification.storedHash}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Calculated:</span>
                    <p className="break-all">{verification.calculatedHash}</p>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Tally Button */}
        {verification?.valid && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Step 3: Submit to Tally
            </h2>
            <button
              onClick={handleTally}
              disabled={loading || !connected}
              className="w-full bg-green-600 text-black py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
            >
              {loading ? 'Tallying...' : '📊 Tally Vote on Blockchain'}
            </button>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-yellow-800 text-sm">
                <strong>⚠️ Important:</strong> This will reveal your vote choice on the blockchain.
                Only proceed during the official tally phase.
              </p>
            </div>
          </div>
        )}

        {/* View Results */}
        <div className="border-t pt-6">
          <button
            onClick={handleGetResults}
            disabled={loading}
            className="w-full bg-indigo-600 text-black py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {loading ? 'Loading...' : '📈 View Current Results'}
          </button>
        </div>

        {/* Results Display */}
        {showResults && results && (
          <div className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              🏆 Election Results
            </h2>
            <div className="space-y-3">
              {CANDIDATES.map((candidate) => {
                const count = parseInt(results[candidate]);
                const total = parseInt(results.total);
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                
                return (
                  <div key={candidate} className="bg-white rounded-lg p-4 shadow">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-lg">Candidate {candidate}</span>
                      <span className="text-2xl font-bold text-indigo-600">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{percentage}% of total votes</p>
                  </div>
                );
              })}
              <div className="border-t-2 border-gray-300 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-700">Total Votes:</span>
                  <span className="text-3xl font-bold text-indigo-600">{results.total}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">📋 Instructions</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>Connect your wallet to interact with the blockchain</li>
            <li>(Optional) Upload your vote file to auto-fill the form</li>
            <li>Enter your registration index (k_v) from registration</li>
            <li>Select the candidate you voted for (c)</li>
            <li>Enter the random number (r) from your vote</li>
            <li>Click &quot;Verify Vote Integrity&quot; to check your data</li>
            <li>If verification passes, click &quot;Tally Vote on Blockchain&quot;</li>
            <li>Wait for transaction confirmation</li>
            <li>View the updated election results</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
