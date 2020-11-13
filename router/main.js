const { v1: uuidv1 } = require('uuid');
const Web3 = require('web3');
let provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
let web3 = new Web3(provider);
const crypto = require('crypto');
const Plantation = require('../models/plantation');
const Record = require('../models/record');

const fs = require('fs');

const InputDataDecoder = require('ethereum-input-data-decoder');
const sanyangsamJSON = require('../contracts/Sanyangsam.json');
const decoder = new InputDataDecoder(sanyangsamJSON.abi);

// 컨트랙트 배포시의 address
const contractAddr = "0x035BB7a635351Df928c0863d406065dB5F2e2284";

const Tx = require('ethereumjs-tx').Transaction;
const privateKey = Buffer.from('ec9bc5e8fcc6588be282d5bc6b7ce4b4fc6439ea08ada667d6b63943b3f8efc8', 'hex');
const Common = require('ethereumjs-common').default;

// metadata to hash
const metadata2hash = (obj) => {
    return '0x9F86D081884C7D659A2FEAA0C55AD015A3BF4F1B2B0B822CD15D6C15B0F00A08'
}


const file2hash = fileName => {
    // 파일 스트림 읽기
    const input = fs.createReadStream('data/' + fileName);
    // md5 해시함수
    let hash = crypto.createHash('md5');
    // 파일을 읽으며 해시값 업데이트

    return new Promise(resolve => {
        input.on('readable', () => {
            let streamData = input.read();
            if(streamData)
                hash.update(streamData);
            else {
                resolve(hash.digest('hex'));
            }
        });
    });
}

module.exports = (app) => {
    // 초기 화면
    app.get('/', (req, res) => {
        res.render('index.html');
    });

    // 파일 리스트를 보여주는 화면
    app.get('/fileList', (req, res) => {
        const files = fs.readdirSync('data');
        res.render('fileList', {
            files: files
        });
    });

    // 파일의 정보를 가져와 보여주는 페이지
    app.get('/fileView', (req, res) => {
        const fileName = req.query.name;
        fs.readFile('data/' + fileName, 'utf-8', (err, data) => {
            if(err) {
                console.log(err);
                res.status(500).send('Internal Server Error');
            }

            console.log(data)

            file2hash(fileName).then(hashValue => {
                res.render('fileView', {
                    file: JSON.parse(data),
                    hashValue: hashValue // 해시 추출
                });
            });
        });
    });

    // 파일의 유효성 체크
    app.get('/check', (req, res) => {

        res.render('fileCheck.html');
        const fileName = req.query.id;
        fs.readFile('data/' + fileName, 'utf-8', (err, data) => {
            if(err) {
                console.log(err);
                res.status(500).send('Internal Server Error');
            }

            const file = JSON.parse(data);  

            fs.readFile('data/txId/' + fileName, 'utf-8', (err, txHash) => {
                // hash값을 이용해 transaction을 불러와 존재하는지 확인
                web3.eth.getTransaction(txHash, (err, tx) => {
                    if (err) {                    
                        console.log(err);
                        res.status(500).send('Internal Server Error');
                    }
    
                    if (typeof tx === "undefined") {
                        res.send("유효하지 않음");
                    }

                    file2hash(fileName).then(fileHash => {
                        if(decoder.decodeData(tx.Input) === fileHash) {
                            res.send("유효함");
                        }
                    })
                });
            });
        });
    });

     // transaction 조회
     app.get('/txView', (req, res) => {
        const txId = req.query.txId;
        web3.eth.getTransaction(txId, (err, tx) => {
            if(err) {
                res.status(500).send('Internal Server Error');
            }
            const result = decoder.decodeData(tx.input);
            res.json(result);
        })
    })

    // 사용자 입력을 받아 파일 생성
    app.post('/fileSave', (req, res) => {
        const workRecord = req.body.workRecord;
        let file = new Object();
        const fileId = uuidv1();
        file.date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        file.id = fileId;
        file.workRecord = workRecord;
        
        fs.writeFile('data/' + fileId, JSON.stringify(file), (err) => {
            if(err) {
                console.log(err);
                res.status(500).send('Internal Server Error');
            }
            res.send('기록 등록 완료');
        });
    });

    // 파일을 블록체인 네트워크에 등록
    app.post('/upload', (req, res) => {
        // const walletAddress = req.body.wallet;
        // const hashValue = req.body.hashValue;
        // console.log(walletAddress);
        // console.log(hashValue);
        // const fileName = req.query.id;

        let ContractInstance = new web3.eth.Contract(sanyangsamJSON.abi, contractAddr, {
            from: '0x867545682917E0368c68694F01C88CB88F1eC6b0',
        });
        const data = ContractInstance.methods.addHashValue('7c20ef53952e35e0d33f8fc5c5428910').encodeABI();
        // const data = '0x242ab447000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000206364343161336536623262363864313533363739363831303165333534306361';
        console.log(data);
        web3.eth.getTransactionCount('0x867545682917E0368c68694F01C88CB88F1eC6b0', 'pending').then(txCnt => {
            let rawTx = {
                "nonce": "0x0C",
                "from": '0x867545682917E0368c68694F01C88CB88F1eC6b0',
                "data": data,
                "gasLimit": web3.utils.toHex(6721975),
                "gasPrice": web3.utils.toHex(20000000000),
                "to": contractAddr
            }

            const tx = new Tx(rawTx);
            tx.sign(privateKey);
    
            const serializedTx = "0x" + tx.serialize().toString('hex');
            console.info('raw tx : ' + serializedTx);
            web3.eth.sendSignedTransaction(serializedTx, (err, txHash) => {
                if(err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error');
                }
                res.send(txHash);
                // fs.writeFile('data/txId/' + fileName, txHash, (err) => {
                //     if(err) {
                //         console.log(err);
                //         res.status(500).send('Internal Server Error');
                //     }
                //     res.send(txHash);
                // })
            })
        });
    })

    /**
     * request: {key,value} i.e. {uploadFile: document.pdf(file format)}
     * respond:
     *   uploadFile.name - The name of the uploaded file i.e. document.pdf
     *   uploadFile.mv - The function to move the file elsewhere on the server
     *   uploadFile.mimetype - The mime-type of the file
     *   uploadFile.size - The size of the file in bytes
     *   uploadFile.data - A buffer representation of the uploaded file
     */
    // 파일 업로드
    app.post('/fileUpload', async (req, res) => {
        try {
            if(!req.files) {
                res.send({
                    status: false,
                    message: 'No file uploaded'
                });
            } else {
                let uploadFile = req.files.uploadFile;
                uploadFile.mv('../assert/' + uploadFile.name); // ../assert/ 로 업로드 된 파일 이동
                const hashvalue = metadata2hash(uploadFile)
    
                //send response
                res.send({
                    status: true,
                    message: 'File is uploaded',
                    data: {
                        name: uploadFile.name,
                        size: uploadFile.size,
                        hashvalue: hashvalue
                    }
                });
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });

    app.post('/api/addplantation', (req, res) => {
        const plantation = new Plantation();
        plantation.title = req.body.title;
        plantation.position = req.body.position;
        plantation.id = uuidv1();

        plantation.save((err) => {
            if(err) {
                console.error(err);
                res.json({result: 0});
                return;
            }
        })

        res.json({result: 1});
    });

    app.get('/api/plantations', (req, res) => {
        Plantation.find((err, plantations) => {
            if(err) return res.status(500).send({error: 'database failure' });
            res.json(plantations);
        })
    })

    app.delete('/api/plantation/:plantation_id', (req, res) => {
        Plantation.remove({ id: req.params.plantation_id }, (err, output) => {
            if(err) return res.status(500).json({ error: 'database failure' });

            if(!output.n) return res.status(404).json({ error: 'plantation not found' });
            res.json({ message: 'plantation deleted' });

            res.status(204).end();
        })
    })

    app.get('/api/records/:plantation_id', (req, res) => {
        Record.find( {plantation_id: req.params.plantation_id }, (err, records) => {
            if(err) return res.status(500).json({error: err});
            if(records.length === 0) return res.json({result:0});
            res.json(records);
        })
    })

    app.post('/api/addrecord', (req, res) => {
        const record = new Record();
        record.content = req.body.content;
        record.date = req.body.date;
        record.plantation_id = req.body.plantation_id;
        record.txHash = req.body.txHash;
        record.type = req.body.type;

        record.save((err) => {
            if(err) {
                console.error(err);
                res.json({result: 0});
                return;
            }
        })

        res.json({result: 1});
    })
}