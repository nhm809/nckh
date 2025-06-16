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
    message: "Too many requests from this IP, please try again in 15 minutes."
});
app.use(limiter);


// Kết nối với Ethereum Testnet hoặc Ganache
const web3 = new Web3(process.env.BLOCKCHAIN_RPC);

const contractJSON = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
const contractABI = contractJSON.abi;

// Lấy contract instance động theo networkId
let contract;
(async () => {
    const networkId = await web3.eth.net.getId();
    const contractAddress = contractJSON.networks[networkId]?.address;
    if (!contractAddress) {
        console.error(`Contract address not found for network ${networkId}. Please migrate the contract.`);
        process.exit(1);
    }
    contract = new web3.eth.Contract(contractABI, contractAddress);
    console.log('Using contract address:', contractAddress);
})();

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
                    reject(new Error("No student found"));
                }
            })
            .on("error", (error) => reject(error));
    });
};

// ✅ API lấy điểm số của sinh viên
app.get('/get-grades', async (req, res) => {
    const { studentIDs } = req.query;
    if (!studentIDs) {
        return res.status(400).json({ error: "Missing studentIDs" });
    }

    const studentIDArray = studentIDs.split(',');

    try {
        const studentData = await readGradesFromCSV(studentIDArray);
        console.log(`Data of ${studentIDs}:`, studentData); // ✅ Kiểm tra dữ liệu
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
    { studentID: "S0009", password: "123" }
];

// ✅ API đăng nhập
app.post("/login", (req, res) => {
    const { studentID, password } = req.body;
    const user = users.find(u => u.studentID === studentID && u.password === password);
    user ? res.json({ message: "Log in successfully" }) : res.status(401).json({ message: "Wrong account or password" });
});

// ✅ API thêm bằng cấp vào Blockchain
app.post('/add-certificate', async (req, res) => {
    const { studentID, studentName, certificateName, issueDate, issuedBy, graduationGrade } = req.body;
    if (!studentID || !graduationGrade || !studentName || !certificateName || !issueDate || !issuedBy) {
        return res.status(400).json({ error: "Missing information" });
    }

    console.log("Received data:", { studentID, studentName, certificateName, issueDate, issuedBy, graduationGrade });

    // Chuyển đổi issueDate từ DD/MM/YYYY thành timestamp
    let issueDateUint;
    try {
        const parsedDate = moment(issueDate, "DD/MM/YYYY", true);
        if (!parsedDate.isValid()) {
            const parsedDate2 = moment(issueDate, "YYYY/MM/DD", true);
            if (!parsedDate2.isValid()) {
                return res.status(400).json({ 
                    error: "Invalid date format. Use DD/MM/YYYY or YYYY/MM/DD",
                    receivedDate: issueDate
                });
            }
            issueDateUint = parsedDate2.unix();
        } else {
            issueDateUint = parsedDate.unix();
        }
    } catch (error) {
        console.error("Error parsing date:", error);
        return res.status(400).json({ 
            error: "Error handling dates",
            details: error.message,
            receivedDate: issueDate
        });
    }

    // Chuyển đổi các trường string sang bytes32
    try {
        const studentIDBytes32 = web3.utils.asciiToHex(studentID.padEnd(32, '\0'));
        const studentNameBytes32 = web3.utils.asciiToHex(studentName.padEnd(32, '\0'));
        const certificateNameBytes32 = web3.utils.asciiToHex(certificateName.padEnd(32, '\0'));
        const issuedByBytes32 = web3.utils.asciiToHex(issuedBy.padEnd(32, '\0'));
        const graduationGradeBytes32 = web3.utils.asciiToHex(graduationGrade.padEnd(32, '\0'));

        console.log("Converted data:", {
            studentIDBytes32,
            studentNameBytes32,
            certificateNameBytes32,
            issueDateUint,
            issuedByBytes32,
            graduationGradeBytes32
        });

        const accounts = await web3.eth.getAccounts();
        console.log("Using account:", accounts[0]);

        let estimatedGas;
        try {
            estimatedGas = await contract.methods.addCertificate(
                studentIDBytes32,
                studentNameBytes32,
                certificateNameBytes32,
                issueDateUint,
                issuedByBytes32,
                graduationGradeBytes32
            ).estimateGas({ from: accounts[0] });
            
            console.log("Estimated gas:", estimatedGas);
        } catch (error) {
            console.error("Error when estimating gas:", error);
            return res.status(500).json({ 
                error: "Error when estimating gas", 
                details: error.toString(),
                data: {
                    studentID: studentIDBytes32,
                    studentName: studentNameBytes32,
                    certificateName: certificateNameBytes32,
                    issueDate: issueDateUint,
                    issuedBy: issuedByBytes32,
                    graduationGrade: graduationGradeBytes32
                }
            });
        }

        const tx = await contract.methods.addCertificate(
            studentIDBytes32,
            studentNameBytes32,
            certificateNameBytes32,
            issueDateUint,
            issuedByBytes32,
            graduationGradeBytes32
        ).send({ from: accounts[0], gas: estimatedGas });

        console.log("Transaction successful:", tx.transactionHash);
        res.status(200).json({ 
            message: "Degree added successfully", 
            txHash: tx.transactionHash 
        });
    } catch (error) {
        console.error("Blockchain error:", error);
        res.status(500).json({ 
            message: "Server error", 
            error: error.toString(),
            details: error.message
        });
    }
});

// ✅ API xác minh bằng cấp trên Blockchain
app.get('/verify-certificate', async (req, res) => {
    const { studentID, certificateHash } = req.query;
    if (!studentID || !certificateHash) {
        return res.status(400).json({ error: "Missing studentID or certificateHash information" });
    }

    try {
        // Chuyển studentID sang bytes32
        const studentIDBytes32 = web3.utils.asciiToHex(studentID.padEnd(32, '\0'));
        console.log('StudentID bytes32:', studentIDBytes32);

        try {
            const existingStudentID = await contract.methods.hashToStudent(certificateHash).call();
            console.log('Existing StudentID:', existingStudentID);
            
            if (existingStudentID && existingStudentID !== studentIDBytes32) {
                return res.status(400).json({
                    error: "The certificate hash has already been used by another student",
                    existingStudentID: existingStudentID
                });
            }
        } catch (error) {
            console.error("Error checking hashToStudent:", error);
            return res.status(500).json({ error: "Error checking certificate hash", details: error.message });
        }

        try {
            const isValid = await contract.methods.verifyCertificate(studentIDBytes32, certificateHash).call();
            console.log('Is Valid:', isValid);

            if (isValid) {
                try {
                    const cert = await contract.methods.getCertificate(studentIDBytes32).call();
                    console.log('Certificate data:', cert);
                    
                    const certificateInfo = {
                        studentID: web3.utils.hexToUtf8(cert[0]).replace(/\0/g, ''),
                        studentName: web3.utils.hexToUtf8(cert[1]).replace(/\0/g, ''),
                        certificateName: web3.utils.hexToUtf8(cert[2]).replace(/\0/g, ''),
                        issueDate: new Date(Number(cert[3]) * 1000).toLocaleDateString(),
                        issuedBy: web3.utils.hexToUtf8(cert[4]).replace(/\0/g, ''),
                        graduationGrade: web3.utils.hexToUtf8(cert[5]).replace(/\0/g, '')
                    };
                    res.status(200).json({ isValid, certificateInfo });
                } catch (error) {
                    console.error("Error while retrieving certificate information:", error);
                    return res.status(500).json({ error: "Error while retrieving certificate information", details: error.message });
                }
            } else {
                res.status(200).json({ isValid });
            }
        } catch (error) {
            console.error("Error verifying certificate:", error);
            return res.status(500).json({ error: "Error verifying certificate", details: error.message });
        }
    } catch (error) {
        console.error("Blockchain error:", error);
        res.status(500).json({ error: "Blockchain error", details: error.message });
    }
});

app.get('/get-certificate', async (req, res) => {
    const { studentID } = req.query;

    if (!studentID) {
        return res.status(400).json({ error: "Missing studentID" });
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
        console.error("Error getting certificate:", error);
        res.status(404).json({ error: "No certificate found" });
    }
});


// Call Python Server
async function callAPIViaPythonServer(studentID, grades) {
    try {
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentID, grades }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error from Flask API: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error in callAPIViaPythonServer:", {
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
        return cachedResult; // Return cached result
    }

    const result = await callAPIViaPythonServer(studentID, grades); // Call Python server
    cache.set(cacheKey, result); // Store result in cache
    return result;
}

// ✅ AI/XAI-based course recommendation API
app.post('/recommend-courses', async (req, res) => {
    const { studentID, grades } = req.body;
    if (!studentID || !grades) {
        return res.status(400).json({ error: "Missing studentID or grades" });
    }

    try {
        // Ensure grades is an object
        if (typeof grades !== 'object' || Array.isArray(grades)) {
            return res.status(400).json({ error: "Grades must be an object" });
        }

        const result = await callAPIWithCache(studentID, grades); // Call API with cache
        res.status(200).json(result);
    } catch (error) {
        console.error("Error in /recommend-courses:", error);
        res.status(500).json({ error: "Error processing AI/XAI", details: error.message });
    }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Server is running!'));
app.listen(PORT, () => console.log(` Server run at http://localhost:${PORT}`));

// Global error handler
app.use((err, req, res, next) => {
    console.error("Global error:", err);
    res.status(500).json({ error: "Internal server error" });
});
