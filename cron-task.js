// cron-task.js

const { fetchOneFromTable, updateFeed } = require("./databases/CRUD");
const { createWebhookToCreateProduct, createWebhookToUpdateProduct, fetchWebHooks } = require("./api/webHooksBigCommerceApi");
const { listAllProducts } = require("./api/googleMerchantAPI");
const { countProductsByAvailability, countTotalProducts } = require("./api/productsBigCommerceApi");
const { listAllProductIds } = require("./api/googleMerchantAPI");
const { manageProductProcessingFeed, countPagesFeed, manageProductSync, countPagesNew } = require("./api/checkProductsFeeds");
const { buildQueryUrl } = require("./helpers/helpers");
const { checkAndResetCheckpoints } = require("./databases/CRUD");

const args = process.argv.slice(2);
const feedId = args[0];

if (!feedId) {
    console.error('Error: FEED_ID no proporcionado');
    process.exit(1);
}

async function synchronizeFeedCron(feedId) {
    console.log("El cron funciona correctamente y el Feed id es: ", feedId);
    const currentDateTime = new Date();
    console.log("Fecha y hora de ejecución:", currentDateTime.toISOString());

    try {
        const feed = await fetchOneFromTable('feeds', feedId, 'feed_id');
        if (feed) {
            const { store_hash, x_auth_token, private_key, client_id, formulas, client_email, domain } = feed;

            const baseUrl = `https://api.bigcommerce.com/stores/${store_hash}/v3/catalog/products`;
            const url = await buildQueryUrl(baseUrl, formulas);

            const configBase = {
                accessToken: x_auth_token,
                storeHash: store_hash,
                client_email,
                private_key,
                merchantId: client_id,
                domain,
            };

            await checkAndResetCheckpoints(feedId);

            for (const urlActual of url.url) {
                const config = {
                    ...configBase,
                    apiInfo: { url: urlActual, customFields: url.customFields }
                };

                try {
                    const productsSKUs = await listAllProductIds(config);
                    console.log("Listos los ID's");

                    const conteoPages = await countPagesNew(config);
                    console.log("Conteo: ", conteoPages);

                    await manageProductProcessingFeed(config, feedId, conteoPages, urlActual);
                } catch (error) {
                    console.error('Error en la sincronización de productos:', error);
                }
            }

            const webhooks = await fetchWebHooks(configBase);
            if (webhooks.data.length === 0) {
                await createWebhookToCreateProduct(configBase, feedId);
                await createWebhookToUpdateProduct(configBase, feedId);
            }

            const [totalProductsGM, totalProductsBC, preorderProducts] = await Promise.all([
                listAllProducts(configBase),
                countTotalProducts(configBase),
                countProductsByAvailability(configBase, "preorder")
            ]);

            const updateData = {
                total_products_bc: totalProductsBC,
                active_products_gm: totalProductsGM,
                preorder_products: preorderProducts
            };

            await updateFeed(feedId, updateData);
            console.log("Sincronización completada y feed actualizado");
        } else {
            console.error('Feed no encontrado');
        }
    } catch (error) {
        console.error('Error al obtener el feed:', error);
    } finally {
        // Finalizar el proceso después de completar la tarea
        process.exit(0);
    }
}

// Ejecutar la función de sincronización
synchronizeFeedCron(feedId);
