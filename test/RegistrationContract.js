const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RegistrationContract - Simple Tests", function () {
  let registrationContract;
  let owner, electionAuthority, voter1, voter2;
  let electionId, candidates, randomChallenge;

  beforeEach(async function () {
    // Get signers
    [owner, electionAuthority, voter1, voter2] = await ethers.getSigners();

    // Deploy RegistrationContract
    const RegistrationContract = await ethers.getContractFactory("RegistrationContract");
    registrationContract = await RegistrationContract.deploy(electionAuthority.address);

    // Setup test data
    electionId = ethers.keccak256(ethers.toUtf8Bytes("ELECTION_2025"));
    candidates = [
      ethers.keccak256(ethers.toUtf8Bytes("ALICE")),
      ethers.keccak256(ethers.toUtf8Bytes("BOB"))
    ];
    randomChallenge = ethers.keccak256(ethers.toUtf8Bytes("CHALLENGE_2025"));
  });

  // Test 1: Basic Deployment
  describe("Deployment", function () {
    it("Should deploy with correct election authority", async function () {
      expect(await registrationContract.electionAuthority()).to.equal(electionAuthority.address);
      expect(await registrationContract.electionSetup()).to.equal(false);
    });
  });

  // Test 2: Election Setup
  describe("Election Setup", function () {
    it("Should setup election parameters", async function () {
      await registrationContract.connect(electionAuthority).storePollParams(
        electionId,
        candidates,
        randomChallenge
      );

      expect(await registrationContract.electionSetup()).to.equal(true);
      expect(await registrationContract.electionId()).to.equal(electionId);
      
      const storedCandidates = await registrationContract.getCandidates();
      expect(storedCandidates.length).to.equal(2);
    });

    it("Should reject setup from non-authority", async function () {
      await expect(
        registrationContract.connect(voter1).storePollParams(electionId, candidates, randomChallenge)
      ).to.be.revertedWith("Only election authority can call this function");
    });
  });

  // Test 3: Certificate Storage
  describe("Certificate Storage", function () {
    it("Should store valid certificate", async function () {
      const certificate = {
        governmentSignature: "0x1234567890abcdef",
        governmentPublicKey: "0xabcdef1234567890",
        voterPublicKey: "0x9876543210fedcba"
      };

      await registrationContract.connect(voter1).storePub(certificate);
      expect(await registrationContract.isCertified(certificate.voterPublicKey)).to.equal(true);
    });

    it("Should reject duplicate certificates", async function () {
      const certificate = {
        governmentSignature: "0x1234567890abcdef",
        governmentPublicKey: "0xabcdef1234567890",
        voterPublicKey: "0x9876543210fedcba"
      };

      await registrationContract.connect(voter1).storePub(certificate);
      await expect(
        registrationContract.connect(voter1).storePub(certificate)
      ).to.be.revertedWith("Public key already certified");
    });

    it("Should reject empty certificate data", async function () {
      const invalidCert = {
        governmentSignature: "0x",
        governmentPublicKey: "0xabcdef1234567890",
        voterPublicKey: "0x9876543210fedcba"
      };

      await expect(
        registrationContract.connect(voter1).storePub(invalidCert)
      ).to.be.revertedWith("Government signature cannot be empty");
    });
  });

  // Test 4: Certificate Verification
  describe("Certificate Verification", function () {
    it("Should verify certified keys", async function () {
      const certificate = {
        governmentSignature: "0x1234567890abcdef",
        governmentPublicKey: "0xabcdef1234567890",
        voterPublicKey: "0x9876543210fedcba"
      };

      // Before storage
      expect(await registrationContract.isCertified(certificate.voterPublicKey)).to.equal(false);

      // After storage
      await registrationContract.connect(voter1).storePub(certificate);
      expect(await registrationContract.isCertified(certificate.voterPublicKey)).to.equal(true);
    });
  });

  // Test 5: Authority Management
  describe("Authority Management", function () {
    it("Should update election authority", async function () {
      await registrationContract.connect(electionAuthority).updateElectionAuthority(voter1.address);
      expect(await registrationContract.electionAuthority()).to.equal(voter1.address);
    });

    it("Should reject authority update from non-authority", async function () {
      await expect(
        registrationContract.connect(voter1).updateElectionAuthority(voter2.address)
      ).to.be.revertedWith("Only election authority can call this function");
    });
  });

  // Test 6: Reset Functionality
  describe("Reset Election", function () {
    it("Should reset election setup", async function () {
      // Setup election first
      await registrationContract.connect(electionAuthority).storePollParams(
        electionId,
        candidates,
        randomChallenge
      );
      expect(await registrationContract.electionSetup()).to.equal(true);

      // Reset election
      await registrationContract.connect(electionAuthority).resetElectionSetup();
      expect(await registrationContract.electionSetup()).to.equal(false);
      expect(await registrationContract.electionId()).to.equal(ethers.ZeroHash);
    });
  });

  // Test 7: Complete Workflow
  describe("Complete Workflow", function () {
    it("Should complete full registration workflow", async function () {
      // 1. Setup election
      await registrationContract.connect(electionAuthority).storePollParams(
        electionId,
        candidates,
        randomChallenge
      );

      // 2. Store certificates for multiple voters
      const cert1 = {
        governmentSignature: "0x1111111111111111",
        governmentPublicKey: "0xaaaaaaaaaaaaaaaa",
        voterPublicKey: "0x1a1a1a1a1a1a1a1a"
      };

      const cert2 = {
        governmentSignature: "0x2222222222222222",
        governmentPublicKey: "0xbbbbbbbbbbbbbbbb",
        voterPublicKey: "0x2b2b2b2b2b2b2b2b"
      };

      await registrationContract.connect(voter1).storePub(cert1);
      await registrationContract.connect(voter2).storePub(cert2);

      // 3. Verify all components
      expect(await registrationContract.electionSetup()).to.equal(true);
      expect(await registrationContract.isCertified(cert1.voterPublicKey)).to.equal(true);
      expect(await registrationContract.isCertified(cert2.voterPublicKey)).to.equal(true);
      
      const storedCandidates = await registrationContract.getCandidates();
      expect(storedCandidates.length).to.equal(2);
    });
  });
});

