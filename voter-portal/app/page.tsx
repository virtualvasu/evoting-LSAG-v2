import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header Section */}
      <header className="border-b border-gray-200/50 backdrop-blur-sm bg-white/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Voter Portal</h1>
                <p className="text-sm text-gray-600">LSAG-Based E-Voting System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Secure Anonymous Voting
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              A privacy-preserving e-voting platform using Linkable Spontaneous Anonymous Group (LSAG) signatures for secure and traceable voting without voter identification.
            </p>
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">4</div>
              <p className="text-sm text-gray-600">Sequential Phases</p>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">∞</div>
              <p className="text-sm text-gray-600">Complete Privacy</p>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">🔐</div>
              <p className="text-sm text-gray-600">Cryptographically Secure</p>
            </div>
          </div>
        </div>

        {/* Phases Section */}
        <div className="space-y-6">
          {/* Phase 1: Pre-Registration */}
          <div className="card p-8 border-l-4 border-blue-500 animate-fadeIn">
            <div className="flex items-start gap-4 mb-6">
              <div className="phase-number" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
                1
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Cryptographic Setup</h2>
                <p className="text-gray-600 mt-1">Generate your unique cryptographic keys for the voting system</p>
              </div>
              <span className="badge badge-primary">Getting Started</span>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <Link
                href="/generate-keypair"
                className="group block p-6 rounded-lg border border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-600 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Generate Keypair</h3>
                    </div>
                    <p className="text-gray-600 ml-11">Create secp256k1 cryptographic keys for secure voting</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Step 1:</strong> Generate your private key locally. Your keys remain secure on your device and are never transmitted to any server.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center py-2">
            <div className="h-12 w-1 bg-gradient-to-b from-blue-400 to-green-400 rounded-full"></div>
          </div>

          {/* Phase 2: Registration */}
          <div className="card p-8 border-l-4 border-green-500 animate-fadeIn">
            <div className="flex items-start gap-4 mb-6">
              <div className="phase-number" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                2
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Anonymous Registration</h2>
                <p className="text-gray-600 mt-1">Register your keys on the blockchain without revealing your identity</p>
              </div>
              <span className="badge badge-success">Blockchain</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Update Voter Ring */}
              <Link
                href="/update-voter-ring"
                className="group block p-6 rounded-lg border border-green-200 hover:border-green-400 bg-gradient-to-br from-green-50 to-green-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-green-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors">Update Ring</h3>
                    </div>
                    <p className="text-sm text-gray-600">Register on blockchain</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              {/* Generate LSAG */}
              <Link
                href="/generate-lsag"
                className="group block p-6 rounded-lg border border-emerald-200 hover:border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-emerald-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">Generate LSAG</h3>
                    </div>
                    <p className="text-sm text-gray-600">Sign with anonymity</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              {/* Submit LSAG */}
              <Link
                href="/submit-lsag"
                className="group block p-6 rounded-lg border border-teal-200 hover:border-teal-400 bg-gradient-to-br from-teal-50 to-teal-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-teal-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">Submit LSAG</h3>
                    </div>
                    <p className="text-sm text-gray-600">Finalize registration</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>

            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-900">
                <strong>Step 2:</strong> Complete the LSAG registration process to anonymously add yourself to the voter ring.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center py-2">
            <div className="h-12 w-1 bg-gradient-to-b from-green-400 to-red-400 rounded-full"></div>
          </div>

          {/* Phase 3: Voting */}
          <div className="card p-8 border-l-4 border-red-500 animate-fadeIn">
            <div className="flex items-start gap-4 mb-6">
              <div className="phase-number" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                3
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Cast Your Vote</h2>
                <p className="text-gray-600 mt-1">Encrypt and submit your vote using LSAG signature for complete anonymity</p>
              </div>
              <span className="badge badge-danger">Active Phase</span>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <Link
                href="/vote"
                className="group block p-6 rounded-lg border border-red-200 hover:border-red-400 bg-gradient-to-br from-red-50 to-red-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-600 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600 transition-colors">Cast Vote</h3>
                    </div>
                    <p className="text-gray-600 ml-11">Generate and submit your encrypted anonymous vote</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>

            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-900">
                <strong>Step 3:</strong> Your vote is encrypted with your private key and signed using LSAG for anonymity.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center py-2">
            <div className="h-12 w-1 bg-gradient-to-b from-red-400 to-indigo-400 rounded-full"></div>
          </div>

          {/* Phase 4: Tallying */}
          <div className="card p-8 border-l-4 border-indigo-500 animate-fadeIn">
            <div className="flex items-start gap-4 mb-6">
              <div className="phase-number" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                4
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">View Results</h2>
                <p className="text-gray-600 mt-1">Verify election results and reveal your vote when tallying is complete</p>
              </div>
              <span className="badge badge-primary">Final Phase</span>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <Link
                href="/tally"
                className="group block p-6 rounded-lg border border-indigo-200 hover:border-indigo-400 bg-gradient-to-br from-indigo-50 to-indigo-100/50 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-600 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">View Tally</h3>
                    </div>
                    <p className="text-gray-600 ml-11">Reveal results and verify your vote was counted</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>

            <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-900">
                <strong>Step 4:</strong> View final results and optionally reveal your vote to verify it was counted correctly.
              </p>
            </div>
          </div>
        </div>

        {/* Security Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 border-l-4 border-blue-500">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Privacy First</h3>
                <p className="text-gray-600 text-sm">Your votes remain encrypted and anonymous throughout the process. Not even administrators can identify voters.</p>
              </div>
            </div>
          </div>

          <div className="card p-6 border-l-4 border-green-500">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifiable</h3>
                <p className="text-gray-600 text-sm">All operations are cryptographically verifiable. You can verify your vote was counted without revealing how you voted.</p>
              </div>
            </div>
          </div>

          <div className="card p-6 border-l-4 border-purple-500">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Local Processing</h3>
                <p className="text-gray-600 text-sm">Cryptographic operations run locally. Only blockchain interactions occur online, ensuring your keys never leave your device.</p>
              </div>
            </div>
          </div>

          <div className="card p-6 border-l-4 border-indigo-500">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">LSAG Technology</h3>
                <p className="text-gray-600 text-sm">Linkable Spontaneous Anonymous Group signatures prevent double voting while maintaining voter privacy.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center border-t border-gray-200 pt-8">
          <p className="text-gray-600 mb-4">
            Ready to participate in a secure, anonymous election?
          </p>
          <Link
            href="/generate-keypair"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            Get Started
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="text-gray-500 text-sm mt-6">
            Secure • Transparent • Anonymous • Verifiable
          </p>
        </div>
      </main>
    </div>
  );
}
