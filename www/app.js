let qrInstance = null;
let cameraStream = null;
let isScanned = false;
let isCameraActive = false;

function showToast(message, type = 'info') {
    let toast = document.getElementById('live-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'live-toast';
        toast.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] max-w-[90%] px-3 py-2 text-[11px] font-semibold rounded-full border shadow-lg opacity-0 transition-all duration-300';
        toast.style.backdropFilter = 'blur(10px)';
        document.body.appendChild(toast);
    }

    const palette = {
        info: 'bg-slate-900 text-white border-slate-700',
        success: 'bg-emerald-600 text-white border-emerald-500',
        danger: 'bg-red-500 text-white border-red-400'
    };

    toast.className = `fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] max-w-[90%] px-3 py-2 text-[11px] font-semibold rounded-full border shadow-lg opacity-100 transition-all duration-300 ${palette[type] || palette.info}`;
    toast.textContent = message;

    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 2200);
}

function switchTab(tab) {
    const scannerView = document.getElementById('view-scanner');
    const generatorView = document.getElementById('view-generator');
    const scannerBtn = document.getElementById('tab-scanner-btn');
    const generatorBtn = document.getElementById('tab-generator-btn');

    if (tab === 'scanner') {
        scannerView.classList.remove('hidden');
        generatorView.classList.add('hidden');
        scannerBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition-all duration-200";
        generatorBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition-all duration-200";
    } else {
        scannerView.classList.add('hidden');
        generatorView.classList.remove('hidden');
        generatorBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition-all duration-200";
        scannerBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition-all duration-200";
    }
}

function showPermissionModal() {
    document.getElementById('permission-modal').classList.remove('hidden');
}

function hidePermissionModal() {
    document.getElementById('permission-modal').classList.add('hidden');
}

function normalizePhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = phone.toString().replace(/\D/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('62')) return cleaned;
    if (cleaned.startsWith('0')) return `62${cleaned.slice(1)}`;
    return cleaned.startsWith('8') ? `62${cleaned}` : cleaned;
}

async function requestCameraAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Browser Anda tidak mendukung kamera. Coba pilih file QR dari galeri.', 'danger');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        cameraStream = stream;
        hidePermissionModal();
        showToast('Akses kamera berhasil diizinkan.', 'success');
        startCameraScanner();
    } catch (error) {
        console.error('Camera permission denied:', error);
        hidePermissionModal();
        showToast('Kamera tidak diizinkan. Anda masih bisa memilih file QR.', 'info');
    }
}

function stopCameraScanner() {
    const video = document.getElementById('camera-video');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    isCameraActive = false;
}

function startCameraScanner() {
    const video = document.getElementById('camera-video');
    if (!video) return;

    stopCameraScanner();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Browser tidak mendukung kamera, silakan pilih file QR.', 'danger');
        return;
    }

    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    }).then(stream => {
        cameraStream = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        video.play();
        isCameraActive = true;
        scanFromCameraLoop();
    }).catch(err => {
        console.error('Kamera error/izin ditolak: ', err);
        showToast('Akses kamera ditolak. Anda bisa memilih file QR dari galeri.', 'info');
    });
}

function scanFromCameraLoop() {
    const video = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!isCameraActive || !video || video.readyState < 2) {
        requestAnimationFrame(scanFromCameraLoop);
        return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width && height) {
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, width, height, {
            inversionAttempts: 'dontInvert'
        });

        if (code) {
            handleDecodedData(code.data);
            return;
        }
    }

    requestAnimationFrame(scanFromCameraLoop);
}

function handleDecodedData(decodedText) {
    if (isScanned) return;
    isScanned = true;
    stopCameraScanner();

    const dataParts = decodedText.split('|');
    const nama = dataParts[0] ? dataParts[0].trim() : 'Siswa';
    const kelas = dataParts[1] ? dataParts[1].trim() : '-';
    const noOrtu = normalizePhoneNumber(dataParts[2] ? dataParts[2].trim() : '');

    document.getElementById('student-info').innerHTML = `
        <strong>${nama}</strong> <br> Kelas: ${kelas}
    `;

    const pesanWA = `${nama} hadir!`;
    const encodedPesan = encodeURIComponent(pesanWA);
    const waUrl = noOrtu ? `https://api.whatsapp.com/send?phone=${noOrtu}&text=${encodedPesan}` : `https://api.whatsapp.com/send?text=${encodedPesan}`;

    document.getElementById('result-container').classList.remove('hidden');
    document.getElementById('btn-rescan').classList.remove('hidden');

    setTimeout(() => {
        window.location.href = waUrl;
    }, 1000);
}

function decodeQrFromFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code) {
                handleDecodedData(code.data);
            } else {
                alert('QR dari file tidak terbaca. Coba file gambar QR yang jelas dan valid.');
            }
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function bindFileUpload() {
    const fileInput = document.getElementById('file-qrcode-input');
    const fileButton = document.getElementById('btn-upload-qr');

    fileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            decodeQrFromFile(file);
        }
    });
}

function setupPermissionFlow() {
    const grantBtn = document.getElementById('grant-access-btn');
    const continueBtn = document.getElementById('continue-without-camera-btn');

    grantBtn.addEventListener('click', requestCameraAccess);
    continueBtn.addEventListener('click', () => {
        hidePermissionModal();
        showToast('Akses kamera dibatalkan. Anda bisa tetap memilih file QR.', 'info');
    });
}

function generateQRCode() {
    const nama = document.getElementById('gen-nama').value.trim();
    const kelas = document.getElementById('gen-kelas').value.trim();
    const hp = document.getElementById('gen-hp').value.trim();

    if (!nama || !kelas || !hp) {
        alert('Harap lengkapi semua data siswa terlebih dahulu, ZxD!');
        return;
    }

    const combinedData = `${nama}|${kelas}|${hp}`;
    const qrElement = document.getElementById('qrcode');
    qrElement.innerHTML = '';

    qrInstance = new QRCode(qrElement, {
        text: combinedData,
        width: 200,
        height: 200,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('qrcode-container').classList.remove('hidden');

    setTimeout(() => {
        const img = qrElement.querySelector('img') || qrElement.querySelector('canvas');
        const downloadBtn = document.getElementById('download-btn');

        if (img) {
            const fileName = `QR-${nama.replace(/\s+/g, '_')}-${kelas}.png`;
            downloadBtn.onclick = () => {
                const dataUrl = img.tagName === 'CANVAS' ? img.toDataURL('image/png') : img.src;
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showToast('QR berhasil disimpan ke file.', 'success');
            };
        }
    }, 400);
}

window.addEventListener('load', () => {
    setupPermissionFlow();
    bindFileUpload();

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';

        setTimeout(() => {
            showPermissionModal();
        }, 300);
    }, 1200);
});

window.addEventListener('beforeunload', () => {
    stopCameraScanner();
});

window.showToast = showToast;
window.switchTab = switchTab;
window.requestCameraAccess = requestCameraAccess;
window.generateQRCode = generateQRCode;
window.handleDecodedData = handleDecodedData;
window.decodeQrFromFile = decodeQrFromFile;
window.startCameraScanner = startCameraScanner;
window.stopCameraScanner = stopCameraScanner;

window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
};

