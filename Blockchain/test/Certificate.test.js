const Certificate = artifacts.require("Certificate");

contract("Certificate", (accounts) => {
    let instance;

    // Trước mỗi test case, triển khai hợp đồng mới
    beforeEach(async () => {
        instance = await Certificate.new();
    });

    // Test 1: Thêm một chứng chỉ thành công
    it("should add a certificate successfully", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000); // Chuyển sang giây
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";
        const certificateHash = "0x1234567890abcdef";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            certificateHash,
            { from: accounts[0] }
        );

        const cert = await instance.certificates(studentID);
        assert.equal(cert.studentID, studentID, "Student ID không khớp");
        assert.equal(cert.studentName, studentName, "Họ tên sinh viên không khớp");
        assert.equal(cert.certificateName, certificateName, "Tên chứng chỉ không khớp");
        assert.equal(cert.issueDate.toString(), issueDate.toString(), "Ngày cấp không khớp");
        assert.equal(cert.issuedBy, issuedBy, "Cơ sở cấp không khớp");
        assert.equal(cert.graduationGrade, graduationGrade, "Xếp loại không khớp");
        assert.equal(cert.certificateHash, certificateHash, "Mã băm không khớp");
        assert.isAbove(parseInt(cert.timestamp), 0, "Timestamp phải lớn hơn 0");
    });

    // Test 2: Kiểm tra tính duy nhất của studentID
    it("should fail if studentID already exists", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";
        const certificateHash = "0x1234567890abcdef";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            certificateHash,
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
                "0xabcdef1234567890",
                { from: accounts[0] }
            );
            assert.fail("Nên thất bại vì studentID đã tồn tại");
        } catch (error) {
            assert.include(error.message, "Certificate for this student ID already exists", "Lỗi không đúng");
        }
    });

    // Test 3: Kiểm tra tính duy nhất của certificateHash
    it("should fail if certificateHash already exists for another student", async () => {
        const studentID1 = "S0001";
        const studentID2 = "S0002";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";
        const certificateHash = "0x1234567890abcdef";

        await instance.addCertificate(
            studentID1,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            certificateHash,
            { from: accounts[0] }
        );

        try {
            await instance.addCertificate(
                studentID2,
                "Trần Văn B",
                "Bằng khác",
                issueDate,
                issuedBy,
                "Khá",
                certificateHash,
                { from: accounts[0] }
            );
            assert.fail("Nên thất bại vì certificateHash đã tồn tại");
        } catch (error) {
            assert.include(error.message, "Certificate hash already exists for another student", "Lỗi không đúng");
        }
    });

    // Test 4: Xác minh chứng chỉ thành công
    it("should verify certificate successfully", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";
        const certificateHash = "0x1234567890abcdef";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            certificateHash,
            { from: accounts[0] }
        );

        const isValid = await instance.verifyCertificate(studentID, certificateHash);
        assert.isTrue(isValid, "Xác minh chứng chỉ không thành công");
    });

    // Test 5: Xác minh chứng chỉ thất bại với certificateHash sai
    it("should fail to verify with wrong certificateHash", async () => {
        const studentID = "S0001";
        const studentName = "Nguyễn Văn A";
        const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
        const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000);
        const issuedBy = "Đại học Bách Khoa Hà Nội";
        const graduationGrade = "Giỏi";
        const certificateHash = "0x1234567890abcdef";

        await instance.addCertificate(
            studentID,
            studentName,
            certificateName,
            issueDate,
            issuedBy,
            graduationGrade,
            certificateHash,
            { from: accounts[0] }
        );

        const isValid = await instance.verifyCertificate(studentID, "0xwronghash");
        assert.isFalse(isValid, "Xác minh không thất bại với certificateHash sai");
    });

    // Test 6: Lấy thông tin chứng chỉ
     it("should get certificate details correctly", async () => {
          const studentID = "S0001";
          const studentName = "Nguyễn Văn A";
          const certificateName = "Bằng tốt nghiệp Kỹ thuật Máy tính";
          const issueDate = Math.floor(new Date("2025-03-18").getTime() / 1000); // Chuyển sang giây
          const issuedBy = "Đại học Bách Khoa Hà Nội";
          const graduationGrade = "Giỏi";
          const certificateHash = "0x1234567890abcdef";
     
          await instance.addCertificate(
          studentID,
          studentName,
          certificateName,
          issueDate,
          issuedBy,
          graduationGrade,
          certificateHash,
          { from: accounts[0] }
          );
     
          // Lấy thông tin chứng chỉ
          const result = await instance.getCertificate(studentID);
          // Phân rã thủ công để kiểm tra từng giá trị
          const returnedStudentID = result[0];
          const returnedStudentName = result[1];
          const returnedCertificateName = result[2];
          const returnedIssueDate = result[3].toNumber(); // Chuyển uint sang số
          const returnedIssuedBy = result[4];
          const returnedGraduationGrade = result[5];
          const returnedCertificateHash = result[6];
          const returnedTimestamp = result[7].toNumber(); // Chuyển uint sang số
     
          assert.equal(returnedStudentID, studentID, "Student ID không khớp");
          assert.equal(returnedStudentName, studentName, "Họ tên không khớp");
          assert.equal(returnedCertificateName, certificateName, "Tên chứng chỉ không khớp");
          assert.equal(returnedIssueDate, issueDate, "Ngày cấp không khớp");
          assert.equal(returnedIssuedBy, issuedBy, "Cơ sở cấp không khớp");
          assert.equal(returnedGraduationGrade, graduationGrade, "Xếp loại không khớp");
          assert.equal(returnedCertificateHash, certificateHash, "Mã băm không khớp");
          assert.isAbove(returnedTimestamp, 0, "Timestamp phải lớn hơn 0");
     });
});