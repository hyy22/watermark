// 状态管理
const state = {
    images: [], // 存储上传的图片对象
    selectedImages: new Set(), // 存储选中的图片索引
    currentImageIndex: -1, // 当前预览的图片索引
    watermarkSettings: {
        text: '',
        position: 'center',
        spacingX: 10,
        spacingY: 10,
        fontFamily: 'Arial',
        fontSize: 24,
        fontColor: '#000000',
        opacity: 100,
        rotation: 0
    },
    zoomLevel: 100
};

// DOM 元素
const elements = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),
    uploadFiles: document.getElementById('uploadFiles'),
    uploadFolder: document.getElementById('uploadFolder'),
    thumbnailList: document.getElementById('thumbnailList'),
    selectedCount: document.getElementById('selectedCount'),
    previewCanvas: document.getElementById('previewCanvas'),
    watermarkText: document.getElementById('watermarkText'),
    positionCells: document.querySelectorAll('.position-cell'),
    spacingX: document.getElementById('spacingX'),
    spacingY: document.getElementById('spacingY'),
    fontFamily: document.getElementById('fontFamily'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    opacity: document.getElementById('opacity'),
    rotation: document.getElementById('rotation'),
    zoomOut: document.getElementById('zoomOut'),
    zoomIn: document.getElementById('zoomIn'),
    zoomLevel: document.getElementById('zoomLevel')
};

// 文件上传处理
function initializeFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const uploadFiles = document.getElementById('uploadFiles');
    const uploadFolder = document.getElementById('uploadFolder');

    uploadFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        folderInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);
    folderInput.addEventListener('change', handleFileSelect);

    elements.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzone.classList.add('dragover');
    });

    elements.dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzone.classList.remove('dragover');
    });

    elements.dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropzone.classList.remove('dragover');

        const items = Array.from(e.dataTransfer.items);
        const files = [];

        async function processEntry(entry) {
            if (entry.isFile) {
                const file = await new Promise(resolve => entry.file(resolve));
                if (file.type.startsWith('image/')) {
                    files.push(file);
                }
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const entries = await new Promise(resolve => reader.readEntries(resolve));
                for (const entry of entries) {
                    await processEntry(entry);
                }
            }
        }

        for (const item of items) {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                await processEntry(entry);
            }
        }

        handleFiles(files);
    });
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/'));
    handleFiles(files);
}

// 处理文件
async function handleFiles(files) {
    for (const file of files) {
        try {
            const image = await loadImage(file);
            state.images.push({
                file,
                image,
                thumbnail: await createThumbnail(image)
            });
        } catch (error) {
            console.error('Error loading image:', error);
        }
    }
    
    updateThumbnailList();
    if (state.currentImageIndex === -1 && state.images.length > 0) {
        selectImage(0);
    }
}

// 加载图片
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// 创建缩略图
function createThumbnail(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const MAX_THUMB_SIZE = 100;
    
    // 计算缩略图尺寸
    let width = image.width;
    let height = image.height;
    
    if (width > height) {
        if (width > MAX_THUMB_SIZE) {
            height = height * (MAX_THUMB_SIZE / width);
            width = MAX_THUMB_SIZE;
        }
    } else {
        if (height > MAX_THUMB_SIZE) {
            width = width * (MAX_THUMB_SIZE / height);
            height = MAX_THUMB_SIZE;
        }
    }
    
    // 设置画布尺寸
    canvas.width = width;
    canvas.height = height;
    
    // 绘制缩略图
    ctx.drawImage(image, 0, 0, width, height);
    
    return canvas; // 返回 canvas 对象而不是 URL
}

// 更新缩略图列表
function updateThumbnailList() {
    elements.thumbnailList.innerHTML = '';
    state.images.forEach((item, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail';
        if (state.selectedImages.has(index)) {
            thumbnail.classList.add('selected');
        }
        
        const img = document.createElement('img');
        img.src = item.thumbnail.toDataURL('image/jpeg', 0.8); // 指定格式和质量
        
        const info = document.createElement('div');
        info.className = 'thumbnail-info';
        info.innerHTML = `
            <div class="thumbnail-name">${item.file.name}</div>
            <div class="thumbnail-size">${formatFileSize(item.file.size)}</div>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteImage(index);
        });
        
        thumbnail.appendChild(img);
        thumbnail.appendChild(info);
        thumbnail.appendChild(deleteBtn);
        
        thumbnail.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                toggleImageSelection(index);
            } else {
                selectImage(index);
            }
        });
        
        elements.thumbnailList.appendChild(thumbnail);
    });
    
    elements.selectedCount.textContent = state.selectedImages.size;
}

// 选择图片
function selectImage(index) {
    if (state.currentImageIndex !== index) {
        state.currentImageIndex = index;
        state.selectedImages.clear();
        state.selectedImages.add(index);
        updateThumbnailList();
        updatePreview();
    }
}

// 更新预览
function updatePreview() {
    if (state.currentImageIndex === -1) return;
    
    const canvas = elements.previewCanvas;
    const ctx = canvas.getContext('2d');
    const image = state.images[state.currentImageIndex].image;
    
    // 设置画布尺寸
    canvas.width = image.width;
    canvas.height = image.height;
    
    ctx.drawImage(image, 0, 0);
    applyWatermark(ctx, canvas.width, canvas.height);
    
    // 更新缩放
    updateZoom();
}

// 应用水印
function applyWatermark(ctx, width, height) {
    const settings = state.watermarkSettings;
    if (!settings.text) return;
    
    ctx.save();
    
    // 设置字体样式
    ctx.font = `${settings.fontSize}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.fontColor;
    ctx.globalAlpha = settings.opacity / 100;
    
    // 计算水印位置
    const textMetrics = ctx.measureText(settings.text);
    const textWidth = textMetrics.width;
    const textHeight = settings.fontSize;
    
    let x, y;
    switch (settings.position) {
        case 'top-left':
            x = settings.spacingX;
            y = textHeight + settings.spacingY;
            break;
        case 'top':
            x = (width - textWidth) / 2;
            y = textHeight + settings.spacingY;
            break;
        case 'top-right':
            x = width - textWidth - settings.spacingX;
            y = textHeight + settings.spacingY;
            break;
        case 'left':
            x = settings.spacingX;
            y = height / 2;
            break;
        case 'center':
            x = (width - textWidth) / 2;
            y = height / 2;
            break;
        case 'right':
            x = width - textWidth - settings.spacingX;
            y = height / 2;
            break;
        case 'bottom-left':
            x = settings.spacingX;
            y = height - settings.spacingY;
            break;
        case 'bottom':
            x = (width - textWidth) / 2;
            y = height - settings.spacingY;
            break;
        case 'bottom-right':
            x = width - textWidth - settings.spacingX;
            y = height - settings.spacingY;
            break;
    }
    
    // 应用旋转
    ctx.translate(x + textWidth / 2, y - textHeight / 2);
    ctx.rotate(settings.rotation * Math.PI / 180);
    ctx.translate(-(x + textWidth / 2), -(y - textHeight / 2));
    
    // 绘制水印
    ctx.fillText(settings.text, x, y);
    ctx.restore();
}

// 初始化事件监听
function initializeEventListeners() {
    // 水印文字输入
    elements.watermarkText.addEventListener('input', (e) => {
        state.watermarkSettings.text = e.target.value;
        updatePreview();
    });
    
    // 位置选择
    elements.positionCells.forEach(cell => {
        cell.addEventListener('click', () => {
            // 移除其他单元格的选中状态
            elements.positionCells.forEach(c => c.classList.remove('selected'));
            // 添加当前单元格的选中状态
            cell.classList.add('selected');
            
            state.watermarkSettings.position = cell.dataset.position;
            updatePreview();
        });
    });
    
    // 确保所有控件变化都触发预览更新
    const updateControls = [
        { element: elements.spacingX, property: 'spacingX', parser: parseInt },
        { element: elements.spacingY, property: 'spacingY', parser: parseInt },
        { element: elements.fontFamily, property: 'fontFamily' },
        { element: elements.fontSize, property: 'fontSize', parser: parseInt },
        { element: elements.fontColor, property: 'fontColor' },
        { element: elements.opacity, property: 'opacity', parser: parseInt },
        { element: elements.rotation, property: 'rotation', parser: parseInt }
    ];

    updateControls.forEach(control => {
        const eventType = control.element.type === 'range' ? 'input' : 'change';
        control.element.addEventListener(eventType, (e) => {
            const value = control.parser ? control.parser(e.target.value) : e.target.value;
            state.watermarkSettings[control.property] = value;
            requestAnimationFrame(updatePreview);
        });
    });
}

// 添加下载和重置功能
function initializeActionButtons() {
    // 下载当前图片
    document.getElementById('downloadSingle').addEventListener('click', () => {
        if (state.currentImageIndex === -1) return;
        downloadImage(state.currentImageIndex);
    });

    // 批量下载
    document.getElementById('downloadAll').addEventListener('click', downloadAllImages);

    // 重置功能
    document.getElementById('reset').addEventListener('click', () => {
        state.watermarkSettings = {
            text: '',
            position: 'center',
            spacingX: 10,
            spacingY: 10,
            fontFamily: 'Arial',
            fontSize: 24,
            fontColor: '#000000',
            opacity: 100,
            rotation: 0
        };
        
        // 重置所有控件
        elements.watermarkText.value = '';
        elements.spacingX.value = '10';
        elements.spacingY.value = '10';
        elements.fontFamily.value = 'Arial';
        elements.fontSize.value = '24';
        elements.fontColor.value = '#000000';
        elements.opacity.value = '100';
        elements.rotation.value = '0';
        
        // 清除选中的位置
        elements.positionCells.forEach(cell => {
            cell.classList.remove('selected');
        });
        const centerCell = Array.from(elements.positionCells)
            .find(cell => cell.dataset.position === 'center');
        if (centerCell) {
            centerCell.classList.add('selected');
        }
        
        updatePreview();
    });
}

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 辅助函数：创建进度提示
function createProgressOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'progress-overlay';
    overlay.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar"></div>
            <div class="progress-text">准备中...</div>
        </div>
    `;
    return overlay;
}

// 辅助函数：更新进度
function updateProgress(overlay, current, total) {
    const progress = (current / total) * 100;
    overlay.querySelector('.progress-bar').style.width = `${progress}%`;
    overlay.querySelector('.progress-text').textContent = 
        `处理中... ${current}/${total}`;
}

// 添加删除图片功能
function deleteImage(index) {
    state.images.splice(index, 1);
    state.selectedImages.delete(index);
    
    // 更新大于被删除索引的选中项
    const newSelected = new Set();
    state.selectedImages.forEach(i => {
        if (i < index) newSelected.add(i);
        else if (i > index) newSelected.add(i - 1);
    });
    state.selectedImages = newSelected;
    
    // 更新当前选中的图片
    if (state.currentImageIndex === index) {
        state.currentImageIndex = state.images.length > 0 ? 0 : -1;
    } else if (state.currentImageIndex > index) {
        state.currentImageIndex--;
    }
    
    updateThumbnailList();
    updatePreview();
}

// 添加位置选择器初始化函数
function initializePositionSelector() {
    // 初始化时设置中心位置为选中状态
    const centerCell = Array.from(elements.positionCells)
        .find(cell => cell.dataset.position === 'center');
    if (centerCell) {
        centerCell.classList.add('selected');
    }

    // 为每个位置单元格添加点击事件
    elements.positionCells.forEach(cell => {
        cell.addEventListener('click', () => {
            // 移除所有单元格的选中状态
            elements.positionCells.forEach(c => c.classList.remove('selected'));
            // 添加当前单元格的选中状态
            cell.classList.add('selected');
            
            // 更新水印设置
            state.watermarkSettings.position = cell.dataset.position;
            // 更新预览
            updatePreview();
        });
    });
}

// 添加图片多选功能
function toggleImageSelection(index) {
    if (state.selectedImages.has(index)) {
        state.selectedImages.delete(index);
        if (state.currentImageIndex === index) {
            // 如果取消选择当前预览的图片，切换到其他选中的图片
            const selectedIndices = Array.from(state.selectedImages);
            state.currentImageIndex = selectedIndices.length > 0 ? selectedIndices[0] : -1;
        }
    } else {
        state.selectedImages.add(index);
        if (state.currentImageIndex === -1) {
            // 如果当前没有选中的图片，设置为新选中的图片
            state.currentImageIndex = index;
        }
    }
    
    updateThumbnailList();
    updatePreview();
}

// 添加下载单张图片功能
function downloadImage(index) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const image = state.images[index].image;
    
    canvas.width = image.width;
    canvas.height = image.height;
    
    ctx.drawImage(image, 0, 0);
    applyWatermark(ctx, canvas.width, canvas.height);
    
    // 创建下载链接
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `watermark_${state.images[index].file.name}`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// 修改批量下载功能
async function downloadAllImages() {
    const selectedIndices = state.selectedImages.size > 0 
        ? Array.from(state.selectedImages)
        : state.images.map((_, i) => i);
        
    if (selectedIndices.length === 0) return;

    // 创建进度提示
    const progressOverlay = createProgressOverlay();
    document.body.appendChild(progressOverlay);

    try {
        const zip = new JSZip();
        
        for (let i = 0; i < selectedIndices.length; i++) {
            const index = selectedIndices[i];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const image = state.images[index].image;
            
            canvas.width = image.width;
            canvas.height = image.height;
            
            ctx.drawImage(image, 0, 0);
            applyWatermark(ctx, canvas.width, canvas.height);
            
            // 转换为Blob并添加到zip
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
            
            zip.file(`watermark_${state.images[index].file.name}`, blob);
            
            // 更新进度
            updateProgress(progressOverlay, i + 1, selectedIndices.length);
        }
        
        // 生成并下载zip文件
        const blob = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'watermarked_images.zip';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error during batch download:', error);
        alert('下载过程中出现错误，请重试');
    } finally {
        document.body.removeChild(progressOverlay);
    }
}

// 添加缩放功能
function initializeZoomControls() {
    elements.zoomOut.addEventListener('click', () => {
        if (state.zoomLevel > 25) {
            state.zoomLevel = Math.max(25, state.zoomLevel - 25);
            updateZoom();
        }
    });

    elements.zoomIn.addEventListener('click', () => {
        if (state.zoomLevel < 400) {
            state.zoomLevel = Math.min(400, state.zoomLevel + 25);
            updateZoom();
        }
    });
}

// 更新缩放
function updateZoom() {
    elements.zoomLevel.textContent = `${state.zoomLevel}%`;
    elements.previewCanvas.style.transform = `scale(${state.zoomLevel / 100})`;
    elements.previewCanvas.style.transformOrigin = 'center center';
}

// 修改初始化函数
function initialize() {
    initializeFileUpload();
    initializeEventListeners();
    initializePositionSelector();
    initializeActionButtons();
    initializeZoomControls(); // 添加缩放控制初始化
}

// 启动应用
initialize(); 