'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface ElectionStatus {
  electionId: string;
  isActive: boolean;
  isCompleted: boolean;
  candidates: string[];
  candidateNames: Record<string, string>; // Map ID to Name
  registeredVoters: number;
  currentPhase: number;
  phaseString: string;
}

interface Candidate {
  id: string;
  name: string;
}

interface NewElectionData {
  electionId: string;
  candidates: Candidate[];
}

export default function ElectionManagement() {
  const [currentStatus, setCurrentStatus] = useState<ElectionStatus | null>(null);
  const [newElection, setNewElection] = useState<NewElectionData>({
    electionId: '',
    candidates: [
      { id: 'A', name: '' },
      { id: 'B', name: '' },
      { id: 'C', name: '' }
    ]
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [signerAddress, setSignerAddress] = useState<string>('');
  const [ownerAddress, setOwnerAddress] = useState<string>('');
  const [configuredChainId, setConfiguredChainId] = useState<string>('');
  const [connectedChainId, setConnectedChainId] = useState<string>('');

  const isOwner = Boolean(
    signerAddress &&
    ownerAddress &&
    signerAddress.toLowerCase() === ownerAddress.toLowerCase()
  );

  const shortenAddress = (address: string) => {
    if (!address) return 'Not connected';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const extractRevertData = (error: any): string | null => {
    return (
      error?.data?.data ??
      error?.info?.error?.data?.data ??
      error?.info?.error?.data ??
      error?.error?.data?.data ??
      error?.error?.data ??
      null
    );
  };

  const getReadableErrorMessage = (error: any) => {
    const revertData = extractRevertData(error);

    if (revertData && contract) {
      try {
        const parsedError = contract.interface.parseError(revertData);

        if (parsedError?.name === 'OwnableUnauthorizedAccount') {
          const unauthorizedAccount = String(parsedError.args?.[0] ?? signerAddress ?? 'unknown account');
          const expectedOwner = ownerAddress || 'the contract owner';
          return `Connected wallet ${unauthorizedAccount} is not the contract owner. Switch MetaMask to ${expectedOwner} before starting or managing an election.`;
        }

        if (parsedError?.name) {
          return `Contract reverted with ${parsedError.name}.`;
        }
      } catch {
        // Fall through to generic parsing below.
      }
    }

    if (typeof error?.reason === 'string' && error.reason.length > 0) {
      return error.reason;
    }

    if (typeof error?.shortMessage === 'string' && error.shortMessage.length > 0) {
      return error.shortMessage;
    }

    if (typeof error?.message === 'string' && error.message.length > 0) {
      if (error.message.includes('execution reverted')) {
        return 'Transaction reverted by the contract. Make sure you are connected with the contract owner wallet.';
      }

      return error.message;
    }

    return 'Transaction failed';
  };

  const refreshContractAccess = async (evotingContract: ethers.Contract, connectedAddress?: string) => {
    try {
      const [owner, network] = await Promise.all([
        evotingContract.owner(),
        evotingContract.runner?.provider?.getNetwork()
      ]);

      setOwnerAddress(owner);
      setConnectedChainId(network ? network.chainId.toString() : '');

      if (connectedAddress) {
        setSignerAddress(connectedAddress);
      }
    } catch (error) {
      console.error('Failed to refresh contract access details:', error);
    }
  };

  const ensureOwnerAccess = async () => {
    if (!contract) return false;

    const [connectedAddress, owner] = await Promise.all([
      contract.runner && 'getAddress' in contract.runner
        ? contract.runner.getAddress()
        : Promise.resolve(signerAddress),
      contract.owner()
    ]);

    setSignerAddress(connectedAddress);
    setOwnerAddress(owner);

    if (connectedAddress.toLowerCase() !== owner.toLowerCase()) {
      setMessage({
        type: 'error',
        text: `Connected wallet ${connectedAddress} is not the contract owner. Switch MetaMask to ${owner} and try again.`
      });
      return false;
    }

    return true;
  };

  const runOwnerAction = async (
    action: () => Promise<ethers.ContractTransactionResponse>,
    successText: string
  ) => {
    if (!contract) return;

    const hasOwnerAccess = await ensureOwnerAccess();
    if (!hasOwnerAccess) return false;

    setLoading(true);
    try {
      const tx = await action();
      await tx.wait();

      setMessage({ type: 'success', text: successText });
      await Promise.all([
        loadElectionStatus(),
        refreshContractAccess(contract)
      ]);
      return true;
    } catch (error: any) {
      setMessage({ type: 'error', text: getReadableErrorMessage(error) });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Initialize contract
  useEffect(() => {
    initContract();
    // wrapped in timeout to ensure contract is set if possible, but actually dependency array [] runs once. 
    // We need to call loadElectionStatus after contract is set. 
    // Effect for contract change would be better.
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      initContract();
    };

    const handleChainChanged = () => {
      initContract();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (contract) {
        loadElectionStatus();
    }
  }, [contract]);

  const initContract = async () => {
    try {
      if (!window.ethereum) {
        // Silent fail or minimal log if not found immediately, handled by connect wallet usually
        console.log('MetaMask not found'); 
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const connectedAddress = await signer.getAddress();

      // Load contract config
      const configResponse = await fetch('/contract-config.json');
      const config = await configResponse.json();

      const evotingContract = new ethers.Contract(
        config.contractAddress,
        config.abi,
        signer
      );

      setConfiguredChainId(config.chainId || '');
      setSignerAddress(connectedAddress);
      setContract(evotingContract);
      await refreshContractAccess(evotingContract, connectedAddress);
    } catch (error) {
      console.error('Contract initialization failed:', error);
      setMessage({ type: 'error', text: 'Failed to initialize contract' });
    }
  };

  const loadElectionStatus = async () => {
    if (!contract) return;

    try {
      const [electionId, isActive, isCompleted, candidates, registeredVoters, currentPhase, phaseString] = 
        await contract.getElectionStatus();
      
      // Candidates are now strings, no conversion needed
      const candidateIds = candidates.map((_: string, index: number) => 
        String.fromCharCode(65 + index) // A, B, C...
      );
      
      // Use candidate names directly as they are strings now
      const candidateNames: Record<string, string> = {};
      candidates.forEach((name: string, index: number) => {
        const id = String.fromCharCode(65 + index);
        candidateNames[id] = name;
      });

      setCurrentStatus({
        electionId,
        isActive,
        isCompleted,
        candidates: candidateIds,
        candidateNames,
        registeredVoters: Number(registeredVoters),
        currentPhase: Number(currentPhase),
        phaseString: phaseString
      });
    } catch (error) {
      console.error('Failed to load election status:', error);
    }
  };

  const handleStartElection = async () => {
    if (!contract || !newElection.electionId || newElection.candidates.length === 0) {
      setMessage({ type: 'error', text: 'Please fill all fields' });
      return;
    }

    // Validate all candidates have names
    const invalidCandidates = newElection.candidates.filter(c => !c.name.trim());
    if (invalidCandidates.length > 0) {
      setMessage({ type: 'error', text: 'All candidates must have names' });
      return;
    }

    const candidateNames = newElection.candidates.map(c => c.name.trim());

    const success = await runOwnerAction(
      () => contract.startElection(newElection.electionId.trim(), candidateNames),
      'Election started successfully!'
    );

    if (success) {
      setNewElection({ 
        electionId: '', 
        candidates: [
          { id: 'A', name: '' },
          { id: 'B', name: '' },
          { id: 'C', name: '' }
        ] 
      });
    }
  };

  const handleEndElection = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.endElection(),
      'Election ended successfully!'
    );
  };

  const handleResetElectionData = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.resetElectionData(),
      'Election data reset successfully!'
    );
  };

  // Phase Control Handlers
  const handleStartRegistrationPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.startRegistrationPhase(),
      'Registration phase started!'
    );
  };

  const handleStopRegistrationPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.stopRegistrationPhase(),
      'Registration phase stopped!'
    );
  };

  const handleStartVotingPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.startVotingPhase(),
      'Voting phase started!'
    );
  };

  const handleStopVotingPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.stopVotingPhase(),
      'Voting phase stopped!'
    );
  };

  const handleStartTallyingPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.startTallyingPhase(),
      'Tallying phase started!'
    );
  };

  const handleStopTallyingPhase = async () => {
    if (!contract) return;

    await runOwnerAction(
      () => contract.stopTallyingPhase(),
      'Tallying phase stopped!'
    );
  };

  const addCandidate = () => {
    const nextChar = String.fromCharCode(65 + newElection.candidates.length); // A, B, C, D...
    if (newElection.candidates.length < 26) {
      setNewElection(prev => ({
        ...prev,
        candidates: [...prev.candidates, { id: nextChar, name: '' }]
      }));
    }
  };

  const removeCandidate = (index: number) => {
    if (newElection.candidates.length > 1) {
      setNewElection(prev => ({
        ...prev,
        candidates: prev.candidates.filter((_, i) => i !== index)
      }));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Election Management</h2>
        <p className="text-gray-600">Setup, start, and manage elections (Owner Only)</p>
      </div>

      {/* Current Election Status */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Election Status</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Connected Wallet:</p>
            <p className={`font-mono text-sm ${isOwner ? 'text-green-700' : 'text-red-700'}`}>
              {shortenAddress(signerAddress)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Contract Owner:</p>
            <p className="font-mono text-sm text-gray-900">{shortenAddress(ownerAddress)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Connected Chain ID:</p>
            <p className="font-mono text-sm text-gray-900">{connectedChainId || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Configured Chain ID:</p>
            <p className={`font-mono text-sm ${configuredChainId && connectedChainId && configuredChainId !== connectedChainId ? 'text-red-700' : 'text-gray-900'}`}>
              {configuredChainId || 'Unknown'}
            </p>
          </div>
        </div>

        {!isOwner && ownerAddress && signerAddress && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            This wallet is not the contract owner. Owner-only actions like starting an election will revert until MetaMask is switched to {ownerAddress}.
          </div>
        )}
        
        {currentStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Election ID:</p>
              <p className="font-mono text-lg">{currentStatus.electionId || 'No active election'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status:</p>
              <p className={`font-semibold ${
                currentStatus.isActive ? 'text-green-600' : 
                currentStatus.isCompleted ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {currentStatus.isActive ? 'Active' : 
                 currentStatus.isCompleted ? 'Completed' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Phase:</p>
              <p className="font-semibold text-lg">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  currentStatus.phaseString === 'SETUP' ? 'bg-gray-100 text-gray-800' :
                  currentStatus.phaseString === 'REGISTRATION' ? 'bg-blue-100 text-blue-800' :
                  currentStatus.phaseString === 'VOTING' ? 'bg-green-100 text-green-800' :
                  currentStatus.phaseString === 'TALLYING' ? 'bg-purple-100 text-purple-800' :
                  currentStatus.phaseString === 'ENDED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {currentStatus.phaseString}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Registered Voters:</p>
              <p className="font-semibold text-lg">{currentStatus.registeredVoters}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 mb-1">Candidates:</p>
              <div className="flex flex-wrap gap-2">
                {currentStatus.candidates.map(c => (
                  <span key={c} className="bg-white border rounded px-2 py-1 text-sm">
                    <span className="font-mono font-bold mr-1">{c}</span>
                    {currentStatus.candidateNames[c] && (
                        <span className="text-gray-600">- {currentStatus.candidateNames[c]}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading...</p>
        )}

        <button
          onClick={loadElectionStatus}
          className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition duration-200"
        >
          Refresh Status
        </button>
      </div>

      {/* Phase Control Panel */}
      {currentStatus?.isActive && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Control</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Registration Phase Controls */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="font-semibold text-blue-900 mb-3">Registration Phase</h4>
              <div className="space-y-2">
                <button
                  onClick={handleStartRegistrationPhase}
                  disabled={loading || !isOwner || currentStatus.phaseString === 'REGISTRATION'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  {currentStatus.phaseString === 'REGISTRATION' ? '✓ Active' : 'Start Registration'}
                </button>
                <button
                  onClick={handleStopRegistrationPhase}
                  disabled={loading || !isOwner || currentStatus.phaseString !== 'REGISTRATION'}
                  className="w-full bg-blue-800 hover:bg-blue-900 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  Stop Registration
                </button>
              </div>
            </div>

            {/* Voting Phase Controls */}
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h4 className="font-semibold text-green-900 mb-3">Voting Phase</h4>
              <div className="space-y-2">
                <button
                  onClick={handleStartVotingPhase}
                  disabled={
                    loading || 
                    !isOwner ||
                    currentStatus.phaseString === 'VOTING' || 
                    currentStatus.phaseString === 'REGISTRATION' || 
                    currentStatus.registeredVoters === 0
                  }
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                  title={currentStatus.registeredVoters === 0 ? 'Need registered voters first' : currentStatus.phaseString === 'REGISTRATION' ? 'Stop registration first' : ''}
                >
                  {currentStatus.phaseString === 'VOTING' ? '✓ Active' : 'Start Voting'}
                </button>
                <button
                  onClick={handleStopVotingPhase}
                  disabled={loading || !isOwner || currentStatus.phaseString !== 'VOTING'}
                  className="w-full bg-green-800 hover:bg-green-900 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  Stop Voting
                </button>
              </div>
              {currentStatus.phaseString === 'REGISTRATION' && (
                <p className="text-xs text-orange-700 mt-2">⚠ Stop registration before starting voting</p>
              )}
              {currentStatus.registeredVoters === 0 && currentStatus.phaseString !== 'REGISTRATION' && (
                <p className="text-xs text-red-700 mt-2">⚠ No voters registered yet</p>
              )}
            </div>

            {/* Tallying Phase Controls */}
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50 md:col-span-2">
              <h4 className="font-semibold text-purple-900 mb-3">Tallying Phase</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={handleStartTallyingPhase}
                  disabled={
                    loading || 
                    !isOwner ||
                    currentStatus.phaseString === 'TALLYING' || 
                    currentStatus.phaseString === 'VOTING' || 
                    currentStatus.phaseString === 'REGISTRATION'
                  }
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                  title={currentStatus.phaseString === 'VOTING' ? 'Stop voting first' : currentStatus.phaseString === 'REGISTRATION' ? 'Complete registration and voting first' : ''}
                >
                  {currentStatus.phaseString === 'TALLYING' ? '✓ Active' : 'Start Tallying'}
                </button>
                <button
                  onClick={handleStopTallyingPhase}
                  disabled={loading || !isOwner || currentStatus.phaseString !== 'TALLYING'}
                  className="bg-purple-800 hover:bg-purple-900 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm"
                >
                  Stop Tallying
                </button>
              </div>
              {(currentStatus.phaseString === 'VOTING' || currentStatus.phaseString === 'REGISTRATION') && (
                <p className="text-xs text-orange-700 mt-2">⚠ Complete and stop {currentStatus.phaseString.toLowerCase()} before tallying</p>
              )}
            </div>
          </div>

          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>Phase Flow:</strong> SETUP → REGISTRATION (stop) → VOTING (stop) → TALLYING (stop) → END
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>⚠ Important:</strong> You must stop each phase before starting the next one.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Registration must be stopped before voting can start. Voting must be stopped before tallying can start.
            </p>
          </div>
        </div>
      )}

      {/* Election Controls */}
      {currentStatus?.isActive && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Election Controls</h3>
          
          <div className="space-y-3">
            <button
              onClick={handleEndElection}
              disabled={loading || !isOwner}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Ending...' : 'End Election'}
            </button>
          </div>
        </div>
      )}

      {/* Setup New Election */}
      {(!currentStatus?.isActive) && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Setup New Election</h3>
          
          <div className="space-y-4">
            {/* Election ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Election ID
              </label>
              <input
                type="text"
                value={newElection.electionId}
                onChange={(e) => setNewElection(prev => ({ ...prev, electionId: e.target.value }))}
                placeholder="e.g., election_2026_spring"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Candidates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candidates
              </label>
              <div className="space-y-2 mb-4">
                {newElection.candidates.map((candidate, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="font-mono bg-blue-100 px-3 py-2 rounded text-blue-800 font-bold min-w-[40px] text-center">
                        {candidate.id}
                    </span>
                    <input 
                        type="text"
                        placeholder={`Candidate Name`}
                        value={candidate.name}
                        onChange={(e) => {
                            const newCandidates = [...newElection.candidates];
                            newCandidates[index].name = e.target.value;
                            setNewElection(prev => ({ ...prev, candidates: newCandidates }));
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {newElection.candidates.length > 1 && (
                      <button
                        onClick={() => removeCandidate(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title="Remove candidate"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addCandidate}
                disabled={newElection.candidates.length >= 26}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm transition duration-200 font-medium"
              >
                + Add Candidate
              </button>
            </div>

            <button
              onClick={handleStartElection}
              disabled={loading || !isOwner || !newElection.electionId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Starting...' : 'Start Election'}
            </button>
          </div>
        </div>
      )}

      {/* Reset Election Data */}
      {currentStatus?.isCompleted && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Post-Election Actions</h3>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Make sure you've saved the election results off-chain before resetting!
            </p>
          </div>
          
          <button
            onClick={handleResetElectionData}
            disabled={loading || !isOwner}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {loading ? 'Resetting...' : 'Reset Election Data'}
          </button>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`border rounded-lg p-4 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="font-semibold">
            {message.type === 'success' ? 'Success' : 'Error'}
          </p>
          <p>{message.text}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Sequential Workflow:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li><strong>Setup Election:</strong> Create election with ID and candidates (Phase: SETUP)</li>
          <li><strong>Start Registration:</strong> Open voter registration phase</li>
          <li><strong>Stop Registration:</strong> Close registration when complete (must stop before voting)</li>
          <li><strong>Start Voting:</strong> Open voting phase (only after registration is stopped)</li>
          <li><strong>Stop Voting:</strong> Close voting when period ends (must stop before tallying)</li>
          <li><strong>Start Tallying:</strong> Begin vote counting (only after voting is stopped)</li>
          <li><strong>Stop Tallying:</strong> Complete tallying when all votes counted</li>
          <li><strong>End Election:</strong> Finalize election (Phase: ENDED)</li>
          <li><strong>Reset:</strong> Save results off-chain, then reset for next election</li>
        </ol>
        <p className="text-xs text-blue-600 mt-3">
          <strong>⚠ Phase Dependencies:</strong> Each phase must be properly stopped before advancing to the next phase. This ensures data integrity and proper election flow.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          The voter ring persists across elections - no need to re-register voters!
        </p>
      </div>
    </div>
  );
}