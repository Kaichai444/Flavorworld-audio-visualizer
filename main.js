var { entrypoints } = require("uxp");
var { app, core } = require("photoshop");
var { executeAsModal } = core;

entrypoints.setup({
    commands: {
       
    },
    panels: {
        vanilla: {
            show(node) {
               
            }
        }
    }
});

async function showAlert(message) {
    await app.showAlert(message);
}

// binary conversions
function stringToBinary(str) {
    return Array.from(str)
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('');
}

function binaryToString(binary) {
    var binaryArr = binary.match(/.{1,8}/g);
    return binaryArr ? binaryArr.map(byte => String.fromCharCode(parseInt(byte, 2))).join('') : '';
}

function stringToUint8Array(str) {
    var encoder = new TextEncoder();
    return encoder.encode(str);
}

function uint8ArrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function encryptMessage(message, secretKey) {
    console.log('Encrypting message:', message, 'with key:', secretKey);

    var enc = new TextEncoder();
    var keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(secretKey),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    var key = await window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            "salt": enc.encode("unique-salt"),
            "iterations": 100000,
            "hash": "SHA-256"
        },
        keyMaterial,
        { "name": "AES-GCM", "length": 256 },
        false,
        ["encrypt", "decrypt"]
    );

    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        enc.encode(message)
    );

    var combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.byteLength);

    var result = uint8ArrayToHex(combined);
    console.log('Encrypted Message:', result);

    return result;
}

async function decryptMessage(encryptedMessage, secretKey) {
    var dec = new TextDecoder();
    var combined = hexToUint8Array(encryptedMessage);
    var iv = combined.slice(0, 12);
    var data = combined.slice(12);

    var keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        stringToUint8Array(secretKey),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    var key = await window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            "salt": stringToUint8Array("unique-salt"),
            "iterations": 100000,
            "hash": "SHA-256"
        },
        keyMaterial,
        { "name": "AES-GCM", "length": 256 },
        false,
        ["encrypt", "decrypt"]
    );

    try {
        var decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            data
        );

        return dec.decode(new Uint8Array(decrypted));
    } catch (e) {
        await showAlert("Decryption failed. Please check your secret key.");
        return null;
    }
}

async function getAllLayers() {
    var layers = [];
    var activeDocument = app.activeDocument;

    if (!activeDocument) {
        return layers;
    }

    
    async function traverseLayers(layersArray, parentPath = '') {
        for (let i = 0; i < layersArray.length; i++) {
            var layer = layersArray[i];
            var layerPath = parentPath ? `${parentPath}/${layer.name}` : layer.name;
            layers.push({ id: layer.id, name: layerPath });

            if (layer.isGroup) {
                await traverseLayers(layer.layers, layerPath);
            }
        }
    }

    await traverseLayers(activeDocument.layers);
    return layers;
}

document.getElementById('btnPopulate').addEventListener('click', populateLayers);
document.addEventListener('DOMContentLoaded', populateLayers);

async function populateLayers() {
    try {
        var layers = await executeAsModal(getAllLayers, { commandName: 'Get Layers' });
        console.log("Layers fetched:", layers);
        
        var layersContainer = document.getElementById('layers');
        layersContainer.innerHTML = ''; 
        if (layers.length === 0) {
            layersContainer.textContent = 'No layers available';
            return;
        }

        layers.forEach(layer => {
            var label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '8px';

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = layer.id;
            checkbox.id = `layer-${layer.id}`;

            var span = document.createElement('span');
            span.textContent = layer.name;
            span.style.marginLeft = '8px';

            label.appendChild(checkbox);
            label.appendChild(span);
            layersContainer.appendChild(label);
        });
    } catch (error) {
        console.error("Error populating layers:", error);
        await showAlert("Failed to load layers. Please ensure a document is open.");
    }
}

function derivePoisonLevel(key) {
    
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    var poisonLevel = Math.abs(hash) % 100 + 1; 
    return poisonLevel;
}

document.getElementById('retrieve-message').addEventListener('click', embedMessageInLayer);
async function embedMessageInLayer(layer, encryptedMessage) {
    var binaryMessage = stringToBinary(encryptedMessage) + '00000000'; 
    var pixels = await layer.pixelData;

    for (let i = 0, j = 0; i < pixels.length && j < binaryMessage.length; i += 4) {
        let red = pixels[i];
        let newRed = (red & 0xFE) | parseInt(binaryMessage[j]);
        pixels[i] = newRed;
        j++;
    }

    await layer.setPixelData(pixels);
}

document.getElementById('importLayersButton').addEventListener('click', importSelectedLayers);
async function importSelectedLayers() {
    var selectedLayerIds = Array.from(document.querySelectorAll('#layers input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));


    if (selectedLayerIds.length === 0) {
        await showAlert("No layers selected! Please select layers to encrypt.");
        return;
    }

    var encryptionKey = document.getElementById('encryption-key').value;
    var secretMessage = document.getElementById('secret-message').value;

    if (!encryptionKey || !secretMessage) {
        await showAlert("Please enter both an encryption key and a secret message.");
        return;
    }

    await encryptSelectedLayers(selectedLayerIds, encryptionKey, secretMessage);
}


setInterval(function() {
    var currentActiveLayer = app.activeDocument.activeLayer;
    var previousActiveLayer = app.activeDocument.previousActiveLayer;

    if (currentActiveLayer !== previousActiveLayer) {
        console.log("Active layer changed to: " + currentActiveLayer.name);

        previousActiveLayer = currentActiveLayer;
    }

    console.log('log status');

}, 100);

document.getElementById('btnEncrypt').addEventListener('click', encryptSelectedLayers);
async function encryptSelectedLayers() {
    var selectedLayerIds = Array.from(document.querySelectorAll('#layers input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));

    if (selectedLayerIds.length === 0) {
        await showAlert('Please select at least one layer to encrypt.');
        return;
    }

    var encryptionKey = document.getElementById('encryption-key').value;
    var secretMessage = document.getElementById('secret-message').value;

    console.log('Encryption Key:', encryptionKey);
    console.log('Secret Message', secretMessage);

    if (!encryptionKey || !secretMessage) {
        await showAlert('Please enter both an encryption key and a secret message.');
        return;
    }

    var encryptedMessage = await encryptMessage(secretMessage, encryptionKey);

    try {
        await executeAsModal(async () => {
            var activeDocument = app.activeDocument;

            for (let layerId of selectedLayerIds) {
                var layer = activeDocument.layers.getById(layerId);
                await embedMessageInLayer(layer, encryptedMessage);
            }
        }, { commandName: 'Encrypt Layers' });

        await showAlert('Selected layers have been encrypted successfully.');
    } catch (error) {
        console.error("Error encrypting layers:", error);
        await showAlert("Failed to encrypt selected layers.");
    }

    console.log('log status');
}

document.getElementById('save-encrypted-image').addEventListener('click', saveEncryptedImage);
async function saveEncryptedImage() {
    console.log('log status');
    var activeDocument = app.activeDocument;

    if (activeDocument) {
        
        var saveOptions = new core.SavePNGOptions();

        
        var saveLocation = await core.getFileForSaving({
            types: ["png"],
            initialFilename: "encrypted-image.png"
        });

        if (!saveLocation) {
            // User canceled the save dialog
            return;
        }

        try {
            
            await activeDocument.saveAs(saveLocation, saveOptions);

            await showAlert('Image with encrypted message has been saved successfully.');
        } catch (error) {
            console.error("Error saving image:", error);
            await showAlert("Failed to save the image.");
        }
    } else {
        await showAlert('No active document to save.');
    }
}

document.querySelector('#retrieve-message').addEventListener('click', retrieveMessage);
async function retrieveMessage() {
    var secretKey = document.querySelector('#secret-key').value;
    if (!secretKey) {
        await showAlert("Please enter the secret key.");
        return;
    }

    var activeDocument = app.activeDocument;

    if (activeDocument) {
        var layer = activeDocument.activeLayers[0];
        var pixels = await layer.pixelData;
        let binaryMessage = '';

        for (let i = 0; i < pixels.length; i += 4) {
            let red = pixels[i];
            binaryMessage += (red & 1);
        }

        var nullTerminatorIndex = binaryMessage.indexOf('00000000');
        if (nullTerminatorIndex === -1) {
            await showAlert("No hidden message found.");
            return;
        }

        var encryptedMessageBinary = binaryMessage.substring(0, nullTerminatorIndex);
        var encryptedMessage = binaryToString(encryptedMessageBinary);

        var decryptedMessage = await decryptMessage(encryptedMessage, secretKey);

        if (decryptedMessage) {
            await showAlert(`Decoded Message: ${decryptedMessage}`);
        }
    } else {
        await showAlert("No active document to retrieve the message from.");
    }
}



