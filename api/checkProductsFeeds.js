const fetch = require("node-fetch");
const axios = require("axios");
require("dotenv").config();

const {
    fetchWithRetry,
} = require("../helpers/helpers");



function createOAuthConnection(config) {
    const { accessToken, storeHash } = config;
    return axios.create({
        baseURL: `https://api.bigcommerce.com/stores/${storeHash}/v3/`,
        headers: {
            "X-Auth-Token": accessToken,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        timeout: 40000, // 30 segundos
        httpAgent: new (require('http').Agent)({ keepAlive: true }),
        httpsAgent: new (require('https').Agent)({ keepAlive: true })
    });
}

function extractRateLimitInfo(rateLimitHeaders) {
    const requestsQuota = parseInt(
        rateLimitHeaders["X-Rate-Limit-Requests-Quota"],
        10
    );
    const requestsLeft = parseInt(
        rateLimitHeaders["X-Rate-Limit-Requests-Left"],
        10
    );
    const resetTime = parseInt(
        rateLimitHeaders["X-Rate-Limit-Time-Reset-Ms"],
        10
    );
    return { requestsQuota, requestsLeft, resetTime };
}

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

async function fetchWithRateLimitInfo(url, connection, retries = 3, backoff = 1000) {
    try {
        const response = await connection.get(url);
        const rateLimitInfo = {
            'X-Rate-Limit-Time-Window-Ms': response.headers['x-rate-limit-time-window-ms'],
            'X-Rate-Limit-Time-Reset-Ms': response.headers['x-rate-limit-time-reset-ms'],
            'X-Rate-Limit-Requests-Quota': response.headers['x-rate-limit-requests-quota'],
            'X-Rate-Limit-Requests-Left': response.headers['x-rate-limit-requests-left']
        };
        return { data: response.data, rateLimitInfo };
    } catch (error) {
        if (error.response) {
            const status = error.response.status;

            if (status === 429) {
                const resetTime = error.response.headers['x-rate-limit-time-reset-ms'];
                console.log(`Rate limit hit, waiting for ${resetTime} ms`);
                await new Promise(resolve => setTimeout(resolve, resetTime));
                return fetchWithRateLimitInfo(url, connection, retries, backoff); // Reintentar después de esperar
            } else if (status === 503 && retries > 0) {
                console.log(`Service unavailable, retrying in ${backoff} ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return fetchWithRateLimitInfo(url, connection, retries - 1, backoff * 2); // Reintentar con backoff exponencial
            } else if (status >= 500 && status < 600 && retries > 0) {
                // Manejar otros errores de servidor 5xx
                console.log(`Server error ${status}, retrying in ${backoff} ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return fetchWithRateLimitInfo(url, connection, retries - 1, backoff * 2); // Reintentar con backoff exponencial
            } else {
                console.error('Error fetching data:', error.message, 'Status code:', status);
                throw error;
            }
        } else if (error.code === 'EADDRNOTAVAIL' && retries > 0) {
            // Manejar el error EADDRNOTAVAIL
            console.log(`Address not available, retrying in ${backoff} ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRateLimitInfo(url, connection, retries - 1, backoff * 2); // Reintentar con backoff exponencial
        } else {
            console.error('Error fetching data:', error.message);
            throw error;
        }
    }
}



/*
async function checkCustomFieldFeed(config, productId) {
    const { apiInfo, storeHash } = config;
    const customFieldGroups = apiInfo.customFields;
    if (!customFieldGroups || customFieldGroups.length === 0) {
        return true;
    }
    const optionsGET = await getConfig(config);
    const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}/custom-fields`;

    try {
        const response = await fetchWithRetry(url, optionsGET);
        if (response.ok) {
            const data = await response.json();
            return customFieldGroups.every(group => {
                if (group.logic === "AND") {
                    return group.fields.every(customField =>
                        data.data.some(
                            field => field.name === customField.name && field.value === customField.value
                        )
                    );
                } else if (group.logic === "OR") {
                    return group.fields.some(customField =>
                        data.data.some(
                            field => field.name === customField.name && field.value === customField.value
                        )
                    );
                }
                return false;
            });
        } else {
            console.error(`HTTP error! status: ${response.status}`);
            console.log("Response:", await response.text());
            return false;
        }
    } catch (error) {
        console.error(
            "Error fetching custom fields for product:",
            productId,
            error
        );
        return false;
    }
}
*/

async function checkCustomFieldFeed(config, productId) {
    const { apiInfo, storeHash } = config;
    const customFieldGroups = apiInfo.customFields;
    if (!customFieldGroups || customFieldGroups.length === 0) {
        return true;
    }

    const connection = createOAuthConnection(config);
    const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${productId}/custom-fields`;

    try {
        const response = await fetchWithRateLimitInfo(url, connection);

        // Obtener y manejar los límites de tasa
        const { requestsQuota, requestsLeft, resetTime } = extractRateLimitInfo(response.rateLimitInfo);

        // Calcular si estamos por encima del 85% del límite
        if (requestsLeft <= requestsQuota * 0.15) {
            console.log("Ha llegado al 85% del limite");
            await new Promise((resolve) => setTimeout(resolve, resetTime));
        }

        if (response.data) {
            // Verificar los grupos de campos personalizados según la lógica AND/OR
            return customFieldGroups.every((group) => {
                if (group.logic === "AND") {
                    return group.fields.every((customField) =>
                        response.data.data.some(
                            (field) =>
                                field.name === customField.name &&
                                field.value === customField.value
                        )
                    );
                } else if (group.logic === "OR") {
                    return group.fields.some((customField) =>
                        response.data.data.some(
                            (field) =>
                                field.name === customField.name &&
                                field.value === customField.value
                        )
                    );
                }
                return false;
            });
        } else {
            console.error(`HTTP error! status: ${response.status}`);
            return false;
        }
    } catch (error) {
        if (error.code === 'EADDRNOTAVAIL') {
            console.error(`Error de dirección no disponible al buscar campos personalizados para el producto: ${productId}. Reintentando...`);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Esperar un momento antes de reintentar
            return checkCustomFieldFeed(config, productId); // Reintentar la función
        } else {
            console.error(
                "Error fetching custom fields for product:",
                productId,
                error.message
            );
            return false;
        }
    }
}



/*
async function getAvailableProductsFeed(config, startPage, endPage) {
    const { storeHash, apiInfo } = config;
    //const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products`;
    const baseUrl = apiInfo.url;
    let totalValidCount = 0; // Contador para todos los productos válidos

    const totalPages = endPage - startPage + 1;
    console.log("Total de páginas: ", totalPages);
    console.log("Pag de inicio: ", startPage);
    console.log("Pag de Final: ", endPage);
    console.log("StoreHash: ", storeHash);
    const segmentSize = Math.ceil(totalPages / 20); // Divide en 20 partes o segmentos
    const tasks = [];

    console.time("getAvailableProducts-Concurrent");

    for (let i = 0; i < 20; i++) {
        const segmentStartPage = startPage + i * segmentSize;
        const segmentEndPage =
            segmentStartPage + segmentSize - 1 <= endPage
                ? segmentStartPage + segmentSize - 1
                : endPage;
        if (segmentStartPage <= segmentEndPage) {

            tasks.push(processPagesFeed(config, segmentStartPage, segmentEndPage));
        }
    }

    const results = await Promise.all(tasks);
    let allValidProductIds = []; // Array para juntar todos los IDs válidos
    results.forEach((result) => {
        totalValidCount += result.count; // Suma de todos los productos válidos encontrados en todos los segmentos
        allValidProductIds = allValidProductIds.concat(result.validProductIds); // Concatena los IDs de productos válidos de cada segmento
    });

    console.timeEnd("getAvailableProducts-Concurrent");
    console.log(`Total valid products processed: ${totalValidCount}`);
    return { allValidProductIds, totalValidCount };
}
*/

async function getAvailableProductsFeed(config, startPage, endPage) {
    const { storeHash, apiInfo } = config;
    const baseUrl = apiInfo.url;
    let totalValidCount = 0; // Contador para todos los productos válidos

    const totalPages = endPage - startPage + 1;
    console.log("Total de páginas: ", totalPages);
    console.log("Pag de inicio: ", startPage);
    console.log("Pag de Final: ", endPage);
    console.log("StoreHash: ", storeHash);
    const segmentSize = Math.ceil(totalPages / 7); // Divide en 7 partes o segmentos
    const tasks = [];

    console.time("getAvailableProducts-Concurrent");

    for (let i = 0; i < 15; i++) {
        const segmentStartPage = startPage + i * segmentSize;
        const segmentEndPage =
            segmentStartPage + segmentSize - 1 <= endPage
                ? segmentStartPage + segmentSize - 1
                : endPage;
        if (segmentStartPage <= segmentEndPage) {
            tasks.push(processPagesFeed(config, segmentStartPage, segmentEndPage));
        }
    }

    const results = await Promise.all(tasks);
    let allValidProductIds = []; // Array para juntar todos los IDs válidos
    results.forEach((result) => {
        totalValidCount += result.count; // Suma de todos los productos válidos encontrados en todos los segmentos
        allValidProductIds = allValidProductIds.concat(result.validProductIds); // Concatena los IDs de productos válidos de cada segmento
    });

    console.timeEnd("getAvailableProducts-Concurrent");
    console.log(`Total valid products processed: ${totalValidCount}`);
    return { allValidProductIds, totalValidCount };
}

/*
async function processPagesFeed(config, taskStartPage, taskEndPage) {
    const { storeHash, apiInfo } = config;
    const optionsGET = await getConfig(config);

    let baseUrl = apiInfo.url;
    if (baseUrl.includes('?')) {
        baseUrl += '&';
    } else {
        baseUrl += '?';
    }
    let validProductIds = [];
    let count = 0;

    for (let page = taskStartPage; page <= taskEndPage; page++) {
        const url = `${baseUrl}page=${page}&limit=300`;
        //console.log("URL iterada: ", url);

        try {
            const response = await fetch(url, optionsGET);

            // Validar el estado de la respuesta
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Validar la estructura de la respuesta
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error(`Unexpected response structure: ${JSON.stringify(data)}`);
            }

            for (let product of data.data) {
                const isValid = await checkCustomFieldFeed(config, product.id);

                if (isValid) {
                    validProductIds.push(product);
                    count++;
                }
            }
        } catch (error) {
            console.error(`Error processing page ${page}:`, error.message);
        }
    }
    return { validProductIds, count };
}
*/

async function processPagesFeed(config, taskStartPage, taskEndPage) {
    const { storeHash, apiInfo } = config;
    const optionsGET = await getConfig(config);

    let baseUrl = apiInfo.url;
    if (baseUrl.includes("?")) {
        baseUrl += "&";
    } else {
        baseUrl += "?";
    }
    let validProductIds = [];
    let count = 0;

    const connection = createOAuthConnection(config);

    for (let page = taskStartPage; page <= taskEndPage; page++) {
        const url = `${baseUrl}page=${page}&limit=300`;

        try {
            const response = await fetchWithRateLimitInfo(url, connection);

            // Validar la estructura de la respuesta
            if (!response.data.data || !Array.isArray(response.data.data)) {
                throw new Error(
                    `Unexpected response structure: ${JSON.stringify(response.data)}`
                );
            }

            for (let product of response.data.data) {
                const isValid = await checkCustomFieldFeed(config, product.id);

                if (isValid) {
                    validProductIds.push(product);
                    count++;
                }
            }

            // Obtener y manejar los límites de tasa
            const { requestsQuota, requestsLeft, resetTime } = extractRateLimitInfo(
                response.rateLimitInfo
            );

            // Calcular si estamos por encima del 85% del límite
            if (requestsLeft <= requestsQuota * 0.15) {
                console.log("Ha llegado al 85% del limite")
                await new Promise((resolve) => setTimeout(resolve, resetTime));
            }
        } catch (error) {
            console.error(`Error processing page ${page}:`, error.message);
        }
    }

    return { validProductIds, count };
}



async function manageProductProcessingFeed(config, totalPages) {
    const { transformProduct } = require("../helpers/helpers");
    const { insertBatchProducts } = require("../api/googleMerchantAPI");

    //const divisionOfPages = 10;

    const maxSegmentSize = 15;
    let divisionOfPages = Math.ceil(totalPages / maxSegmentSize);



    const segmentSize = Math.ceil(totalPages / divisionOfPages); // Divide las páginas en 10 partes
    let currentPage = 1;
    let totalValidCount = 0; // Contador total para todos los productos válidos

    console.time("manageProductProcessing");

    for (let i = 0; i < divisionOfPages; i++) {
        const endPage =
            currentPage + segmentSize - 1 > totalPages
                ? totalPages
                : currentPage + segmentSize - 1;



        const result = await getAvailableProductsFeed(config, currentPage, endPage);
        const validProductIds = result.allValidProductIds;
        totalValidCount += result.totalValidCount;

        const transformedProductos = await Promise.all(
            validProductIds.map((product) => transformProduct(config, product))
        );

        await insertBatchProducts(config, transformedProductos);

        currentPage = endPage + 1;
    }

    console.log(
        `Total valid products in manageProductProcessing: ${totalValidCount}`
    ); // Muestra el total de productos válidos procesados

    console.timeEnd("manageProductProcessing");
    return totalValidCount;
}

async function countPagesFeed(config) {
    const { storeHash, apiInfo } = config;
    const baseUrl = apiInfo.url;
    const options = await getConfig(config);

    console.time("countPagesConcurrently");

    try {
        const initialUrl = `${baseUrl}&page=1&limit=250`;
        const initialResponse = await fetchWithRetry(initialUrl, options);

        // Verifica si `initialResponse` y `initialResponse.meta` están definidos
        console.log("Initial Response: ", initialResponse)
        if (!initialResponse || !initialResponse.meta || !initialResponse.meta.pagination) {
            throw new Error("Invalid response structure");
        }

        const totalPages = initialResponse.meta.pagination.total_pages;

        let promises = [];
        for (let page = 1; page <= totalPages; page++) {
            const pageUrl = `${baseUrl}&page=${page}&limit=300`;
            promises.push(fetchWithRetry(pageUrl, options));
        }

        const results = await Promise.all(promises);
        console.timeEnd("countPagesConcurrently");
        console.log(`Total pages processed concurrently: ${results.length}`);
        return results.length;
    } catch (error) {
        console.error("Error counting pages:", error.message);
        throw error;
    }
}

async function countPagesNew(config) {

    const { storeHash, apiInfo } = config;
    const baseUrl = apiInfo.url;
    const initialUrl = `${baseUrl}&limit=300`;
    //const baseUrl =
    //  "https://api.bigcommerce.com/stores/574c5wuqc8/v3/catalog/products?price:min=0.01&availability=available&limit=300";

    try {
        const connection = createOAuthConnection(config);
        const initialResponse = await fetchWithRateLimitInfo(
            `${initialUrl}&page=1`,
            connection
        );
        const totalPages = initialResponse.data.meta.pagination.total_pages;
        console.log(`Total pages: ${totalPages}`);

        return totalPages;

        //const allResults = await fetchAllPagesConcurrently(baseUrl, totalPages);
        //console.log('Total pages processed concurrently:', allResults.length);
    } catch (error) {
        console.error("Failed to fetch data:", error.message);
    }
}




async function manageProductSync(config, totalPages, googleMerchantSKUs) {
    const { deleteBatchProducts, insertBatchProducts } = require("../api/googleMerchantAPI");
    const { transformProduct } = require("../helpers/helpers");

    const divisionOfPages = 10;
    const segmentSize = Math.ceil(totalPages / divisionOfPages);
    let currentPage = 1;
    let allBigCommerceSKUs = [];
    let totalValidCount = 0;

    console.time("manageProductProcessing");

    for (let i = 0; i < divisionOfPages; i++) {
        const endPage = currentPage + segmentSize - 1 > totalPages ? totalPages : currentPage + segmentSize - 1;
        const products = await getAvailableProductsFeed(config, currentPage, endPage);

        const validProductIds = products.allValidProductIds;
        totalValidCount += products.totalValidCount;

        // Extract SKUs from valid products
        const bigCommerceSKUs = validProductIds.map(product => product.sku);
        allBigCommerceSKUs = allBigCommerceSKUs.concat(bigCommerceSKUs);

        // Transform valid products for Google Merchant
        const transformedProductos = await Promise.all(
            validProductIds.map((product) => transformProduct(config, product))
        );

        // Insert transformed products into Google Merchant
        await insertBatchProducts(config, transformedProductos);

        currentPage = endPage + 1;
    }

    // Determine SKUs present in Google Merchant but not in BigCommerce
    const skusToDelete = googleMerchantSKUs.filter(sku => !allBigCommerceSKUs.includes(sku));

    if (skusToDelete.length > 0) {
        await deleteBatchProducts(skusToDelete, config); // Batch delete products from Google Merchant
        console.log(`Deleted ${skusToDelete.length} products from Google Merchant not present in BigCommerce.`);
    }

    console.log(`Processed total of ${allBigCommerceSKUs.length} products from BigCommerce.`);
    console.log(`Total valid products in manageProductProcessing: ${totalValidCount}`); // Display total valid products processed

    console.timeEnd("manageProductProcessing");
    return totalValidCount;
}





async function manageProductSync(config, totalPages, googleMerchantSKUs) {
    const { deleteBatchProducts, insertBatchProducts } = require("../api/googleMerchantAPI");
    const { transformProduct } = require("../helpers/helpers");

    const divisionOfPages = 10;
    const segmentSize = Math.ceil(totalPages / divisionOfPages);
    let currentPage = 1;
    let allBigCommerceSKUs = [];
    let totalValidCount = 0;

    console.time("manageProductProcessing");

    for (let i = 0; i < divisionOfPages; i++) {
        const endPage = currentPage + segmentSize - 1 > totalPages ? totalPages : currentPage + segmentSize - 1;
        const products = await getAvailableProductsFeed(config, currentPage, endPage);

        const validProductIds = products.allValidProductIds;
        totalValidCount += products.totalValidCount;

        // Extract SKUs from valid products
        const bigCommerceSKUs = validProductIds.map(product => product.sku);
        allBigCommerceSKUs = allBigCommerceSKUs.concat(bigCommerceSKUs);

        // Transform valid products for Google Merchant
        const transformedProductos = await Promise.all(
            validProductIds.map((product) => transformProduct(config, product))
        );

        // Insert transformed products into Google Merchant
        await insertBatchProducts(config, transformedProductos);

        currentPage = endPage + 1;
    }

    // Determine SKUs present in Google Merchant but not in BigCommerce
    const skusToDelete = googleMerchantSKUs.filter(sku => !allBigCommerceSKUs.includes(sku));

    if (skusToDelete.length > 0) {
        await deleteBatchProducts(skusToDelete, config); // Batch delete products from Google Merchant
        console.log(`Deleted ${skusToDelete.length} products from Google Merchant not present in BigCommerce.`);
    }

    console.log(`Processed total of ${allBigCommerceSKUs.length} products from BigCommerce.`);
    console.log(`Total valid products in manageProductProcessing: ${totalValidCount}`); // Display total valid products processed

    console.timeEnd("manageProductProcessing");
    return totalValidCount;
}



async function findMissingProductsInBigCommerce(config, totalPages, googleMerchantSKUs ) {
    const divisionOfPages = 10;
    const segmentSize = Math.ceil(totalPages / divisionOfPages);
    let currentPage = 1;
    let allBigCommerceSKUs = [];

    console.time("findMissingProducts");

    for (let i = 0; i < divisionOfPages; i++) {
        const endPage = currentPage + segmentSize - 1 > totalPages ? totalPages : currentPage + segmentSize - 1;
        const products = await getAvailableProductsFeed(config, currentPage, endPage);

        // Extract SKUs from products
        const bigCommerceSKUs = products.allValidProductIds.map(product => product.sku);
        allBigCommerceSKUs = allBigCommerceSKUs.concat(bigCommerceSKUs);
        currentPage = endPage + 1;
    }

    // Determine SKUs present in Google Merchant but not in BigCommerce
    const skusToDelete = googleMerchantSKUs.filter(sku => !allBigCommerceSKUs.includes(sku));

    console.timeEnd("findMissingProducts");
    console.log(`Total SKUs to delete from Google Merchant: ${skusToDelete.length}`);

    return `There are ${skusToDelete.length} products in Google Merchant that are no longer in BigCommerce.`;
}


module.exports = {
    manageProductProcessingFeed,
    countPagesFeed,
    checkCustomFieldFeed,
    countPagesNew,
    manageProductSync,
    findMissingProductsInBigCommerce
}