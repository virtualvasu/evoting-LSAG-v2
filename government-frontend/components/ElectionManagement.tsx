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

  // Initialize contract
  useEffect(() => {
    initContract();
    // wrapped in timeout to ensure contract is set if possible, but actually dependency array [] runs once. 
    // We need to call loadElectionStatus after contract is set. 
    // Effect for contract change would be better.
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

      // Load contract config
      const configResponse = await fetch('/contract-config.json');
      const config = await configResponse.json();

      const contractABI = [
        "function startElection(string memory _electionId, bytes1[] memory _candidates)",
        "function endElection()",
        "function resetElectionData()",
        "function getElectionStatus() view returns (string, bool, bool, bytes1[], uint256)",
        "function owner() view returns (address)"
      ];

      const evotingContract = new ethers.Contract(
        config.contractAddress,
        contractABI,
        signer
      );

      setContract(evotingContract);
    } catch (error) {
      console.error('Contract initialization failed:', error);
      setMessage({ type: 'error', text: 'Failed to initialize contract' });
    }
  };

  const loadElectionStatus = async () => {
    if (!contract) return;

    try {
      const [electionId, isActive, isCompleted, candidates, registeredVoters] = 
        await contract.getElectionStatus();
      
      const candidateIds = candidates.map((c: any) => String.fromCharCode(parseInt(c, 16)));
      
      // Load names from local storage
      let candidateNames: Record<string, string> = {};
      if (electionId) {
        try {
            const stored = localStorage.getItem(`election_${electionId}_candidates`);
            if (stored) {
                candidateNames = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load candidate names", e);
        }
      }

      setCurrentStatus({
        electionId,
        isActive,
        isCompleted,
        candidates: candidateIds,
        candidateNames,
        registeredVoters: Number(registeredVoters)
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

    setLoading(true);
    try {
      // Store names in local storage
      const namesMap: Record<string, string> = {};
      newElection.candidates.forEach(c => {
        namesMap[c.id] = c.name;
      });
      localStorage.setItem(`election_${newElection.electionId}_candidates`, JSON.stringify(namesMap));

      // Convert candidates to bytes1 format
      const candidatesBytes = newElection.candidates.map(c => 
        '0x' + c.id.charCodeAt(0).toString(16).padStart(2, '0')
      );

      const tx = await contract.startElection(newElection.electionId, candidatesBytes);
      await tx.wait();

      setMessage({ type: 'success', text: 'Election started successfully!' });
      await loadElectionStatus();
      
      // Reset form
      setNewElection({ 
        electionId: '', 
        candidates: [
            { id: 'A', name: '' },
            { id: 'B', name: '' },
            { id: 'C', name: '' }
        ] 
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to start election' });
    }
    setLoading(false);
  };

  const handleEndElection = async () => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.endElection();
      await tx.wait();

      setMessage({ type: 'success', text: 'Election ended successfully!' });
      await loadElectionStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to end election' });
    }
    setLoading(false);
  };

  const handleResetElectionData = async () => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.resetElectionData();
      await tx.wait();

      setMessage({ type: 'success', text: 'Election data reset successfully!' });
      await loadElectionStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to reset election data' });
    }
    setLoading(false);
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
            <div>
              <p className="text-sm text-gray-600">Registered Voters:</p>
              <p className="font-semibold text-lg">{currentStatus.registeredVoters}</p>
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
              disabled={loading || !newElection.electionId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Starting...' : 'Start Election'}
            </button>
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
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Ending...' : 'End Election'}
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
            disabled={loading}
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
        <h4 className="font-semibold text-blue-900 mb-2">Workflow:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Setup new election with ID and candidates</li>
          <li>Start election - voters can now register and vote</li>
          <li>End election when voting period is over</li>
          <li>Store results off-chain</li>
          <li>Reset election data to prepare for next election</li>
        </ol>
        <p className="text-xs text-blue-600 mt-3">
          The voter ring persists across elections - no need to re-register voters!
        </p>
      </div>
    </div>
  );
}