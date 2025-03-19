const Certificate = artifacts.require("Certificate");

contract("Certificate", (accounts) => {
    let instance;

    beforeEach(async () => {
        instance = await Certificate.new();
    });

    it("should add a certificate successfully with auto-generated hash", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        const cert = await instance.certificates(studentID);
        assert.equal(cert.studentID, studentID, "Student ID không khớp");
        assert.equal(cert.studentName, studentName, "Họ tên sinh viên không khớp");
        assert.equal(cert.certificateName, certificateName, "Tên chứng chỉ không khớp");
        assert.equal(cert.issueDate.toString(), issueDate.toString(), "Ngày cấp không khớp");
        assert.equal(cert.issuedBy, issuedBy, "Cơ sở cấp không khớp");
        assert.equal(cert.graduationGrade, graduationGrade, "Xếp loại không khớp");
        assert.isNotEmpty(cert.certificateHash, "CertificateHash không được rỗng");
        assert.match(cert.certificateHash, /^0x[a-fA-F0-9]{64}$/, "CertificateHash không đúng định dạng");
        assert.isAbove(parseInt(cert.timestamp), 0, "Timestamp phải lớn hơn 0");
    });

    it("should fail if studentID already exists", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        try {
            await instance.addCertificate(
                studentID,
                "Trần Văn B",
                "Bằng khác",
                issueDate,
                issuedBy,
                "Khá",
                { from: accounts[0] }
            );
            assert.fail("Nên thất bại vì studentID đã tồn tại");
        } catch (error) {
            assert.include(error.message, "Certificate for this student ID already exists", "Lỗi không đúng");
        }
    });

    it("should fail if certificateHash already exists for another student", async () => {
        const studentID1 = "S0001";
        const studentID2 = "S0002";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID1,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        try {
            await instance.addCertificate(
                studentID2,
                studentName,
                certificateName,
                issueDate,
                issuedBy,
                graduationGrade,
                { from: accounts[0] }
            );
            assert.fail("Nên thất bại vì certificateHash đã tồn tại");
        } catch (error) {
            assert.include(error.message, "Certificate hash already exists for another student", "Lỗi không đúng");
        }
    });

    it("should verify certificate successfully", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        const cert = await instance.certificates(studentID);
        const isValid = await instance.verifyCertificate(studentID, cert.certificateHash);
        assert.isTrue(isValid, "Xác minh chứng chỉ không thành công");
    });

    it("should fail to verify with wrong certificateHash", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        const isValid = await instance.verifyCertificate(studentID, "0xwronghash");
        assert.isFalse(isValid, "Xác minh không thất bại với certificateHash sai");
    });

    it("should get certificate details correctly", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            { from: accounts[0] }
        );

        const result = await instance.getCertificate(studentID);
        const returnedStudentID = result[0];
        const returnedStudentName = result[1];
        const returnedCertificateName = result[2];
        const returnedIssueDate = result[3].toNumber();
        const returnedIssuedBy = result[4];
        const returnedGraduationGrade = result[5];
        const returnedCertificateHash = result[6];
        const returnedTimestamp = result[7].toNumber();

        assert.equal(returnedStudentID, studentID, "Student ID không khớp");
        assert.equal(returnedStudentName, studentName, "Họ tên không khớp");
        assert.equal(returnedCertificateName, certificateName, "Tên chứng chỉ không khớp");
        assert.equal(returnedIssueDate, issueDate, "Ngày cấp không khớp");
        assert.equal(returnedIssuedBy, issuedBy, "Cơ sở cấp không khớp");
        assert.equal(returnedGraduationGrade, graduationGrade, "Xếp loại không khớp");
        assert.isNotEmpty(returnedCertificateHash, "CertificateHash không được rỗng");
        assert.isAbove(returnedTimestamp, 0, "Timestamp phải lớn hơn 0");
    });
});