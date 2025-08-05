const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const dir = 'uploads';
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

let imageLibrary = [];

async function ensureDirectories() {
  await fs.mkdir('uploads', { recursive: true });
  await fs.mkdir('generated-images', { recursive: true });
}

ensureDirectories();

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, apiKey, imageId, count = 1, size = "1024x1024", quality = "medium" } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: size,
      quality: quality,
      n: Math.min(count, 10),
    });
    
    const images = response.data.map((item, index) => {
      const imageId = uuidv4();
      const imageData = {
        id: imageId,
        url: item.url,
        prompt: prompt,
        timestamp: new Date().toISOString(),
        history: [{
          prompt: prompt,
          url: item.url,
          timestamp: new Date().toISOString()
        }]
      };
      imageLibrary.push(imageData);
      return imageData;
    });
    
    res.json({ images });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/modify-image', async (req, res) => {
  try {
    const { imageId, modification, apiKey, currentPrompt } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const modifiedPrompt = `${currentPrompt}. Modification: ${modification}`;
    
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: modifiedPrompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    
    const imageUrl = response.data[0].url;
    
    const imageIndex = imageLibrary.findIndex(img => img.id === imageId);
    if (imageIndex >= 0) {
      imageLibrary[imageIndex].history.push({
        prompt: modifiedPrompt,
        url: imageUrl,
        timestamp: new Date().toISOString(),
        modification: modification
      });
      imageLibrary[imageIndex].url = imageUrl;
      imageLibrary[imageIndex].prompt = modifiedPrompt;
    }
    
    res.json({
      id: imageId,
      url: imageUrl,
      prompt: modifiedPrompt,
      modification: modification
    });
  } catch (error) {
    console.error('Error modifying image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/library', (req, res) => {
  res.json(imageLibrary);
});

app.delete('/api/library/:id', (req, res) => {
  const { id } = req.params;
  imageLibrary = imageLibrary.filter(img => img.id !== id);
  res.json({ success: true });
});

app.get('/api/image/:id', (req, res) => {
  const { id } = req.params;
  const image = imageLibrary.find(img => img.id === id);
  if (image) {
    res.json(image);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});