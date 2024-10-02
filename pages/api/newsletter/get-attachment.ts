import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    const sanitizedFilename = path.basename(filename as string);
    const attachmentsDir = path.join('/tmp', 'attachments');  // Changed to /tmp directory
    const filePath = path.join(attachmentsDir, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ message: 'Error fetching attachment', error: error.message });
  }
}
