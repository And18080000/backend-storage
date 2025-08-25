const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());

const upload = multer({ dest: '/tmp' });

// --- CONFIGURAÇÕES DO GOOGLE DRIVE ---
try {
    const keyFileContent = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!keyFileContent) {
        throw new Error("A variável de ambiente GOOGLE_CREDENTIALS_JSON não está definida.");
    }
    
    // Substitui sequências de escape literais por caracteres reais
    const parsedKeyFileContent = keyFileContent.replace(/\\n/g, '\n');
    const credentials = JSON.parse(parsedKeyFileContent);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    async function uploadToDrive(file) {
        const drive = google.drive({ version: 'v3', auth });
        
        const fileMetadata = {
            name: file.originalname,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
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
            
            fs.unlinkSync(file.path);
            return response.data;
        } catch (error) {
            // Log do erro detalhado da API do Google
            console.error('Erro da API do Google:', error.response ? error.response.data : error.message);
            fs.unlinkSync(file.path);
            throw new Error('Falha ao comunicar com a API do Google Drive.');
        }
    }

    app.post('/api/upload', upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).send('Nenhum ficheiro foi enviado.');
        }
        if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
             return res.status(500).send('O ID da pasta do Google Drive não está configurado no servidor.');
        }

        try {
            const driveFile = await uploadToDrive(req.file);
            res.status(200).json({ message: 'Upload bem-sucedido!', fileId: driveFile.id });
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

} catch (error) {
    // Erro crítico ao iniciar o servidor (provavelmente JSON inválido)
    console.error("Erro Crítico ao Iniciar:", error.message);
    // Endpoint de erro para que saibamos que as credenciais estão erradas
    app.post('/api/upload', (req, res) => {
        res.status(500).send(`Erro de configuração do servidor: ${error.message}`);
    });
}

module.exports = app;