// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HeritageRegistry
 * @notice Immutable provenance anchors for the LegacyChain heritage vault.
 *
 * PRIVACY: no family content ever reaches this contract. Only hashes are
 * stored — the SHA-256 fingerprint of the original file, a hash of its
 * post-quantum signature, and the identifier of the parent record. Names,
 * stories, photographs and locations stay in the family's private vault.
 *
 * IMMUTABILITY: a record can be written once and can never be updated or
 * deleted. A transformed version of a heritage item is registered as a
 * NEW record that points back at its parent, so an AI-restored photograph
 * adds to the chain instead of replacing the original.
 */
contract HeritageRegistry {
    struct Record {
        bytes32 fileHash;
        bytes32 pqcSignatureHash;
        bytes32 parentRecordId;
        address guardian;
        uint64 timestamp;
        bool isDerived;
        bool exists;
    }

    mapping(bytes32 => Record) private _records;

    /// @dev Number of records anchored, for cheap indexing off-chain.
    uint256 public recordCount;

    event HeritageRegistered(
        bytes32 indexed recordId,
        bytes32 indexed parentRecordId,
        address indexed guardian,
        bytes32 fileHash,
        bytes32 pqcSignatureHash,
        bool isDerived,
        uint64 timestamp
    );

    event HeritageAttested(
        bytes32 indexed recordId,
        address indexed attester,
        bytes32 attestationHash,
        uint64 timestamp
    );

    error RecordAlreadyExists(bytes32 recordId);
    error RecordNotFound(bytes32 recordId);
    error ParentNotFound(bytes32 parentRecordId);
    error InvalidRecordId();

    /**
     * @notice Anchors a heritage record. Write-once.
     * @param recordId Unique id — keccak256 of the canonical record payload.
     * @param fileHash SHA-256 fingerprint of the original file bytes.
     * @param pqcSignatureHash keccak256 of the ML-DSA post-quantum signature.
     * @param parentRecordId The record this was derived from, or 0 for an original.
     */
    function register(
        bytes32 recordId,
        bytes32 fileHash,
        bytes32 pqcSignatureHash,
        bytes32 parentRecordId
    ) external {
        if (recordId == bytes32(0)) revert InvalidRecordId();
        if (_records[recordId].exists) revert RecordAlreadyExists(recordId);

        bool isDerived = parentRecordId != bytes32(0);
        // A derived record must point at something that is already anchored,
        // so a chain can never reference history that does not exist.
        if (isDerived && !_records[parentRecordId].exists) {
            revert ParentNotFound(parentRecordId);
        }

        _records[recordId] = Record({
            fileHash: fileHash,
            pqcSignatureHash: pqcSignatureHash,
            parentRecordId: parentRecordId,
            guardian: msg.sender,
            timestamp: uint64(block.timestamp),
            isDerived: isDerived,
            exists: true
        });
        recordCount += 1;

        emit HeritageRegistered(
            recordId,
            parentRecordId,
            msg.sender,
            fileHash,
            pqcSignatureHash,
            isDerived,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Records that a human vouched for a heritage record.
     * @dev Only the hash of the attestation is anchored; the statement
     *      itself stays in the private vault.
     */
    function attest(bytes32 recordId, bytes32 attestationHash) external {
        if (!_records[recordId].exists) revert RecordNotFound(recordId);
        emit HeritageAttested(
            recordId,
            msg.sender,
            attestationHash,
            uint64(block.timestamp)
        );
    }

    function getRecord(bytes32 recordId) external view returns (Record memory) {
        Record memory record = _records[recordId];
        if (!record.exists) revert RecordNotFound(recordId);
        return record;
    }

    function exists(bytes32 recordId) external view returns (bool) {
        return _records[recordId].exists;
    }

    /**
     * @notice Confirms a file's fingerprint matches what was anchored.
     * @dev This is the on-chain half of "is this the exact original file?".
     */
    function verifyFileHash(bytes32 recordId, bytes32 fileHash)
        external
        view
        returns (bool)
    {
        Record memory record = _records[recordId];
        return record.exists && record.fileHash == fileHash;
    }
}
