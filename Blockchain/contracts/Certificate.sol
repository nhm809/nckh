// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Certificate {
    struct Cert {
        string studentID;
        string studentName;
        string certificateName;
        uint issueDate;
        string issuedBy;
        string graduationGrade;
        string certificateHash;
        uint timestamp;
    }

    mapping(string => Cert) public certificates;
    mapping(string => string) public hashToStudent;

    event CertificateAdded(
        string studentID,
        string studentName,
        string certificateName,
        uint issueDate,
        string issuedBy,
        string graduationGrade,
        string certificateHash,
        uint timestamp
    );

    function _generateCertificateHash(
        string memory _studentID,
        string memory _studentName,
        string memory _certificateName,
        uint _issueDate,
        string memory _issuedBy,
        string memory _graduationGrade
    ) internal pure returns (string memory) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                _studentID,
                _studentName,
                _certificateName,
                _issueDate,
                _issuedBy,
                _graduationGrade
            )
        );
        return string(abi.encodePacked("0x", bytes32ToHexString(hash)));
    }

    function bytes32ToHexString(bytes32 _bytes) internal pure returns (bytes memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(64);
        for (uint i = 0; i < 32; i++) {
            result[i * 2] = hexChars[uint8(_bytes[i] >> 4)];
            result[i * 2 + 1] = hexChars[uint8(_bytes[i] & 0x0f)];
        }
        return result;
    }

    function addCertificate(
        string memory _studentID,
        string memory _studentName,
        string memory _certificateName,
        uint _issueDate,
        string memory _issuedBy,
        string memory _graduationGrade
    ) public {
        require(bytes(_studentID).length > 0, "Student ID cannot be empty");
        require(bytes(_studentName).length > 0, "Student name cannot be empty");
        require(bytes(_certificateName).length > 0, "Certificate name cannot be empty");
        require(_issueDate > 0, "Issue date must be valid");
        require(bytes(_issuedBy).length > 0, "Issued by cannot be empty");
        require(bytes(_graduationGrade).length > 0, "Graduation grade cannot be empty");

        require(bytes(certificates[_studentID].studentID).length == 0, "Certificate for this student ID already exists");

        string memory certificateHash = _generateCertificateHash(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade
        );

        require(bytes(hashToStudent[certificateHash]).length == 0, "Certificate hash already exists for another student");

        certificates[_studentID] = Cert(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade,
            certificateHash,
            block.timestamp
        );

        hashToStudent[certificateHash] = _studentID;

        emit CertificateAdded(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade,
            certificateHash,
            block.timestamp
        );
    }

    function verifyCertificate(string memory _studentID, string memory _certificateHash) public view returns (bool) {
        Cert memory cert = certificates[_studentID];
        return keccak256(abi.encodePacked(cert.certificateHash)) == keccak256(abi.encodePacked(_certificateHash));
    }

    function getCertificate(string memory _studentID) public view returns (
        string memory,
        string memory,
        string memory,
        uint,
        string memory,
        string memory,
        string memory,
        uint
    ) {
        Cert memory cert = certificates[_studentID];
        require(bytes(cert.studentID).length > 0, "Certificate not found");
        return (
            cert.studentID,
            cert.studentName,
            cert.certificateName,
            cert.issueDate,
            cert.issuedBy,
            cert.graduationGrade,
            cert.certificateHash,
            cert.timestamp
        );
    }
}