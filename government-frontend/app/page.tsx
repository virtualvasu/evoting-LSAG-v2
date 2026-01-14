'use client';

import PreRegistration from '@/components/PreRegistration';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🏛️ Government E-Voting Portal</h1>
          <p className="text-lg text-gray-600">LSAG-Based Voter Pre-Registration System</p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <PreRegistration />
        </div>
      </div>
    </main>
  );
}
