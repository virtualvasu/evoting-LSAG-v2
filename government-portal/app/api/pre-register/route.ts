import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { PreRegistrationService } from '@/lib/pre-registration-service';

/**
 * PRE-REGISTRATION API ROUTE
 * Standalone government certificate generation service
 * Logic ported from scripts/pre_registration/pre-register-voter.js
 * 
 * This API endpoint:
 * 1. Validates voter details (name, public key, student ID)
 * 2. Generates government signature using private key
 * 3. Creates and stores certificate file
 * 4. Returns certificate for voter distribution
 * 
 * No external script dependencies - all logic embedded in the frontend
 */

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { name, publicKey, studentId } = requestBody;

    // ============ INPUT VALIDATION ============
    if (!name || !publicKey || !studentId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, publicKey, studentId' },
        { status: 400 }
      );
    }

    // Validate voter details using service
    const validation = PreRegistrationService.validateVoterDetails({
      name,
      publicKey,
      studentId
    });

    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // ============ CONFIGURATION PATHS ============
    const projectRoot = path.join(process.cwd(), '..');
    const candidatePaths = [
      path.join(projectRoot, 'scripts/config/government-config.json'),
      path.join(projectRoot, 'blockchain/config/government-config.json'),
      path.join(projectRoot, 'blockchain/config/config/government-config.json')
    ];

    const govConfigPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

    if (!govConfigPath) {
      return NextResponse.json(
        {
          error: `Government configuration not found. Checked: ${candidatePaths.join(', ')}`,
        },
        { status: 500 }
      );
    }

    // ============ PRE-REGISTRATION EXECUTION ============
    // Use service to execute complete pre-registration flow (in-memory only)
    const result = PreRegistrationService.preRegisterVoter(
      {
        name: name.trim(),
        publicKey,
        studentId: studentId.trim()
      },
      govConfigPath
      // Note: certificateOutputDir removed - no file saving
    );

    // ============ RESPONSE ============
    return NextResponse.json(
      {
        success: true,
        message: `Voter ${result.certificate.voterName} successfully pre-registered. Certificate generated (available for download).`,
        certificate: result.certificate,
        studentId: result.certificate.sid,
        signatureLength: result.signature.length,
        note: "Certificate is generated in-memory and not saved to project directory. Download using the button below."
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Pre-registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
