'use client';

import { useState } from 'react';
import axios from 'axios';

interface VoterData {
  name: string;
  publicKey: string;
  studentId: string;
}

interface RegistrationResponse {
  success: boolean;
  message: string;
  certificate?: any;
  studentId?: string;
  error?: string;
}

export default function PreRegistration() {
  const [formData, setFormData] = useState<VoterData>({
    name: '',
    publicKey: '',
    studentId: '',
  });

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RegistrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await axios.post('/api/pre-register', formData);
      setResponse(res.data);
      
      if (res.data.success) {
        setFormData({ name: '', publicKey: '', studentId: '' });
      }
    } catch (err) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'An unexpected error occurred';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const downloadCertificate = () => {
    if (!response?.certificate) return;
    
    const dataStr = JSON.stringify(response.certificate, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CERT_${response.studentId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">📋 Voter Pre-Registration</h2>
        <p className="text-gray-600">Register a new voter with their public key and credentials</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Voter Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Voter Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter voter's full name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        {/* Public Key */}
        <div>
          <label htmlFor="publicKey" className="block text-sm font-medium text-gray-700 mb-2">
            Voter Public Key (64 bytes hex)
          </label>
          <input
            id="publicKey"
            name="publicKey"
            type="text"
            value={formData.publicKey}
            onChange={handleChange}
            required
            placeholder="0x... or without 0x prefix"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Must be 128 hex characters (64 bytes)</p>
        </div>

        {/* Student ID */}
        <div>
          <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-2">
            Student ID
          </label>
          <input
            id="studentId"
            name="studentId"
            type="text"
            value={formData.studentId}
            onChange={handleChange}
            required
            placeholder="Enter student ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-black font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
          {loading ? '⏳ Processing...' : '✅ Pre-Register Voter'}
        </button>
      </form>

      {/* Success Response */}
      {response && response.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Registration Successful!</h3>
          <p className="text-green-700 mb-2">{response.message}</p>
          
          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>🔒 Security Notice:</strong> Certificate is generated in-memory and is not saved to the project directory. 
              Only the voter can see and download their certificate for privacy and security.
            </p>
          </div>
          
          {response.certificate && (
            <div className="space-y-4">
              {/* Certificate Display */}
              <div className="bg-white p-4 rounded border border-green-300">
                <h4 className="font-semibold text-gray-900 mb-3">📋 Voter Certificate (CERT_{response.studentId}.json)</h4>
                <div className="bg-gray-50 p-3 rounded border border-gray-300 font-mono text-xs text-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
                  <pre>{JSON.stringify(response.certificate, null, 2)}</pre>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={downloadCertificate}
                className="w-full bg-green-600 hover:bg-green-700 text-black font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
              >
                📥 Download Certificate as JSON
              </button>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong> Give this certificate to the voter. They will need it for updating the voter ring and LSAG signature generation.
                </p>
              </div>
            </div>
          )}
          
          <p className="text-sm text-green-600 mt-3">
            📝 Next Step: Voter uses this certificate for registration process
          </p>
        </div>
      )}

      {/* Error Response */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Registration Failed</h3>
          <p className="text-red-700 font-mono text-sm break-all">{error}</p>
        </div>
      )}

      {/* Error from API */}
      {response && !response.success && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Registration Failed</h3>
          <p className="text-red-700">{response.message || response.error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📌 Instructions:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Voter generates keypair using: <code className="bg-blue-100 px-2 py-1 rounded">node scripts/generate-keypair.js</code></li>
          <li>Enter voter name, public key (64 bytes), and student ID</li>
          <li>A government-signed certificate will be generated</li>
          <li>Certificate is saved as <code className="bg-blue-100 px-2 py-1 rounded">CERT_&lt;sid&gt;.json</code></li>
          <li>Next steps: Update voter ring and generate LSAG signature</li>
        </ol>
      </div>
    </div>
  );
}
