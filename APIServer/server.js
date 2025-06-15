import express from 'express';
import Web3 from 'web3';
import { PythonShell } from 'python-shell';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import NodeCache from 'node-cache';
import moment from 'moment';
import bodyParser from'body-parser';

dotenv.config();
const app = express();
app.use(bodyParser.json());  // Cho phép đọc JSON body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(morgan('combined')); // Log tất cả các yêu cầu

const cache = new NodeCache({ stdTTL: 3600 }); // Cache trong 1 giờ

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const blockchainPath = path.resolve(__dirname, '../Blockchain/build/contracts/Certificate.json');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Giới hạn 100 yêu cầu mỗi IP trong 15 phút
    message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút."
});
app.use(limiter);


// Kết nối với Ethereum Testnet hoặc Ganache
const web3 = new Web3(process.env.BLOCKCHAIN_RPC);

const contractJSON = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
const contractABI = contractJSON.abi;
const contractAddress = contractJSON.networks[5777]?.address; // Đọc địa chỉ từ mạng 5777 (Ganache)

if (!contractAddress) {
    console.error("Contract address not found for network 5777. Please migrate the contract.");
    process.exit(1);
  }

const contract = new web3.eth.Contract(contractABI, contractAddress);

console.log("Using contract address:", contractAddress);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// ✅ Đọc điểm số từ CSV
const readGradesFromCSV = (studentIDs) => {
    return new Promise((resolve, reject) => {
        const studentDataList = [];
        fs.createReadStream("../DataProcessor/Processed_StudentsPerformance.csv")
            .pipe(csv())
            .on("data", (row) => {
                if (studentIDs.includes(row.studentID)) {
                    studentDataList.push({
                        studentID: String(row.studentID),
                        grades: {
                            Math: parseFloat(row.math_score),
                            Reading: parseFloat(row.reading_score),
                            Writing: parseFloat(row.writing_score),
                        }
                    });
                }
            })
            .on("end", () => {
                if (studentDataList.length > 0) {
                    resolve({ students: studentDataList });
                } else {
                    reject(new Error("Không tìm thấy sinh viên"));
                }
            })
            .on("error", (error) => reject(error));
    });
};

// ✅ API lấy điểm số của sinh viên
app.get('/get-grades', async (req, res) => {
    const { studentIDs } = req.query;
    if (!studentIDs) {
        return res.status(400).json({ error: "Thiếu studentIDs" });
    }

    const studentIDArray = studentIDs.split(',');

    try {
        const studentData = await readGradesFromCSV(studentIDArray);
        console.log(`Dữ liệu của ${studentIDs}:`, studentData); // ✅ Kiểm tra dữ liệu
        res.setHeader('Cache-Control', 'no-store'); // 🔹 Ngăn cache
        res.json(studentData);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// ✅ Danh sách tài khoản giả lập
const users = [
    { studentID: "S0001", password: "123" },
    { studentID: "admin", password: "123" },
    { studentID: "S1001", password: "123" }
];

// ✅ API đăng nhập
app.post("/login", (req, res) => {
    const { studentID, password } = req.body;
    const user = users.find(u => u.studentID === studentID && u.password === password);
    user ? res.json({ message: "Đăng nhập thành công" }) : res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
});


function toBytes32(str) {
  const buffer = Buffer.alloc(32); // Tạo buffer rỗng 32 byte
  const byteStr = Buffer.from(str, 'utf8');

  if (byteStr.length > 32) {
    throw new Error(`"${str}" is too long for bytes32`);
  }

  byteStr.copy(buffer); // Copy nội dung vào buffer
  return '0x' + buffer.toString('hex');
}



// ✅ API thêm bằng cấp vào Blockchain
app.post('/add-certificate', async (req, res) => {
    const { studentID, studentName, certificateName, issueDate, issuedBy, graduationGrade } = req.body;

    if (!studentID || !studentName || !certificateName || !issueDate || !issuedBy || !graduationGrade) {
        return res.status(400).json({ error: "Missing information" });
    }

    // Convert issueDate from YYYY/MM/DD to UNIX timestamp (uint)
    const issueDateUint = moment(issueDate, "YYYY/MM/DD").unix();
    if (isNaN(issueDateUint)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY/MM/DD" });
    }

    try {
        const accounts = await web3.eth.getAccounts();

        // ✅ Convert to bytes32 with padding
        const studentIDHex = toBytes32(studentID);
        const studentNameHex = toBytes32(studentName);
        const certificateNameHex = toBytes32(certificateName);
        const issuedByHex = toBytes32(issuedBy);
        const graduationGradeHex = toBytes32(graduationGrade);

        // ✅ Tạo certificateHash trước khi gửi contract
        const certificateHash = web3.utils.soliditySha3(
            studentNameHex,
            certificateNameHex,
            issueDateUint,
            issuedByHex,
            graduationGradeHex
        );

        // Estimate gas 
        let estimatedGas;
        try {
            estimatedGas = await contract.methods.addCertificate(
                studentIDHex, studentNameHex, certificateNameHex, issueDateUint, issuedByHex, graduationGradeHex
            ).estimateGas({ from: accounts[0] });
        } catch (error) {
            console.error("Error when estimating gas:", error);
            return res.status(500).json({ error: "Error when estimating gas", details: error.toString() });
        }

        // Gửi transaction
        const tx = await contract.methods.addCertificate(
            studentIDHex, studentNameHex, certificateNameHex, issueDateUint, issuedByHex, graduationGradeHex
        ).send({ from: accounts[0], gas: estimatedGas });

        // ✅ Trả về certificateHash kèm txHash
        res.status(200).json({
            message: "Degree added successfully",
            txHash: tx.transactionHash,
            certificateHash: certificateHash
        });

    } catch (error) {
        console.error("Blockchain error:", error);
        res.status(500).json({ message: "Server error", error: error.toString() });
    }
});






// ✅ API xác minh bằng cấp trên Blockchain
app.get('/verify-certificate', async (req, res) => {
    const { studentID } = req.query;

    if (!studentID) {
        return res.status(400).json({ error: "Missing studentID" });
    }


    try {
        const studentIDBytes32 = toBytes32(studentID);

        const isValid = await contract.methods.verifyCertificate(studentIDBytes32).call();

        res.status(200).json({ isValid });
    } catch (error) {
        console.error("Blockchain error:", error);
        res.status(500).json({ error: "Blockchain error", details: error.message });
    }
});


app.get('/verify-certificate-full', async (req, res) => {
    const { studentID, certificateHash } = req.query;

    if (!studentID || !certificateHash) {
        return res.status(400).json({ error: "Missing studentID or certificateHash" });
    }

    try {
        const studentIDBytes32 = web3.utils.padRight(web3.utils.asciiToHex(studentID), 66);
        const isValid = await contract.methods.verifyCertificate(studentIDBytes32, certificateHash).call();
        res.status(200).json({ isValid });
    } catch (error) {
        console.error("Blockchain error:", error);
        res.status(500).json({ error: "Blockchain error", details: error.message });
    }
});








app.get('/get-certificate', async (req, res) => {
    const { studentID } = req.query;

    if (!studentID) {
        return res.status(400).json({ error: "Thiếu studentID" });
    }

    try {
        const certificate = await contract.methods.getCertificate(studentID).call();

        res.status(200).json({
            studentID: certificate[0],
            studentName: certificate[1],
            certificateName: certificate[2],
            issueDate: moment.unix(parseInt(certificate[3])).format('YYYY/MM/DD'),
            issuedBy: certificate[4],
            graduationGrade: certificate[5],
            certificateHash: certificate[6],
            timestamp: moment.unix(parseInt(certificate[7])).format('YYYY/MM/DD')
        });
    } catch (error) {
        console.error("Lỗi khi lấy chứng chỉ:", error);
        res.status(404).json({ error: "Không tìm thấy chứng chỉ" });
    }
});


// Gọi Python Server
async function callAPIViaPythonServer(studentID, grades) {
    try {
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentID, grades }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lỗi từ Flask API: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Lỗi trong callAPIViaPythonServer:", {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
        });
        throw error;
    }
}

async function callAPIWithCache(studentID, grades) {
    const cacheKey = `${studentID}-${JSON.stringify(grades)}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
        return cachedResult; // Trả về kết quả từ cache
    }

    const result = await callAPIViaPythonServer(studentID, grades); // Gọi Python server
    cache.set(cacheKey, result); // Lưu kết quả vào cache
    return result;
}

// ✅ API gợi ý khóa học dựa trên AI/XAI
app.post('/recommend-courses', async (req, res) => {
    const { studentID, grades } = req.body;
    if (!studentID || !grades) {
        return res.status(400).json({ error: "Thiếu studentID hoặc grades" });
    }

    try {
        // Kiểm tra xem grades có phải là object không
        if (typeof grades !== 'object' || Array.isArray(grades)) {
            return res.status(400).json({ error: "Grades phải là một object" });
        }

        const result = await callAPIWithCache(studentID, grades); // Gọi API với cache
        res.status(200).json(result);
    } catch (error) {
        console.error("Lỗi trong /recommend-courses:", error);
        res.status(500).json({ error: "Lỗi khi xử lý AI/XAI", details: error.message });
    }
});

// ✅ Khởi động server
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Server is running!'));
app.listen(PORT, () => console.log(` Server run at http://localhost:${PORT}`));

// Xử lý lỗi toàn cục
app.use((err, req, res, next) => {
    console.error("Lỗi toàn cục:", err);
    res.status(500).json({ error: "Đã xảy ra lỗi máy chủ" });
});