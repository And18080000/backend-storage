const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());

// A Vercel usa a pasta /tmp para uploads temporários
const upload = multer({ dest: '/tmp' });

// --- CONFIGURAÇÕES DO GOOGLE DRIVE ---
// Lê as credenciais da variável de ambiente, em vez de um arquivo
const keyFileContent = process.env.GOOGLE_CREDENTIALS_JSON;
if (!keyFileContent) {
    throw new Error("A variável de ambiente GOOGLE_CREDENTIALS_JSON não está definida.");
}
const credentials = JSON.parse(keyFileContent);

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
});

async function uploadToDrive(file) {
    const drive = google.drive({ version: 'v3', auth });
    
    const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] // Lê o ID da pasta da variável de ambiente
    };

    const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
    };

    try {
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name',
            supportsAllDrives: true,
        });
        
        fs.unlinkSync(file.path); // Apaga o arquivo temporário
        console.log('Arquivo enviado com sucesso:', response.data);
        return response.data;
    } catch (error) {
        console.error('Erro no upload para o Google Drive:', error.message);
        fs.unlinkSync(file.path);
        throw error;
    }
}

// A rota agora é /api/upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo foi enviado.');
    }
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
         return res.status(500).send('O ID da pasta do Google Drive não está configurado no servidor.');
    }

    try {
        const driveFile = await uploadToDrive(req.file);
        res.status(200).json({ message: 'Upload bem-sucedido!', fileId: driveFile.id });
    } catch (error) {
        res.status(500).send('Falha ao enviar o arquivo para o Google Drive.');
    }
});

// Exporta o app para a Vercel
module.exports = app;
