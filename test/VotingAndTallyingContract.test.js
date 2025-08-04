const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingAndTallyingContract", function () {
    let registrationContract;
    let voterRegistrationContract;
    let votingAndTallyingContract;
    let owner;
    let authority;
    let voter1;
    let voter2;
    let voter3;
    let addrs;

    // Test data
    const electionId = ethers.keccak256(ethers.toUtf8Bytes("TestElection2024"));
    const candidates = [
        ethers.keccak256(ethers.toUtf8Bytes("Candidate1")),
        ethers.keccak256(ethers.toUtf8Bytes("Candidate2")),
        ethers.keccak256(ethers.toUtf8Bytes("Candidate3"))
    ];

    beforeEach(async function () {
        [owner, authority, voter1, voter2, voter3, ...addrs] = await ethers.getSigners();

        // Deploy RegistrationContract
        const RegistrationContract = await ethers.getContractFactory("RegistrationContract");
        registrationContract = await RegistrationContract.deploy(authority.address);

        // Deploy VoterRegistrationContract
        const VoterRegistrationContract = await ethers.getContractFactory("VoterRegistrationContract");
        voterRegistrationContract = await VoterRegistrationContract.deploy(
            registrationContract.target
        );

        // Deploy VotingAndTallyingContract
        const VotingAndTallyingContract = await ethers.getContractFactory("VotingAndTallyingContract");
        votingAndTallyingContract = await VotingAndTallyingContract.deploy(
            voterRegistrationContract.target,
            registrationContract.target
        );

        // Setup election
        await registrationContract.connect(authority).storePollParams(
            electionId,
            candidates,
            ethers.keccak256(ethers.toUtf8Bytes("random_challenge"))
        );

        // Register some voters directly (no certificates needed)
        const lsagSig1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
        const lsagSig2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
        const lsagSig3 = "0x3333333333333333333333333333333333333333333333333333333333333333";
        
        const votingPubKey1 = "0x1111111111111111111111111111111111111111";
        const votingPubKey2 = "0x2222222222222222222222222222222222222222";
        const votingPubKey3 = "0x3333333333333333333333333333333333333333";

        await voterRegistrationContract.verify(lsagSig1, votingPubKey1);
        await voterRegistrationContract.verify(lsagSig2, votingPubKey2);
        await voterRegistrationContract.verify(lsagSig3, votingPubKey3);
    });

    describe("Deployment", function () {
        it("Should deploy with correct contract addresses", async function () {
            expect(await votingAndTallyingContract.voterRegistrationContract())
                .to.equal(voterRegistrationContract.target);
            expect(await votingAndTallyingContract.registrationContract())
                .to.equal(registrationContract.target);
        });

        it("Should initialize with correct default state", async function () {
            expect(await votingAndTallyingContract.votingPhaseActive()).to.be.false;
            expect(await votingAndTallyingContract.tallyingPhaseActive()).to.be.false;
            expect(await votingAndTallyingContract.resultsFinalized()).to.be.false;
            expect(await votingAndTallyingContract.totalVotesCast()).to.equal(0);
            expect(await votingAndTallyingContract.totalVotesTallied()).to.equal(0);
        });

        it("Should reject deployment with zero addresses", async function () {
            const VotingAndTallyingContract = await ethers.getContractFactory("VotingAndTallyingContract");
            
            await expect(VotingAndTallyingContract.deploy(
                ethers.ZeroAddress,
                registrationContract.target
            )).to.be.revertedWith("Invalid voter registration contract");

            await expect(VotingAndTallyingContract.deploy(
                voterRegistrationContract.target,
                ethers.ZeroAddress
            )).to.be.revertedWith("Invalid registration contract");
        });
    });

    describe("Phase Management", function () {
        it("Should start voting phase successfully", async function () {
            await expect(votingAndTallyingContract.connect(authority).startVotingPhase())
                .to.emit(votingAndTallyingContract, "PhaseChanged")
                .withArgs("voting", true);

            expect(await votingAndTallyingContract.votingPhaseActive()).to.be.true;
            expect(await votingAndTallyingContract.tallyingPhaseActive()).to.be.false;
        });

        it("Should reject starting voting phase without proper setup", async function () {
            // Reset election setup
            await registrationContract.connect(authority).resetElectionSetup();
            
            await expect(votingAndTallyingContract.connect(authority).startVotingPhase())
                .to.be.revertedWith("Election not setup");
        });

        it("Should reject starting voting phase from non-authority", async function () {
            await expect(votingAndTallyingContract.connect(voter1).startVotingPhase())
                .to.be.revertedWith("Only election authority can call this function");
        });

        it("Should transition from voting to tallying phase", async function () {
            await votingAndTallyingContract.connect(authority).startVotingPhase();
            
            await expect(votingAndTallyingContract.connect(authority).startTallyingPhase())
                .to.emit(votingAndTallyingContract, "PhaseChanged")
                .withArgs("voting", false)
                .and.to.emit(votingAndTallyingContract, "PhaseChanged")
                .withArgs("tallying", true);

            expect(await votingAndTallyingContract.votingPhaseActive()).to.be.false;
            expect(await votingAndTallyingContract.tallyingPhaseActive()).to.be.true;
        });

        it("Should finalize results successfully", async function () {
            await votingAndTallyingContract.connect(authority).startVotingPhase();
            await votingAndTallyingContract.connect(authority).startTallyingPhase();
            
            await expect(votingAndTallyingContract.connect(authority).finalizeResults())
                .to.emit(votingAndTallyingContract, "PhaseChanged")
                .withArgs("tallying", false)
                .and.to.emit(votingAndTallyingContract, "ResultsFinalized");

            expect(await votingAndTallyingContract.tallyingPhaseActive()).to.be.false;
            expect(await votingAndTallyingContract.resultsFinalized()).to.be.true;
        });

        it("Should reject invalid phase transitions", async function () {
            // Try to start tallying without voting
            await expect(votingAndTallyingContract.connect(authority).startTallyingPhase())
                .to.be.revertedWith("Voting phase must be active first");

            // Try to finalize without tallying
            await expect(votingAndTallyingContract.connect(authority).finalizeResults())
                .to.be.revertedWith("Tallying phase must be active");
        });
    });

    describe("Vote Casting", function () {
        beforeEach(async function () {
            await votingAndTallyingContract.connect(authority).startVotingPhase();
        });

        it("Should cast vote successfully", async function () {
            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_1");
            const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote_hash_1"));
            const voterIndex = 0;

            await expect(votingAndTallyingContract.voting(signatureOnHash, voteHash, voterIndex))
                .to.emit(votingAndTallyingContract, "VoteCast")
                .withArgs(voterIndex, voteHash);

            expect(await votingAndTallyingContract.hasVoted(voterIndex)).to.be.true;
            expect(await votingAndTallyingContract.totalVotesCast()).to.equal(1);

            const voteRecord = await votingAndTallyingContract.votes(voterIndex);
            expect(voteRecord.voteSubmitted).to.be.true;
            expect(voteRecord.voteTallied).to.be.false;
            expect(voteRecord.voteHash).to.equal(voteHash);
        });

        it("Should reject vote from unregistered voter", async function () {
            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_999");
            const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote_hash_999"));
            const invalidVoterIndex = 999;

            await expect(votingAndTallyingContract.voting(signatureOnHash, voteHash, invalidVoterIndex))
                .to.be.revertedWith("Voter is not registered");
        });

        it("Should reject empty signature or hash", async function () {
            const voterIndex = 0;
            const validSignature = ethers.toUtf8Bytes("signature");
            const validHash = ethers.keccak256(ethers.toUtf8Bytes("hash"));

            await expect(votingAndTallyingContract.voting("0x", validHash, voterIndex))
                .to.be.revertedWith("Signature on hash cannot be empty");

            await expect(votingAndTallyingContract.voting(validSignature, ethers.ZeroHash, voterIndex))
                .to.be.revertedWith("Vote hash cannot be empty");
        });

        it("Should reject duplicate votes", async function () {
            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_1");
            const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote_hash_1"));
            const voterIndex = 0;

            // First vote should succeed
            await votingAndTallyingContract.voting(signatureOnHash, voteHash, voterIndex);

            // Second vote should fail
            await expect(votingAndTallyingContract.voting(signatureOnHash, voteHash, voterIndex))
                .to.be.revertedWith("Vote already submitted");
        });

        it("Should reject voting outside voting phase", async function () {
            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_1");
            const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote_hash_1"));
            const voterIndex = 0;

            // End voting phase
            await votingAndTallyingContract.connect(authority).startTallyingPhase();

            await expect(votingAndTallyingContract.voting(signatureOnHash, voteHash, voterIndex))
                .to.be.revertedWith("Voting phase is not active");
        });
    });

    describe("Vote Tallying", function () {
        let signatureOnHash1, voteHash1, actualVoteSignature1;
        let signatureOnHash2, voteHash2, actualVoteSignature2;

        beforeEach(async function () {
            // Start voting phase and cast some votes
            await votingAndTallyingContract.connect(authority).startVotingPhase();

            // Create vote signatures and hashes
            actualVoteSignature1 = ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig_1")]);
            actualVoteSignature2 = ethers.concat([candidates[1], ethers.toUtf8Bytes("vote_sig_2")]);
            
            voteHash1 = ethers.keccak256(ethers.concat([actualVoteSignature1, electionId]));
            voteHash2 = ethers.keccak256(ethers.concat([actualVoteSignature2, electionId]));
            
            signatureOnHash1 = ethers.toUtf8Bytes("signature_on_hash_1");
            signatureOnHash2 = ethers.toUtf8Bytes("signature_on_hash_2");

            // Cast votes
            await votingAndTallyingContract.voting(signatureOnHash1, voteHash1, 0);
            await votingAndTallyingContract.voting(signatureOnHash2, voteHash2, 1);

            // Start tallying phase
            await votingAndTallyingContract.connect(authority).startTallyingPhase();
        });

        it("Should tally vote successfully", async function () {
            await expect(votingAndTallyingContract.tally(actualVoteSignature1, 0))
                .to.emit(votingAndTallyingContract, "VoteTallied")
                .withArgs(0, candidates[0]);

            expect(await votingAndTallyingContract.isVoteTallied(0)).to.be.true;
            expect(await votingAndTallyingContract.totalVotesTallied()).to.equal(1);

            const voteRecord = await votingAndTallyingContract.votes(0);
            expect(voteRecord.voteTallied).to.be.true;
        });

        it("Should update tally results correctly", async function () {
            await votingAndTallyingContract.tally(actualVoteSignature1, 0);
            await votingAndTallyingContract.tally(actualVoteSignature2, 1);

            const [tallyCandidates, voteCounts] = await votingAndTallyingContract.getTallyResults();
            
            expect(tallyCandidates.length).to.equal(3);
            expect(voteCounts[0]).to.equal(1); // candidates[0] should have 1 vote
            expect(voteCounts[1]).to.equal(1); // candidates[1] should have 1 vote
            expect(voteCounts[2]).to.equal(0); // candidates[2] should have 0 votes
        });

        it("Should reject tallying vote with wrong hash", async function () {
            const wrongSignature = ethers.concat([candidates[0], ethers.toUtf8Bytes("wrong_sig")]);
            
            await expect(votingAndTallyingContract.tally(wrongSignature, 0))
                .to.be.revertedWith("Vote hash verification failed");
        });

        it("Should reject tallying unsubmitted vote", async function () {
            const voterIndex = 2; // Voter who hasn't cast a vote
            const actualVoteSignature = ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig")]);
            
            await expect(votingAndTallyingContract.tally(actualVoteSignature, voterIndex))
                .to.be.revertedWith("No vote submitted for this voter");
        });

        it("Should reject duplicate tallying", async function () {
            await votingAndTallyingContract.tally(actualVoteSignature1, 0);
            
            await expect(votingAndTallyingContract.tally(actualVoteSignature1, 0))
                .to.be.revertedWith("Vote already tallied");
        });

        it("Should reject tallying outside tallying phase", async function () {
            await votingAndTallyingContract.connect(authority).finalizeResults();
            
            await expect(votingAndTallyingContract.tally(actualVoteSignature1, 0))
                .to.be.revertedWith("Tallying phase is not active");
        });
    });

    describe("Statistics and State", function () {
        it("Should return correct voting statistics", async function () {
            const [totalRegistered, votesCast, votesTallied, currentPhase] = 
                await votingAndTallyingContract.getVotingStats();

            expect(totalRegistered).to.equal(3);
            expect(votesCast).to.equal(0);
            expect(votesTallied).to.equal(0);
            expect(currentPhase).to.equal("setup");
        });

        it("Should track phase changes in statistics", async function () {
            await votingAndTallyingContract.connect(authority).startVotingPhase();
            let [,, , phase] = await votingAndTallyingContract.getVotingStats();
            expect(phase).to.equal("voting");

            await votingAndTallyingContract.connect(authority).startTallyingPhase();
            [,, , phase] = await votingAndTallyingContract.getVotingStats();
            expect(phase).to.equal("tallying");

            await votingAndTallyingContract.connect(authority).finalizeResults();
            [,, , phase] = await votingAndTallyingContract.getVotingStats();
            expect(phase).to.equal("finalized");
        });

        it("Should correctly track vote and tally counts", async function () {
            await votingAndTallyingContract.connect(authority).startVotingPhase();

            // Cast a vote
            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_1");
            const actualVoteSignature = ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig_1")]);
            const voteHash = ethers.keccak256(ethers.concat([actualVoteSignature, electionId]));

            await votingAndTallyingContract.voting(signatureOnHash, voteHash, 0);

            let [, votesCast, votesTallied] = await votingAndTallyingContract.getVotingStats();
            expect(votesCast).to.equal(1);
            expect(votesTallied).to.equal(0);

            // Start tallying and tally the vote
            await votingAndTallyingContract.connect(authority).startTallyingPhase();
            await votingAndTallyingContract.tally(actualVoteSignature, 0);

            [, votesCast, votesTallied] = await votingAndTallyingContract.getVotingStats();
            expect(votesCast).to.equal(1);
            expect(votesTallied).to.equal(1);
        });

        it("Should correctly report vote status for individual voters", async function () {
            const voterIndex = 0;
            
            expect(await votingAndTallyingContract.hasVoted(voterIndex)).to.be.false;
            expect(await votingAndTallyingContract.isVoteTallied(voterIndex)).to.be.false;

            await votingAndTallyingContract.connect(authority).startVotingPhase();

            const signatureOnHash = ethers.toUtf8Bytes("signature_on_hash_1");
            const actualVoteSignature = ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig_1")]);
            const voteHash = ethers.keccak256(ethers.concat([actualVoteSignature, electionId]));

            await votingAndTallyingContract.voting(signatureOnHash, voteHash, voterIndex);

            expect(await votingAndTallyingContract.hasVoted(voterIndex)).to.be.true;
            expect(await votingAndTallyingContract.isVoteTallied(voterIndex)).to.be.false;

            await votingAndTallyingContract.connect(authority).startTallyingPhase();
            await votingAndTallyingContract.tally(actualVoteSignature, voterIndex);

            expect(await votingAndTallyingContract.hasVoted(voterIndex)).to.be.true;
            expect(await votingAndTallyingContract.isVoteTallied(voterIndex)).to.be.true;
        });
    });

    describe("Full Election Workflow", function () {
        it("Should complete full election workflow successfully", async function () {
            // Start voting phase
            await votingAndTallyingContract.connect(authority).startVotingPhase();

            // Create and cast votes for all three voters
            const actualVoteSignatures = [
                ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig_1")]),
                ethers.concat([candidates[1], ethers.toUtf8Bytes("vote_sig_2")]),
                ethers.concat([candidates[0], ethers.toUtf8Bytes("vote_sig_3")])
            ];

            const voteHashes = actualVoteSignatures.map(sig => 
                ethers.keccak256(ethers.concat([sig, electionId]))
            );

            const signaturesOnHash = [
                ethers.toUtf8Bytes("signature_on_hash_1"),
                ethers.toUtf8Bytes("signature_on_hash_2"),
                ethers.toUtf8Bytes("signature_on_hash_3")
            ];

            // Cast all votes
            for (let i = 0; i < 3; i++) {
                await votingAndTallyingContract.voting(signaturesOnHash[i], voteHashes[i], i);
            }

            expect(await votingAndTallyingContract.totalVotesCast()).to.equal(3);

            // Start tallying phase
            await votingAndTallyingContract.connect(authority).startTallyingPhase();

            // Tally all votes
            for (let i = 0; i < 3; i++) {
                await votingAndTallyingContract.tally(actualVoteSignatures[i], i);
            }

            expect(await votingAndTallyingContract.totalVotesTallied()).to.equal(3);

            // Check final results
            const [tallyCandidates, voteCounts] = await votingAndTallyingContract.getTallyResults();
            expect(voteCounts[0]).to.equal(2); // candidates[0] should have 2 votes
            expect(voteCounts[1]).to.equal(1); // candidates[1] should have 1 vote
            expect(voteCounts[2]).to.equal(0); // candidates[2] should have 0 votes

            // Finalize results
            await votingAndTallyingContract.connect(authority).finalizeResults();
            expect(await votingAndTallyingContract.resultsFinalized()).to.be.true;

            const [, , , finalPhase] = await votingAndTallyingContract.getVotingStats();
            expect(finalPhase).to.equal("finalized");
        });
    });

    describe("Access Control", function () {
        it("Should restrict authority-only functions", async function () {
            await expect(votingAndTallyingContract.connect(voter1).startVotingPhase())
                .to.be.revertedWith("Only election authority can call this function");

            await expect(votingAndTallyingContract.connect(voter1).startTallyingPhase())
                .to.be.revertedWith("Only election authority can call this function");

            await expect(votingAndTallyingContract.connect(voter1).finalizeResults())
                .to.be.revertedWith("Only election authority can call this function");
        });

        it("Should allow authority to perform all admin functions", async function () {
            await expect(votingAndTallyingContract.connect(authority).startVotingPhase())
                .to.not.be.reverted;

            await expect(votingAndTallyingContract.connect(authority).startTallyingPhase())
                .to.not.be.reverted;

            await expect(votingAndTallyingContract.connect(authority).finalizeResults())
                .to.not.be.reverted;
        });
    });
});
