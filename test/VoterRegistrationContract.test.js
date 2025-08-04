const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VoterRegistrationContract - Simple Tests", function () {
  let registrationContract;
  let voterRegistrationContract;
  let owner, electionAuthority, voter1, voter2, voter3;
  let electionId, candidates, randomChallenge;

  beforeEach(async function () {
    // Get signers
    [owner, electionAuthority, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy RegistrationContract first
    const RegistrationContract = await ethers.getContractFactory("RegistrationContract");
    registrationContract = await RegistrationContract.deploy(electionAuthority.address);

    // Deploy VoterRegistrationContract
    const VoterRegistrationContract = await ethers.getContractFactory("VoterRegistrationContract");
    voterRegistrationContract = await VoterRegistrationContract.deploy(registrationContract.target);

    // Setup test data
    electionId = ethers.keccak256(ethers.toUtf8Bytes("ELECTION_2025"));
    candidates = [
      ethers.keccak256(ethers.toUtf8Bytes("ALICE")),
      ethers.keccak256(ethers.toUtf8Bytes("BOB"))
    ];
    randomChallenge = ethers.keccak256(ethers.toUtf8Bytes("CHALLENGE_2025"));

    // Setup election in RegistrationContract
    await registrationContract.connect(electionAuthority).storePollParams(
      electionId,
      candidates,
      randomChallenge
    );
  });

  // Test 1: Basic Deployment
  describe("Deployment", function () {
    it("Should deploy with correct registration contract address", async function () {
      expect(await voterRegistrationContract.registrationContract()).to.equal(registrationContract.target);
      expect(await voterRegistrationContract.voterCount()).to.equal(0);
    });

    it("Should revert with invalid registration contract address", async function () {
      const VoterRegistrationContract = await ethers.getContractFactory("VoterRegistrationContract");
      await expect(
        VoterRegistrationContract.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid registration contract address");
    });
  });

  // Test 2: Voter Registration
  describe("Voter Registration", function () {
    it("Should register voter with valid LSAG signature", async function () {
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      const voterIndex = await voterRegistrationContract.connect(voter1).verify(
        lsagSignature,
        votingPublicKey
      );

      expect(await voterRegistrationContract.voterCount()).to.equal(1);
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
    });

    it("Should assign sequential voter indices", async function () {
      const lsagSig1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
      const votingKey1 = "0x1111111111111111111111111111111111111111";

      const lsagSig2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
      const votingKey2 = "0x2222222222222222222222222222222222222222";

      await voterRegistrationContract.connect(voter1).verify(lsagSig1, votingKey1);
      await voterRegistrationContract.connect(voter2).verify(lsagSig2, votingKey2);

      expect(await voterRegistrationContract.voterCount()).to.equal(2);
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
      expect(await voterRegistrationContract.isRegistered(1)).to.equal(true);
    });

    it("Should prevent double registration with same key image", async function () {
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingKey1 = "0xabcdef1234567890abcdef1234567890abcdef12";
      const votingKey2 = "0xfedcba0987654321fedcba0987654321fedcba09";

      // First registration should succeed
      await voterRegistrationContract.connect(voter1).verify(lsagSignature, votingKey1);

      // Second registration with same LSAG signature (same key image) should fail
      await expect(
        voterRegistrationContract.connect(voter2).verify(lsagSignature, votingKey2)
      ).to.be.revertedWith("Double registration attempt detected");
    });

    it("Should reject empty LSAG signature", async function () {
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await expect(
        voterRegistrationContract.connect(voter1).verify("0x", votingPublicKey)
      ).to.be.revertedWith("LSAG signature cannot be empty");
    });

    it("Should reject empty voting public key", async function () {
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      await expect(
        voterRegistrationContract.connect(voter1).verify(lsagSignature, "0x")
      ).to.be.revertedWith("Voting public key cannot be empty");
    });

    it("Should require election to be setup", async function () {
      // Deploy new contracts without election setup
      const newRegistrationContract = await ethers.getContractFactory("RegistrationContract");
      const newRegContract = await newRegistrationContract.deploy(electionAuthority.address);

      const newVoterRegistrationContract = await ethers.getContractFactory("VoterRegistrationContract");
      const newVoterRegContract = await newVoterRegistrationContract.deploy(newRegContract.target);

      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await expect(
        newVoterRegContract.connect(voter1).verify(lsagSignature, votingPublicKey)
      ).to.be.revertedWith("Election not setup yet");
    });
  });

  // Test 3: Registration Status Check
  describe("Registration Status", function () {
    beforeEach(async function () {
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";
      await voterRegistrationContract.connect(voter1).verify(lsagSignature, votingPublicKey);
    });

    it("Should return true for registered voter", async function () {
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
    });

    it("Should return false for non-registered voter index", async function () {
      expect(await voterRegistrationContract.isRegistered(999)).to.equal(false);
    });

    it("Should return correct voter count", async function () {
      expect(await voterRegistrationContract.getVoterCount()).to.equal(1);

      // Register another voter
      const lsagSig2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
      const votingKey2 = "0x2222222222222222222222222222222222222222";
      await voterRegistrationContract.connect(voter2).verify(lsagSig2, votingKey2);

      expect(await voterRegistrationContract.getVoterCount()).to.equal(2);
    });
  });

  // Test 4: Voter Record Retrieval
  describe("Voter Record Retrieval", function () {
    let lsagSignature, votingPublicKey;

    beforeEach(async function () {
      lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";
      await voterRegistrationContract.connect(voter1).verify(lsagSignature, votingPublicKey);
    });

    it("Should return correct voter record", async function () {
      const voterRecord = await voterRegistrationContract.getVoterRecord(0);
      
      expect(voterRecord.lsagSignature).to.equal(lsagSignature);
      expect(voterRecord.votingPublicKey).to.equal(votingPublicKey);
      expect(voterRecord.isRegistered).to.equal(true);
      expect(voterRecord.registrationTime).to.be.greaterThan(0);
    });

    it("Should revert for invalid voter index", async function () {
      await expect(
        voterRegistrationContract.getVoterRecord(999)
      ).to.be.revertedWith("Invalid voter index");
    });
  });

  // Test 5: Key Image Tracking
  describe("Key Image Tracking", function () {
    it("Should track used key images", async function () {
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      // Extract key image (first 32 bytes of LSAG signature)
      const keyImage = lsagSignature.slice(0, 66); // 0x + 32 bytes = 66 chars

      // Before registration, key image should not be used
      expect(await voterRegistrationContract.isKeyImageUsed(keyImage)).to.equal(false);

      // Register voter
      await voterRegistrationContract.connect(voter1).verify(lsagSignature, votingPublicKey);

      // After registration, key image should be marked as used
      expect(await voterRegistrationContract.isKeyImageUsed(keyImage)).to.equal(true);
    });
  });

  // Test 6: Registration Statistics
  describe("Registration Statistics", function () {
    it("Should return correct registration statistics", async function () {
      // Initial state
      let [totalRegistered, registrationOpen] = await voterRegistrationContract.getRegistrationStats();
      expect(totalRegistered).to.equal(0);
      expect(registrationOpen).to.equal(true); // Election is setup

      // Register voters
      const lsagSig1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
      const votingKey1 = "0x1111111111111111111111111111111111111111";
      await voterRegistrationContract.connect(voter1).verify(lsagSig1, votingKey1);

      const lsagSig2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
      const votingKey2 = "0x2222222222222222222222222222222222222222";
      await voterRegistrationContract.connect(voter2).verify(lsagSig2, votingKey2);

      // Check updated statistics
      [totalRegistered, registrationOpen] = await voterRegistrationContract.getRegistrationStats();
      expect(totalRegistered).to.equal(2);
      expect(registrationOpen).to.equal(true);
    });
  });

  // Test 7: Multiple Voters Registration
  describe("Multiple Voters Registration", function () {
    it("Should handle multiple voter registrations correctly", async function () {
      const voters = [
        {
          lsagSignature: "0x1111111111111111111111111111111111111111111111111111111111111111",
          votingPublicKey: "0x1111111111111111111111111111111111111111"
        },
        {
          lsagSignature: "0x2222222222222222222222222222222222222222222222222222222222222222",
          votingPublicKey: "0x2222222222222222222222222222222222222222"
        },
        {
          lsagSignature: "0x3333333333333333333333333333333333333333333333333333333333333333",
          votingPublicKey: "0x3333333333333333333333333333333333333333"
        }
      ];

      // Register all voters
      for (let i = 0; i < voters.length; i++) {
        await voterRegistrationContract.connect(voter1).verify(
          voters[i].lsagSignature,
          voters[i].votingPublicKey
        );
      }

      // Verify all registrations
      expect(await voterRegistrationContract.voterCount()).to.equal(3);
      
      for (let i = 0; i < voters.length; i++) {
        expect(await voterRegistrationContract.isRegistered(i)).to.equal(true);
        
        const record = await voterRegistrationContract.getVoterRecord(i);
        expect(record.lsagSignature).to.equal(voters[i].lsagSignature);
        expect(record.votingPublicKey).to.equal(voters[i].votingPublicKey);
        expect(record.isRegistered).to.equal(true);
      }
    });
  });

  // Test 8: Integration with RegistrationContract
  describe("Integration with RegistrationContract", function () {
    it("Should properly reference RegistrationContract", async function () {
      expect(await voterRegistrationContract.registrationContract()).to.equal(registrationContract.target);
    });

    it("Should work when election parameters change", async function () {
      // Reset and setup new election
      await registrationContract.connect(electionAuthority).resetElectionSetup();
      
      const newElectionId = ethers.keccak256(ethers.toUtf8Bytes("ELECTION_2026"));
      const newCandidates = [ethers.keccak256(ethers.toUtf8Bytes("CHARLIE"))];
      const newChallenge = ethers.keccak256(ethers.toUtf8Bytes("CHALLENGE_2026"));

      await registrationContract.connect(electionAuthority).storePollParams(
        newElectionId,
        newCandidates,
        newChallenge
      );

      // Should be able to register voters with new election
      const lsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await voterRegistrationContract.connect(voter1).verify(lsagSignature, votingPublicKey);
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
    });
  });

  // Test 9: Edge Cases
  describe("Edge Cases", function () {
    it("Should handle maximum length signatures", async function () {
      // Create maximum length signature (assuming reasonable limits)
      const maxLsagSignature = "0x" + "a".repeat(512); // 256 bytes
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await voterRegistrationContract.connect(voter1).verify(maxLsagSignature, votingPublicKey);
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
    });

    it("Should handle minimum valid signature length", async function () {
      // Minimum signature should be at least 32 bytes for key image extraction
      const minLsagSignature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await voterRegistrationContract.connect(voter1).verify(minLsagSignature, votingPublicKey);
      expect(await voterRegistrationContract.isRegistered(0)).to.equal(true);
    });

    it("Should reject LSAG signature shorter than 32 bytes", async function () {
      const shortLsagSignature = "0x1234567890abcdef"; // Only 8 bytes
      const votingPublicKey = "0xabcdef1234567890abcdef1234567890abcdef12";

      await expect(
        voterRegistrationContract.connect(voter1).verify(shortLsagSignature, votingPublicKey)
      ).to.be.revertedWith("Invalid LSAG signature length");
    });
  });
});
