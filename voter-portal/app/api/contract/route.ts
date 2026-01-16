import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to contract config in voter-portal directory
    const configPath = path.join(process.cwd(), 'contract-config.json');
    
    if (!fs.existsSync(configPath)) {
      return NextResponse.json(
        { error: 'Contract config not found. Please create contract-config.json file.' },
        { status: 404 }
      );
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.abi || config.abi.length === 0) {
      return NextResponse.json(
        { error: 'ABI not found in contract config. Please update contract-config.json with the ABI.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      contractAddress: config.contractAddress,
      rpcUrl: config.rpcUrl || 'http://localhost:8545',
      network: config.network,
      abi: config.abi
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load contract config: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
