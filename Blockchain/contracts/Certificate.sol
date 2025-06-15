// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Certificate {
    struct Cert {
        bytes32 studentID;
        bytes32 studentName;
        bytes32 certificateName;
        uint issueDate;
        bytes32 issuedBy;
        bytes32 graduationGrade;
        bytes32 certificateHash;
        uint timestamp;
    }

    mapping(bytes32 => Cert) public certificates;
    mapping(bytes32 => bytes32) public hashToStudent;

    event CertificateAdded(
        bytes32 studentID,
        bytes32 studentName,
        bytes32 certificateName,
        uint issueDate,
        bytes32 issuedBy,
        bytes32 graduationGrade,
        bytes32 certificateHash,
        uint timestamp
    );

    function studentToHash(bytes32 _studentID) public view returns (bytes32) {
        return certificates[_studentID].certificateHash;
    }

    function _generateCertificateHash(
        bytes32 _studentID,
        bytes32 _studentName,
        bytes32 _certificateName,
        uint _issueDate,
        bytes32 _issuedBy,
        bytes32 _graduationGrade
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade
        ));
    }

    function addCertificate(
        bytes32 _studentID,
        bytes32 _studentName,
        bytes32 _certificateName,
        uint _issueDate,
        bytes32 _issuedBy,
        bytes32 _graduationGrade
    ) public {
        require(_studentID != bytes32(0), "Student ID cannot be empty");
        require(_studentName != bytes32(0), "Student name cannot be empty");
        require(_certificateName != bytes32(0), "Certificate name cannot be empty");
        require(_issueDate > 0, "Issue date must be valid");
        require(_issuedBy != bytes32(0), "Issued by cannot be empty");
        require(_graduationGrade != bytes32(0), "Graduation grade cannot be empty");

        require(certificates[_studentID].studentID == bytes32(0), "Certificate for this student ID already exists");

        bytes32 certificateHash = _generateCertificateHash(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade
        );

        require(hashToStudent[certificateHash] == bytes32(0), "Certificate hash already exists for another student");

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

    function verifyCertificate(bytes32 _studentID, bytes32 _certificateHash) public view returns (bool) {
        Cert memory cert = certificates[_studentID];
        return cert.certificateHash == _certificateHash;
    }

    function getCertificate(bytes32 _studentID) public view returns (
        bytes32,
        bytes32,
        bytes32,
        uint,
        bytes32,
        bytes32,
        bytes32,
        uint
    ) {
        Cert memory cert = certificates[_studentID];
        require(cert.studentID != bytes32(0), "Certificate not found");
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

    function certificateExists(bytes32 _studentID) public view returns (bool) {
        return certificates[_studentID].studentID != bytes32(0);
    }

    function getCertificateInfo(bytes32 _studentID) public view returns (
        string memory studentID,
        string memory studentName,
        string memory certificateName,
        uint issueDate,
        string memory issuedBy,
        string memory graduationGrade,
        bytes32 certificateHash,
        uint timestamp
    ) {
        Cert memory cert = certificates[_studentID];
        require(cert.studentID != bytes32(0), "Certificate not found");
        
        return (
            _bytes32ToString(cert.studentID),
            _bytes32ToString(cert.studentName),
            _bytes32ToString(cert.certificateName),
            cert.issueDate,
            _bytes32ToString(cert.issuedBy),
            _bytes32ToString(cert.graduationGrade),
            cert.certificateHash,
            cert.timestamp
        );
    }

    function _bytes32ToString(bytes32 _bytes) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes[i] != 0; i++) {
            bytesArray[i] = _bytes[i];
        }
        return string(bytesArray);
    }
}
