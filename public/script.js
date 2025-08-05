let currentApiKey = '';
let currentImageId = null;
let currentImageData = null;

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const promptInput = document.getElementById('prompt');
    const generateBtn = document.getElementById('generateBtn');
    const modificationInput = document.getElementById('modificationInput');
    const modifyBtn = document.getElementById('modifyBtn');
    const refreshLibraryBtn = document.getElementById('refreshLibrary');
    
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        currentApiKey = savedApiKey;
    }
    
    saveApiKeyBtn.addEventListener('click', () => {
        currentApiKey = apiKeyInput.value;
        localStorage.setItem('openai_api_key', currentApiKey);
        showMessage('API Key saved successfully!', 'success');
    });
    
    generateBtn.addEventListener('click', generateImage);
    modifyBtn.addEventListener('click', modifyImage);
    refreshLibraryBtn.addEventListener('click', loadLibrary);
    
    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateImage();
        }
    });
    
    modificationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            modifyImage();
        }
    });
    
    loadLibrary();
    setupAdvancedOptions();
});

function setupAdvancedOptions() {
    const promptContainer = document.querySelector('.prompt-container');
    
    const advancedOptions = document.createElement('div');
    advancedOptions.className = 'advanced-options';
    advancedOptions.innerHTML = `
        <details class="options-details">
            <summary>Advanced Options</summary>
            <div class="options-grid">
                <div class="option-group">
                    <label for="imageCount">Number of Images</label>
                    <input type="number" id="imageCount" min="1" max="10" value="1" class="option-input">
                </div>
                <div class="option-group">
                    <label for="imageSize">Size</label>
                    <select id="imageSize" class="option-select">
                        <option value="1024x1024">1024x1024</option>
                        <option value="512x512">512x512</option>
                        <option value="256x256">256x256</option>
                    </select>
                </div>
                <div class="option-group">
                    <label for="imageQuality">Quality</label>
                    <select id="imageQuality" class="option-select">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="auto">Auto</option>
                    </select>
                </div>
            </div>
        </details>
    `;
    
    promptContainer.insertBefore(advancedOptions, generateBtn);
}

async function generateImage() {
    const prompt = document.getElementById('prompt').value.trim();
    const count = parseInt(document.getElementById('imageCount').value);
    const size = document.getElementById('imageSize').value;
    const quality = document.getElementById('imageQuality').value;
    
    if (!prompt) {
        showMessage('Please enter a prompt', 'error');
        return;
    }
    
    if (!currentApiKey) {
        showMessage('Please enter your API key', 'error');
        return;
    }
    
    const generateBtn = document.getElementById('generateBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const imageDisplay = document.getElementById('imageDisplay');
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    loadingSpinner.style.display = 'flex';
    imageDisplay.querySelector('.placeholder').style.display = 'none';
    
    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                apiKey: currentApiKey,
                count,
                size,
                quality
            }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate image');
        }
        
        if (count === 1) {
            displayImage(data.images[0]);
            currentImageId = data.images[0].id;
            currentImageData = data.images[0];
            
            document.getElementById('modificationSection').style.display = 'block';
            document.getElementById('chatHistory').innerHTML = '';
        } else {
            displayMultipleImages(data.images);
            document.getElementById('modificationSection').style.display = 'none';
        }
        
        loadLibrary();
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
        imageDisplay.querySelector('.placeholder').style.display = 'block';
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Image';
        loadingSpinner.style.display = 'none';
    }
}

function displayImage(imageData) {
    const imageDisplay = document.getElementById('imageDisplay');
    const generatedImage = document.getElementById('generatedImage');
    
    generatedImage.src = imageData.url;
    generatedImage.style.display = 'block';
    imageDisplay.querySelector('.placeholder').style.display = 'none';
}

function displayMultipleImages(images) {
    const imageDisplay = document.getElementById('imageDisplay');
    imageDisplay.innerHTML = `
        <div class="multiple-images-grid">
            ${images.map(img => `
                <div class="grid-image-item" onclick="selectImage('${img.id}')">
                    <img src="${img.url}" alt="${img.prompt}">
                </div>
            `).join('')}
        </div>
    `;
}

window.selectImage = async function(imageId) {
    try {
        const response = await fetch(`/api/image/${imageId}`);
        const imageData = await response.json();
        
        currentImageId = imageId;
        currentImageData = imageData;
        
        displayImage(imageData);
        document.getElementById('modificationSection').style.display = 'block';
        document.getElementById('chatHistory').innerHTML = '';
        
        if (imageData.history && imageData.history.length > 1) {
            imageData.history.forEach((item, index) => {
                if (index > 0 && item.modification) {
                    addChatMessage(item.modification, 'user');
                }
            });
        }
    } catch (error) {
        showMessage(`Error loading image: ${error.message}`, 'error');
    }
};

async function modifyImage() {
    const modification = document.getElementById('modificationInput').value.trim();
    
    if (!modification || !currentImageId || !currentImageData) {
        showMessage('Please generate an image first and enter a modification', 'error');
        return;
    }
    
    const modifyBtn = document.getElementById('modifyBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    modifyBtn.disabled = true;
    modifyBtn.textContent = 'Modifying...';
    loadingSpinner.style.display = 'flex';
    
    addChatMessage(modification, 'user');
    
    try {
        const response = await fetch('/api/modify-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageId: currentImageId,
                modification,
                apiKey: currentApiKey,
                currentPrompt: currentImageData.prompt
            }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to modify image');
        }
        
        displayImage(data);
        currentImageData = data;
        
        document.getElementById('modificationInput').value = '';
        loadLibrary();
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        modifyBtn.disabled = false;
        modifyBtn.textContent = 'Modify';
        loadingSpinner.style.display = 'none';
    }
}

function addChatMessage(message, type) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.textContent = message;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function loadLibrary() {
    try {
        const response = await fetch('/api/library');
        const images = await response.json();
        
        const libraryContainer = document.getElementById('imageLibrary');
        
        if (images.length === 0) {
            libraryContainer.innerHTML = '<p class="empty-library">No images yet. Generate your first image!</p>';
            return;
        }
        
        libraryContainer.innerHTML = images.map(image => `
            <div class="library-item" onclick="selectImage('${image.id}')">
                <img src="${image.url}" alt="${image.prompt}">
                <div class="library-item-overlay">
                    <span class="library-item-date">${new Date(image.timestamp).toLocaleDateString()}</span>
                </div>
                <button class="delete-btn" onclick="deleteImage(event, '${image.id}')">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading library:', error);
    }
}

window.deleteImage = async function(event, imageId) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/library/${imageId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadLibrary();
            if (currentImageId === imageId) {
                currentImageId = null;
                currentImageData = null;
                document.getElementById('generatedImage').style.display = 'none';
                document.getElementById('imageDisplay').querySelector('.placeholder').style.display = 'block';
                document.getElementById('modificationSection').style.display = 'none';
            }
        }
    } catch (error) {
        showMessage(`Error deleting image: ${error.message}`, 'error');
    }
};

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .advanced-options {
        margin-top: 1rem;
    }
    
    .options-details {
        background: var(--bg-primary);
        border-radius: 0.5rem;
        padding: 0.75rem;
    }
    
    .options-details summary {
        cursor: pointer;
        font-weight: 500;
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    .options-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-top: 1rem;
    }
    
    .option-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .option-group label {
        font-size: 0.875rem;
        color: var(--text-secondary);
    }
    
    .option-input, .option-select {
        padding: 0.5rem;
        border: 1px solid var(--border-color);
        border-radius: 0.375rem;
        font-size: 0.875rem;
        background: var(--bg-primary);
        color: var(--text-primary);
    }
    
    .multiple-images-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        padding: 0.5rem;
        width: 100%;
        height: 100%;
    }
    
    .grid-image-item {
        cursor: pointer;
        border-radius: 0.5rem;
        overflow: hidden;
        transition: all 0.2s;
        border: 2px solid transparent;
    }
    
    .grid-image-item:hover {
        border-color: var(--primary-color);
        transform: scale(1.02);
    }
    
    .grid-image-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .empty-library {
        text-align: center;
        color: var(--text-secondary);
        padding: 2rem;
    }
`;
document.head.appendChild(style);