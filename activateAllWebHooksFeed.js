require('dotenv').config(); // Cargar variables de entorno
const axios = require('axios');
const { fetchOneFromTable, fetchDataFromTable } = require('./databases/CRUD'); // Asegúrate de tener el módulo de consulta de base de datos
const { fetchWebHooks, deleteWebhook, createWebhookToCreateProduct, createWebhookToUpdateProduct } = require('./api/webHooksBigCommerceApi'); // Asegúrate de tener estos helpers

const DOMAIN = process.env.DOMAIN;

async function manageWebhooks(feedID) {
  // Obtener datos del feed
  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");
  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;
  const storeName = feed.store_name; // Asumiendo que tienes el nombre de la tienda en la base de datos

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
  };

  try {
    // Paso 1: Verificar si hay WebHooks con el dominio incorrecto y eliminarlos
    const totalWebHooks = await fetchWebHooks(config);

    if (totalWebHooks.data && totalWebHooks.data.length > 0) {
      for (const webhook of totalWebHooks.data) {
        // Verificar el dominio del webhook
        if (!webhook.destination.includes(DOMAIN)) {
          console.log(`Eliminando WebHook con ID: ${webhook.id}`);
          await deleteWebhook(webhook.id, config);
        }
      }
    }

    // Paso 2: Crear los WebHooks necesarios con el dominio correcto
    console.log("Creando WebHooks...");
    await createWebhookToCreateProduct(config, feedID);
    await createWebhookToUpdateProduct(config, feedID);

    // Mensaje de confirmación
    console.log(`Se han generado los WebHooks para la tienda con ID ${feedID}, nombre "${storeName}", efectivamente.`);

  } catch (error) {
    console.error("Error al gestionar los WebHooks:", error);
  }
}

// Función para gestionar WebHooks de todos los feeds
async function manageAllFeedsWebhooks() {
  // Obtén todos los feeds de la base de datos (puedes ajustar esto según tu lógica)
  const allFeeds = await fetchDataFromTable("feeds"); // Asegúrate de tener una función para obtener todos los feeds

  for (const feed of allFeeds) {
    await manageWebhooks(feed.feed_id);
  }
}

// Ejecutar la función para todos los feeds
manageAllFeedsWebhooks().then(() => {
  console.log("Gestión de WebHooks completa para todos los feeds.");
}).catch((error) => {
  console.error("Error en la gestión de WebHooks:", error);
});

module.exports = { manageAllFeedsWebhooks };
