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

    try {
        const response = await fetch(imagesUrl, options);
        if (!response.ok) {
            const errorText = await response.text(); // Convert the response to text
            console.error(`HTTP error! [${productId}/${storeHash}] status desde Images 47: ${response.status}, response text: ${errorText}`);
            return { primerImagen: null, ImagenesRestantes: [] }; // Retorna un objeto con valores predeterminados en caso de error
        }
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const primerImagen = data.data.find(image => image.is_thumbnail) || null;
            const ImagenesRestantes = data.data.filter(image => !image.is_thumbnail);
            return { primerImagen, ImagenesRestantes }; // Retorna el primer elemento con is_thumbnail y el resto de imágenes
        } else {
            return { primerImagen: null, ImagenesRestantes: [] }; // Retorna objeto con valores predeterminados si no hay imágenes
        }
    } catch (error) {
        console.error('Error fetching product images:', error);
        return { primerImagen: null, ImagenesRestantes: [] }; // Retorna un objeto con valores predeterminados en caso de error
    }
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