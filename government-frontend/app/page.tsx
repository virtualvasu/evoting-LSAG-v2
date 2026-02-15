'use client';

import { useState, useEffect } from 'react';
import PreRegistration from '@/components/PreRegistration';
import ElectionManagement from '@/components/ElectionManagement';

type Tab = 'preregistration' | 'elections';

interface ContractConfig {
  contractAddress: string;
  rpcUrl: string;
  network: string;
  chainId: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('elections');
  const [contractConfig, setContractConfig] = useState<ContractConfig | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    loadContractConfig();
    checkWalletConnection();
  }, []);

  const loadContractConfig = async () => {
    try {
      const response = await fetch('/contract-config.json');
      const config = await response.json();
      setContractConfig(config);
    } catch (error) {
      console.error('Failed to load contract config:', error);
    }
  };

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletConnected(true);
          setWalletAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask to continue.');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Government E-Voting Portal</h1>
          <p className="text-lg text-gray-600">LSAG-Based Election Management System</p>
        </div>

        {/* Contract Info & Wallet Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {/* Contract Address */}
            <div className="overflow-hidden">
              <p className="text-sm text-gray-600 mb-1">Contract Address:</p>
              <p className="font-mono text-xs bg-gray-100 p-2 rounded border text-gray-800 truncate" title={contractConfig?.contractAddress}>
                {contractConfig?.contractAddress || 'Loading...'}
              </p>
            </div>

            {/* RPC URL */}
            <div className="overflow-hidden">
              <p className="text-sm text-gray-600 mb-1">RPC URL:</p>
              <p className="font-mono text-xs bg-gray-100 p-2 rounded border text-gray-800 truncate" title={contractConfig?.rpcUrl}>
                {contractConfig?.rpcUrl || 'Loading...'}
              </p>
            </div>

            {/* Network Info */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Network:</p>
              <p className="font-semibold text-sm">
                {contractConfig?.network || 'Loading...'} 
                {contractConfig?.chainId && (
                  <span className="text-gray-500"> (ID: {contractConfig.chainId})</span>
                )}
              </p>
            </div>

            {/* Wallet Connection */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Wallet Status:</p>
              {walletConnected ? (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <div className="flex items-center text-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-xs font-semibold">Connected</span>
                  </div>
                  <p className="text-xs font-mono text-green-700 mt-1">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors shadow-sm"
                >
                  Connect MetaMask
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('elections')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition duration-200 ${
                  activeTab === 'elections'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Election Management
              </button>
              <button
                onClick={() => setActiveTab('preregistration')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition duration-200 ${
                  activeTab === 'preregistration'
                    ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Voter Pre-Registration
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'elections' && <ElectionManagement />}
            {activeTab === 'preregistration' && <PreRegistration />}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Secure | Transparent | Verifiable</p>
          <p className="mt-1">Government Portal for LSAG-based Electronic Voting System</p>
        </div>
      </div>
    </main>
  );
}
