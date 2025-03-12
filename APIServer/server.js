import express from 'express';
import Web3 from 'web3';
import { PythonShell } from 'python-shell';
import dotenv from 'dotenv';

dotenv.config();


const app = express();
app.use(express.json());

// Kết nối với Ethereum Testnet hoặc Ganache
const web3 = new Web3(process.env.BLOCKCHAIN_RPC);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "studentID",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "certificateHash",
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
          "name": "studentID",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "certificateHash",
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
      "type": "function"
    }
];
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
