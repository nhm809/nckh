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

dotenv.config();
const app = express();
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
// const contractAddress = process.env.CONTRACT_ADDRESS;
// const contractABI = [
//   {
//     "anonymous": false,
//     "inputs": [
//       {
//         "indexed": false,
//         "internalType": "string",
//         "name": "studentID",
//         "type": "string"
//       },
//       {
//         "indexed": false,
//         "internalType": "string",
//         "name": "certificateHash",
//         "type": "string"
//       },
//       {
//         "indexed": false,
//         "internalType": "uint256",
//         "name": "timestamp",
//         "type": "uint256"
//       }
//     ],
//     "name": "CertificateAdded",
//     "type": "event"
//   },
//   {
//     "inputs": [
//       {
//         "internalType": "string",
//         "name": "",
//         "type": "string"
//       }
//     ],
//     "name": "certificates",
//     "outputs": [
//       {
//         "internalType": "string",
//         "name": "studentID",
//         "type": "string"
//       },
//       {
//         "internalType": "string",
//         "name": "certificateHash",
//         "type": "string"
//       },
//       {
//         "internalType": "uint256",
//         "name": "timestamp",
//         "type": "uint256"
//       }
//     ],
//     "stateMutability": "view",
//     "type": "function",
//     "constant": true
//   },
//   {
//     "inputs": [
//       {
//         "internalType": "string",
//         "name": "_studentID",
//         "type": "string"
//       },
//       {
//         "internalType": "string",
//         "name": "_certificateHash",
//         "type": "string"
//       }
//     ],
//     "name": "addCertificate",
//     "outputs": [],
//     "stateMutability": "nonpayable",
//     "type": "function"
//   },
//   {
//     "inputs": [
//       {
//         "internalType": "string",
//         "name": "_studentID",
//         "type": "string"
//       },
//       {
//         "internalType": "string",
//         "name": "_certificateHash",
//         "type": "string"
//       }
//     ],
//     "name": "verifyCertificate",
//     "outputs": [
//       {
//         "internalType": "bool",
//         "name": "",
//         "type": "bool"
//       }
//     ],
//     "stateMutability": "view",
//     "type": "function",
//     "constant": true
//   }
// ];
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
        fs.createReadStream("./DataProcessor/Processed_StudentsPerformance.csv")
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
    { studentID: "admin", password: "123" }
];

// ✅ API đăng nhập
app.post("/login", (req, res) => {
    const { studentID, password } = req.body;
    const user = users.find(u => u.studentID === studentID && u.password === password);
    user ? res.json({ message: "Đăng nhập thành công" }) : res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
});

// ✅ API thêm bằng cấp vào Blockchain
app.post('/add-certificate', async (req, res) => {
    const { studentID, certificateHash } = req.body;
    if (!studentID || !certificateHash) {
        return res.status(400).json({ error: "Thiếu thông tin studentID hoặc certificateHash" });
    }

    try {
        const accounts = await web3.eth.getAccounts();
        const estimatedGas = await contract.methods.addCertificate(studentID, certificateHash).estimateGas({ from: accounts[0] });
        const tx = await contract.methods.addCertificate(studentID, certificateHash).send({ from: accounts[0], gas: estimatedGas });

        res.status(200).json({ message: "Bằng cấp đã thêm thành công", txHash: tx.transactionHash });
    } catch (error) {
        console.error("Lỗi Blockchain:", error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.toString() });
    }
});

// ✅ API xác minh bằng cấp trên Blockchain
app.get('/verify-certificate', async (req, res) => {
    const { studentID, certificateHash } = req.query;
    if (!studentID || !certificateHash) {
        return res.status(400).json({ error: "Thiếu thông tin studentID hoặc certificateHash" });
    }

    try {
        const isValid = await contract.methods.verifyCertificate(studentID, certificateHash).call();
        res.status(200).json({ isValid });
    } catch (error) {
        console.error("Lỗi Blockchain:", error);
        res.status(500).send(error.message);
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