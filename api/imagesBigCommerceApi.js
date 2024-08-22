const fetch = require('node-fetch');
require('dotenv').config()

let accessToken;
let storeHash;
let options;

async function getConfig(config) {
    const { accessToken, storeHash } = config;

    return {
        method: "GET",
        headers: {
            "X-Auth-Token": accessToken,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    };
}

async function getProductImages(config, productId) {
    const { storeHash } = config;
    const options = await getConfig(config);
    const imagesUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}/images`;

    const maxRetries = 5;
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            const response = await fetch(imagesUrl, options);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error! [${productId}/${storeHash}] status desde Images 47: ${response.status}, response text: ${errorText}`);
            } else {
                const data = await response.json();

                if (data.data && data.data.length > 0) {
                    const primerImagen = data.data.find(image => image.is_thumbnail) || null;
                    const ImagenesRestantes = data.data.filter(image => !image.is_thumbnail);
                    //console.log(`Finalmente la encontró después de ${attempts + 1} intento(s)!`);
                    return { primerImagen, ImagenesRestantes };
                } else {
                    return { primerImagen: null, ImagenesRestantes: [] };
                }
            }
        } catch (error) {
            console.error(`Error fetching product images (attempt ${attempts + 1}):`, error);
        }

        attempts += 1;
        if (attempts < maxRetries) {
            console.log(`Reintentando en 5 segundos... (Intento ${attempts + 1} de ${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.error(`No se pudo obtener las imágenes después de ${maxRetries} intentos.`);
    return { primerImagen: null, ImagenesRestantes: [] };
}



async function getURLImage(productId) {
    const imagesUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}/images`;

    try {
        const response = await fetch(imagesUrl, options);
        if (!response.ok) {
            console.error(`HTTP error! status Images URL: ${response}`);
            return []; // Retorna un array vacío en caso de error
        }
        const data = await response.json();
        return data.data[0]; // Retorna un array de URLs de imágenes
    } catch (error) {
        console.error('Error fetching product images 98:', error);
        return []; // Retorna un array vacío en caso de error
    }
}


module.exports = {
    getProductImages,
    getURLImage
};