import express from 'express';
import Web3 from 'web3';
import { PythonShell } from 'python-shell';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();


const app = express();
app.use(express.json());

app.use(cors({ origin: "http://127.0.0.1:5500" }));


// Kết nối với Ethereum Testnet hoặc Ganache
const web3 = new Web3(process.env.BLOCKCHAIN_RPC);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "studentID",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "certificateHash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "CertificateAdded",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "name": "certificates",
    "outputs": [
      {
        "internalType": "string",
        "name": "studentID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "certificateHash",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function",
    "constant": true
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_studentID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_certificateHash",
        "type": "string"
      }
    ],
    "name": "addCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_studentID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_certificateHash",
        "type": "string"
      }
    ],
    "name": "verifyCertificate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function",
    "constant": true
  }
];


// Danh sách tài khoản giả lập (Có thể thay bằng DB sau này)
const users = [
  { studentID: "S0001", password: "123" },
  { studentID: "admin", password: "123" }
];

// API xử lý đăng nhập
app.post("/login", (req, res) => {
  const { studentID, password } = req.body;

  const user = users.find(u => u.studentID === studentID && u.password === password);
  if (user) {
      res.json({ message: "Đăng nhập thành công" });
  } else {
      res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
  }
});



const contract = new web3.eth.Contract(contractABI, contractAddress);

// API thêm bằng cấp vào Blockchain
app.post('/add-certificate', async (req, res) => {
    const { studentID, certificateHash } = req.body;
    try {
        const accounts = await web3.eth.getAccounts();
        await contract.methods.addCertificate(studentID, certificateHash).send({ from: accounts[0] });
        res.status(200).send('Certificate added successfully');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// API để xác minh bằng cấp
app.get('/verify-certificate', async (req, res) => {
  const { studentID, certificateHash } = req.query;
  try {
      // Gọi hàm verifyCertificate trong smart contract
      const isValid = await contract.methods.verifyCertificate(studentID, certificateHash).call();
      res.status(200).json({ isValid });
  } catch (error) {
      res.status(500).send(error.message);
  }
});

// API để gợi ý lộ trình học tập từ AI và XAI
app.post('/recommend-courses', (req, res) => {
  const { studentID, grades } = req.body;
  // Cấu hình PythonShell để gọi script analyze.py
  const options = {
      mode: 'text',
      pythonOptions: ['-u'],
      args: [JSON.stringify({ studentID, grades })]
  };
  PythonShell.run('backend/ai/analyze.py', options, (err, results) => {
      if (err) return res.status(500).send(err.message);
      // Trả về kết quả từ Python script
      res.status(200).json(JSON.parse(results[0]));
  });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Server is running!');
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
