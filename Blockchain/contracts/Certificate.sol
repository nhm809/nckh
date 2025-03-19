// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Smart contract để quản lý và xác minh bằng cấp
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

    // Ánh xạ mã số sinh viên với thông tin bằng cấp
    mapping(string => Cert) public certificates;

    // Ánh xạ từ certificateHash đến studentID để kiểm tra tính duy nhất của certificateHash
    mapping(string => string) public hashToStudent;

    // Sự kiện được phát ra khi một bằng cấp mới được thêm
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

    // Thêm một bằng cấp mới vào Blockchain
    function addCertificate(
        string memory _studentID,
        string memory _studentName,
        string memory _certificateName,
        uint _issueDate,
        string memory _issuedBy,
        string memory _graduationGrade,
        string memory _certificateHash
    ) public {
        // Kiểm tra đầu vào
        require(bytes(_studentID).length > 0, "Student ID cannot be empty");
        require(bytes(_studentName).length > 0, "Student name cannot be empty");
        require(bytes(_certificateName).length > 0, "Certificate name cannot be empty");
        require(_issueDate > 0, "Issue date must be valid");
        require(bytes(_issuedBy).length > 0, "Issued by cannot be empty");
        require(bytes(_graduationGrade).length > 0, "Graduation grade cannot be empty");
        require(bytes(_certificateHash).length > 0, "Certificate hash cannot be empty");

        // Kiểm tra nếu mã sinh viên đã tồn tại
        require(bytes(certificates[_studentID].studentID).length == 0, "Certificate for this student ID already exists");

        // Kiểm tra nếu certificateHash đã được sử dụng bởi một sinh viên khác
        require(bytes(hashToStudent[_certificateHash]).length == 0, "Certificate hash already exists for another student");

        // Lưu thông tin bằng cấp vào mapping
        certificates[_studentID] = Cert(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade,
            _certificateHash,
            block.timestamp
        );

        // Lưu ánh xạ certificateHash -> studentID để kiểm tra tính duy nhất
        hashToStudent[_certificateHash] = _studentID;

        // Phát ra sự kiện để thông báo
        emit CertificateAdded(
            _studentID,
            _studentName,
            _certificateName,
            _issueDate,
            _issuedBy,
            _graduationGrade,
            _certificateHash,
            block.timestamp
        );
    }

    // Xác minh tính hợp lệ của một bằng cấp
    function verifyCertificate(string memory _studentID, string memory _certificateHash) public view returns (bool) {
        // Lấy thông tin bằng cấp từ mapping
        Cert memory cert = certificates[_studentID];

        // So sánh hash được cung cấp với hash lưu trên Blockchain
        return keccak256(abi.encodePacked(cert.certificateHash)) == keccak256(abi.encodePacked(_certificateHash));
    }

    // Lấy thông tin bằng cấp
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