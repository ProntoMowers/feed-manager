const { fetchDataFromTable, fetchOneFromTable, updateFeed } = require("./databases/CRUD");
const { countPagesForDisabledAndZeroPrice } = require("./api/checkProductsFeeds");
const { deleteBatchProducts } = require("./api/googleMerchantAPI");

async function synchronizeDisabledAndZeroPriceForAllFeeds() {
    console.log("Inicio del proceso de eliminación de productos deshabilitados y con precio 0 para todos los feeds");
    const currentDateTime = new Date();
    console.log("Fecha y hora de ejecución:", currentDateTime.toISOString());

    try {
        // Obtener todos los feeds de la tabla
        const feeds = await fetchDataFromTable("feeds");

        if (feeds.length === 0) {
            console.error("No se encontraron feeds en la base de datos");
            return;
        }

        // Procesar cada feed
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
            };

            console.log(`Procesando feed ID: ${feed.feed_id}, Con nombre: ${feed.feed_name}`);

            try {
                // Contar productos deshabilitados y con precio igual a 0
                const skus = await countPagesForDisabledAndZeroPrice(config);

                //console.log(`Total de productos deshabilitados y con precio 0 para feed : ${JSON.stringify(skus)}`);
                
                if (skus.uniqueSKUs.length > 0) {
                    // Eliminar los productos encontrados
                    const totalDeleted = await deleteBatchProducts(skus.uniqueSKUs, config);
                    console.log(`Total de productos eliminados para feed ${feed.feed_id}: ${totalDeleted}`);

                    const updateData = {
                        last_disabled_zero_price_sync: currentDateTime,
                        total_deleted_products: totalDeleted,
                    };

                    // Actualizar el feed con los datos obtenidos
                    await updateFeed(feed.feed_id, updateData);
                    console.log(`Feed ${feed.feed_id} sincronizado y actualizado`);
                } else {
                    console.log(`No se encontraron productos para eliminar en el feed ${feed.feed_id}`);
                }

            } catch (error) {
                console.error(`Error durante la sincronización del feed ${feed.feed_id}:`, error);
            }
        }

        console.log("Proceso de eliminación de productos completado para todos los feeds");

    } catch (error) {
        console.error("Error al obtener los feeds:", error);
    }
}

// Ejecutar la función de sincronización para todos los feeds
synchronizeDisabledAndZeroPriceForAllFeeds();
