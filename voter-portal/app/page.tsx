import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Voter Portal
            </h1>
            <p className="text-xl text-gray-600">
              Standalone Voter Interface for E-Voting with LSAG
            </p>
          </div>

          {/* Sequential Phases */}
          <div className="space-y-8">
            {/* Phase 1: Pre-Registration */}
            <div className="bg-white rounded-lg shadow-xl p-8 border-l-4 border-blue-500">
              <div className="flex items-center mb-6">
                <div className="bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg mr-4">
                  1
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Pre-Registration Phase</h2>
                  <p className="text-gray-600">Generate your cryptographic identity</p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-1">
                {/* Generate Key Pair */}
                <Link 
                  href="/generate-keypair"
                  className="block p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <h3 className="text-xl font-bold">Generate Voter Keys</h3>
                    </div>
                    <p className="text-blue-100">
                      Create a new secp256k1 key pair for anonymous voting
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Phase 2: Registration */}
            <div className="bg-white rounded-lg shadow-xl p-8 border-l-4 border-green-500">
              <div className="flex items-center mb-6">
                <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg mr-4">
                  2
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Registration Phase</h2>
                  <p className="text-gray-600">Complete your anonymous registration on the blockchain</p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-3">
                {/* Update Voter Ring */}
                <Link 
                  href="/update-voter-ring"
                  className="block p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-xl font-bold">Update Ring</h3>
                    </div>
                    <p className="text-green-100">
                      Register your certificate on blockchain
                    </p>
                  </div>
                </Link>

                {/* Generate LSAG Signature */}
                <Link 
                  href="/generate-lsag"
                  className="block p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <h3 className="text-xl font-bold">Generate LSAG</h3>
                    </div>
                    <p className="text-emerald-100">
                      Create anonymous voting signature
                    </p>
                  </div>
                </Link>

                {/* Submit LSAG Registration */}
                <Link 
                  href="/submit-lsag"
                  className="block p-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <h3 className="text-xl font-bold">Submit LSAG</h3>
                    </div>
                    <p className="text-teal-100">
                      Complete registration with BB.verify
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Phase 3: Voting */}
            <div className="bg-white rounded-lg shadow-xl p-8 border-l-4 border-red-500">
              <div className="flex items-center mb-6">
                <div className="bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg mr-4">
                  3
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Voting Phase</h2>
                  <p className="text-gray-600">Cast your encrypted vote anonymously</p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-1">
                {/* Cast Vote */}
                <Link 
                  href="/vote"
                  className="block p-6 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-xl font-bold">Cast Vote</h3>
                    </div>
                    <p className="text-red-100">
                      Generate and submit your encrypted vote
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Phase 4: Tallying */}
            <div className="bg-white rounded-lg shadow-xl p-8 border-l-4 border-indigo-500">
              <div className="flex items-center mb-6">
                <div className="bg-indigo-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg mr-4">
                  4
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Tallying Phase</h2>
                  <p className="text-gray-600">Reveal votes and view election results</p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-1">
                {/* Tally Votes */}
                <Link 
                  href="/tally"
                  className="block p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <div className="text-white">
                    <div className="flex items-center mb-3">
                      <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-xl font-bold">Tally Votes</h3>
                    </div>
                    <p className="text-indigo-100">
                      Reveal your vote and view results
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Privacy & Security
                </h3>
                <p className="text-blue-800">
                  All operations are performed locally on your machine. Only blockchain interactions occur online to prevent data loss. Your private keys never leave your device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
