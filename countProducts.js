const { fetchDataFromTable, updateFeed } = require("./databases/CRUD");
const { listAllProducts } = require("./api/googleMerchantAPI");
const { countProductsByAvailability, countTotalProducts } = require("./api/productsBigCommerceApi");

async function synchronizeCountForAllFeeds() {
    console.log("Inicio del proceso de conteo de productos para todos los feeds");
    const currentDateTime = new Date();
    console.log("Fecha y hora de ejecución:", currentDateTime.toISOString());

    try {
        // Obtener todos los feeds de la tabla
        const feeds = await fetchDataFromTable("feeds");

        if (feeds.length === 0) {
            console.error("No se encontraron feeds en la base de datos");
            return;
        }

        // Ejecutar las operaciones de conteo para cada feed
        for (const feed of feeds) {
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
                domain: feed.domain,
            };

            console.log(`Procesando feed ID: ${feed.feed_id}`);

            try {
                // Ejecutar las operaciones de conteo en paralelo
                const [totalProductsGM, totalProductsBC, preorderProducts] = await Promise.all([
                    listAllProducts(config),
                    countTotalProducts(config),
                    countProductsByAvailability(config, "preorder"),
                ]);

                const updateData = {
                    total_products_bc: totalProductsBC,
                    active_products_gm: totalProductsGM,
                    preorder_products: preorderProducts,
                    isActive: true,
                };

                // Actualizar el feed con los datos obtenidos
                await updateFeed(feed.feed_id, updateData);
                console.log(`Feed ${feed.feed_id} sincronizado y actualizado`);

            } catch (error) {
                console.error(`Error durante la sincronización del feed ${feed.feed_id}:`, error);
            }
        }

        console.log("Proceso de conteo de productos completado para todos los feeds");

    } catch (error) {
        console.error("Error al obtener los feeds:", error);
    }
}

// Ejecutar la función de sincronización para todos los feeds
synchronizeCountForAllFeeds();
