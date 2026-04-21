const { listAllProductIds } = require("./api/googleMerchantAPI")
const { manageDeleteProductsProcessing, countPages } = require("./api/productsBigCommerceApi")
const { fetchOneFromTable, fetchDataFromTable } = require("./databases/CRUD");


async function deleteFeedCron(feedId) {
    try {
        const feed = await fetchOneFromTable('feeds', feedId, 'feed_id');

        const storeHash = feed.store_hash;
        const accessToken = feed.x_auth_token;
        const privateKey = feed.private_key; // decrypt(JSON.parse(feed.private_key));
        const merchantId = feed.client_id;

        const config = {
            accessToken: accessToken,
            storeHash: storeHash,
            client_email: feed.client_email,
            private_key: privateKey,
            merchantId: merchantId,
            domain: feed.domain
        };

        const products = await listAllProductIds(config);
        const conteoPages = await countPages(config);
        await manageDeleteProductsProcessing(conteoPages, products, config);

    } catch (error) {
        console.error('Error in deleteFeedCron:', error);
    }
}


async function deleteAllFeedsWeekly() {
    const feeds = await fetchDataFromTable('feeds');

    if (!feeds || feeds.length === 0) {
        console.log('No hay feeds para procesar.');
        return;
    }

    for (const feed of feeds) {
        try {
            console.log(`Procesando limpieza semanal para feed ${feed.feed_id}...`);
            await deleteFeedCron(feed.feed_id);
        } catch (error) {
            console.error(`Error procesando feed ${feed.feed_id}:`, error.message);
        }
    }
}


// Obtener el feedId desde los argumentos de la línea de comandos
const args = process.argv.slice(2);
const feedId = args[0] || process.env.FEED_ID;

if (feedId) {
    // Ejecutar para un feed específico
    deleteFeedCron(feedId).catch(error => {
        console.error('Error en deleteFeedCron:', error.message);
        process.exit(1);
    });
} else {
    // Si no viene FEED_ID, ejecutar para todos los feeds activos
    console.warn('FEED_ID no proporcionado. Se procesarán todos los feeds.');
    deleteAllFeedsWeekly().catch(error => {
        console.error('Error en deleteAllFeedsWeekly:', error.message);
        process.exit(1);
    });
}
