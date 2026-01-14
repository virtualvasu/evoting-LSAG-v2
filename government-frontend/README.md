# Government E-Voting Frontend

A Next.js web application for government officials to pre-register voters in the LSAG-based e-voting system.

## Features

- **Pre-Register Voters**: Government officials can register voters by collecting their names, public keys, and student IDs
- **Certificate Generation**: Automatically generates government-signed certificates for voters
- **User-Friendly Interface**: Clean, intuitive web interface built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ installed
- The main LSAG e-voting project set up and configured
- Government configuration file at `scripts/config/government-config.json`

### Installation

```bash
cd government-frontend
npm install
```

### Running the Application

Development mode:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

Production build:
```bash
npm run build
npm run start
```

## How It Works

### Pre-Registration Flow

1. **Voter Generates Keypair**
   - Voter runs: `node scripts/generate-keypair.js`
   - Saves the 64-byte public key

2. **Government Pre-Registration**
   - Opens the government frontend
   - Enters voter name, public key (64 bytes hex), and student ID
   - System generates a government-signed certificate: `CERT_<sid>.json`

3. **Output**
   - Certificate file is created for the voter
   - Voter uses this certificate for next steps in registration

## API Endpoints

### POST /api/pre-register

Registers a voter with the government.

**Request Body:**
```json
{
  "name": "John Doe",
  "publicKey": "a1b2c3d4...", // 128 hex characters
  "studentId": "12340450"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Voter successfully pre-registered",
  "certificatePath": "scripts/pre_registration/CERT_12340450.json"
}
```

## Project Structure

```
government-frontend/
├── app/
│   ├── page.tsx              # Main home page
│   ├── layout.tsx            # Root layout
│   └── api/
│       └── pre-register/
│           └── route.ts      # Pre-registration API endpoint
├── components/
│   └── PreRegistration.tsx   # Pre-registration form component
├── public/                   # Static assets
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Important Notes

- The government configuration must be set up first using: `node scripts/admin/simple-setup.js`
- Public keys must be exactly 128 hex characters (64 bytes)
- All voter data is validated before certificate generation
- Certificates are signed by the government authority using ECDSA

## Troubleshooting

### "Government configuration not found"
- Run: `node scripts/admin/simple-setup.js` in the project root first

### "Public key must be 128 hex characters"
- Ensure you're using the full 64-byte (128 hex character) public key from the keypair generation

### Port already in use
- Change the port: `npm run dev -- -p 3001`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [LSAG E-Voting System README](../README.md)
- [Project Root](../)

## Security Notes

- This is a local government application - run on secure, isolated machines
- Never expose private keys in the government portal
- Keep the government configuration file (`government-config.json`) secure
- All cryptographic operations are performed using ethers.js

---

**Part of the LSAG-Based E-Voting System** 🗳️


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
