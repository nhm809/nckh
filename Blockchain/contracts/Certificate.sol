// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Smart contract để quản lý và xác minh bằng cấp
contract Certificate {
    struct Cert {
        string studentID;      
        string certificateHash;  
        uint timestamp;        
    }

    // Ánh xạ mã số sinh viên với thông tin bằng cấp
    mapping(string => Cert) public certificates;

    // Sự kiện được phát ra khi một bằng cấp mới được thêm
    event CertificateAdded(string studentID, string certificateHash, uint timestamp);

    // thêm một bằng cấp mới vào Blockchain
    function addCertificate(string memory _studentID, string memory _certificateHash) public {
        // Kiểm tra nếu mã sinh viên đã tồn tại
        require(bytes(certificates[_studentID].studentID).length == 0, "Certificate for this student ID already exists");

        // Lưu thông tin bằng cấp vào mapping
        certificates[_studentID] = Cert(_studentID, _certificateHash, block.timestamp);

        // Phát ra sự kiện để thông báo
        emit CertificateAdded(_studentID, _certificateHash, block.timestamp);
    }

    // xác minh tính hợp lệ của một bằng cấp
    function verifyCertificate(string memory _studentID, string memory _certificateHash) public view returns (bool) {
        // Lấy thông tin bằng cấp từ mapping
        Cert memory cert = certificates[_studentID];

        // So sánh hash được cung cấp với hash lưu trên Blockchain
        return keccak256(abi.encodePacked(cert.certificateHash)) == keccak256(abi.encodePacked(_certificateHash));
    }
}