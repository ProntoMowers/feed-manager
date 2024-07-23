const fetch = require("node-fetch");
require("dotenv").config();

const { generateHash } = require("../helpers/helpers.js")



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

/**
 * Función asíncrona para recuperar los webhooks registrados de una tienda en BigCommerce.
 * Utiliza las variables `storeHash` y `accessToken` para autenticarse y realizar una solicitud GET a la API de BigCommerce.
 * Si la respuesta es exitosa, devuelve los datos de los webhooks en formato JSON. Cualquier error en la respuesta o en el proceso
 * es capturado y registrado en la consola.
 */

async function fetchWebHooks(config) {
  const { storeHash, accessToken } = config;
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;

  const options = {
    method: "GET",
    headers: {
      "X-Auth-Token": accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return json; // Retorna el JSON con la lista de webhooks
  } catch (error) {
    console.error("Error fetching webhooks:", error);
  }
}

async function activateAllWebHooks(config) {
  try {
    const webHooksData = await fetchWebHooks(config); // Llama a la función que recupera todos los webhooks
    if (!webHooksData || webHooksData.data.length === 0) {
      console.log("No se encontraron webhooks");
      return;
    }

    const updates = webHooksData.data.map(async (webhook) => {
      if (!webhook.is_active) { // Solo actualiza los que no están activos
        const updateData = {
          ...webhook,
          is_active: true // Cambia is_active a true
        };
        return updateWebhook(webhook.id, updateData,config);
      }
    });

    // Ejecuta todas las actualizaciones en paralelo
    const results = await Promise.all(updates);
    console.log("Todos los webhooks han sido actualizados para estar activos", results);
  } catch (error) {
    console.error("Error en activateAllWebHooks:", error);
  }
}

async function updateWebhook(webhookId, updateData,config) {
  const { storeHash, accessToken } = config;
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks/${webhookId}`;

  const options = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': accessToken
    },
    body: JSON.stringify(updateData) // Convierte los datos de actualización a un string JSON
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    console.log("Webhook actualizado:", json);
    return json; // Retorna el JSON con la respuesta de la actualización del webhook
  } catch (error) {
    console.error("Error updating webhook:", error);
    throw error; // Relanza el error para manejo adicional si es necesario
  }
}


async function createWebhook(scope, destination) {
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;

  const body = {
    scope: scope,
    destination: destination,
    is_active: true,
    headers: {}, // Aquí puedes añadir cabeceras personalizadas si las necesitas
  };

  try {
    const response = await fetch(url, optionsPost);
    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Error creating webhook: ", error);
    throw error;
  }
}



async function createWebhookToUpdateProduct(config, feedID) {
  const { storeHash, accessToken } = config;
  const urlPage = "https://pronto-proyect-4gzkueldfa-uc.a.run.app";
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;
  const producer = `stores/${storeHash}`;

  // Obtener la marca de tiempo UNIX actual
  const currentTimestamp = Math.floor(Date.now() / 1000);
  console.log("La marca de tiempo UNIX actual es:", currentTimestamp);

  const dataToHash = {
    store_id: storeHash,
    data: {
      type: "product"
    },
    created_at: currentTimestamp,
    producer: producer,
  };

  const hashValue = generateHash(dataToHash);

  const webhookPayload = {
    scope: "store/product/updated",
    destination: `${urlPage}/updatedProduct/${feedID}`,
    is_active: true,
    headers: {},
    store_id: storeHash,
    data: dataToHash.data,
    hash: hashValue,
    created_at: currentTimestamp,
    producer: producer,
  };

  const optionsPost = {
    method: "POST",
    headers: {
      "X-Auth-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(webhookPayload),
    
  };

  try {
    const response = await fetch(url, optionsPost);
    const responseBody = await response.json(); // Asegúrate de leer el cuerpo de la respuesta siempre
    if (!response.ok) {
      console.error('Respuesta de la API:', responseBody); // Esto te mostrará el mensaje de error detallado de la API
      throw new Error(`HTTP error! status 199 WebHooks: ${response}`);
    }
    console.log("Webhook creado exitosamente:", responseBody);
  } catch (error) {
    console.error("Error al crear el webhook:", error);
  }

}



async function deleteWebhook(webhookId) {
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks/${webhookId}`;


  try {
    const response = await fetch(url, optionsDelete);
    if (response.ok) {
      console.log("Webhook eliminado con éxito.");
    } else {
      const errorData = await response.json();
      console.error("Error al eliminar el webhook: ", errorData);
    }
  } catch (error) {
    console.error("Error en la solicitud para eliminar el webhook: ", error);
  }
}


/**
* Función asíncrona para crear un webhook en BigCommerce que se activará cuando un producto sea eliminado.
* La función configura y envía una solicitud POST para registrar un nuevo webhook que notifique a una URL especificada
* en Google Cloud cada vez que se elimine un producto en la tienda.
*
* Proceso:
* 1. Genera una marca de tiempo UNIX actual y utiliza esta junto con el ID de la tienda para crear un hash de seguridad.
* 2. Configura el payload del webhook especificando el ámbito para productos eliminados, la URL de destino, 
*    y otros metadatos relevantes como el ID de la tienda y la marca de tiempo.
* 3. Envía una solicitud POST a la API de BigCommerce con los detalles del webhook.
* 4. Verifica la respuesta de la API y maneja los estados de éxito o error adecuadamente.
*    En caso de éxito, logra la creación del webhook; en caso de error, muestra detalles del error y lanza una excepción.
*
*/


async function createWebhookToDeleteProduct() {

  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;
  const producer = `stores/${storeHash}`;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  console.log("La marca de tiempo UNIX actual es:", currentTimestamp);

  const dataToHash = {
    store_id: storeHash,
    created_at: currentTimestamp,
    producer: producer,
  };

  const hashValue = generateHash(dataToHash); // Asegúrate de tener esta función definida o reemplázala por tu método de generación de hash

  const webhookPayload = {
    scope: "store/product/deleted",
    destination: `${urlGCloud}/deletedProduct`,
    is_active: true,
    headers: {},
    store_id: storeHash,
    data: dataToHash.data,
    hash: hashValue,
    created_at: currentTimestamp,
    producer: producer,
  };

  const optionsPost = {
    method: "POST",
    headers: {
      "X-Auth-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(webhookPayload),
  };

  try {
    const response = await fetch(url, optionsPost);
    const responseBody = await response.json(); // Asegúrate de leer el cuerpo de la respuesta siempre
    if (!response.ok) {
      console.error('Respuesta de la API:', responseBody); // Esto te mostrará el mensaje de error detallado de la API
      throw new Error(`HTTP error! status 303 WebHooks: ${response}`);
    }
    console.log("Webhook para producto eliminado creado exitosamente:", responseBody);
  } catch (error) {
    console.error("Error al crear el webhook para producto eliminado:", error);
  }
}


async function createWebhookToCreateProduct(config,feedId) {
  const { storeHash, accessToken } = config;
  const urlPage = "209.38.4.225:8000";
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/hooks`;
  const producer = `stores/${storeHash}`;

  // Obtener la marca de tiempo UNIX actual
  const currentTimestamp = Math.floor(Date.now() / 1000);
  console.log("La marca de tiempo UNIX actual es:", currentTimestamp);

  const dataToHash = {
    store_id: storeHash,
    created_at: currentTimestamp,
    producer: producer,
  };

  const hashValue = generateHash(dataToHash); // Asegúrate de tener esta función definida o reemplázala por tu método de generación de hash

  const webhookPayload = {
    scope: "store/product/created",
    destination: `${urlPage}/createdProduct/${feedId}`,
    is_active: true,
    headers: {},
    store_id: storeHash,
    data: dataToHash.data,
    hash: hashValue,
    created_at: currentTimestamp,
    producer: producer,
  };

  const options = {
    method: "POST",
    headers: {
      "X-Auth-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(webhookPayload),
  };

  try {
    const response = await fetch(url, options);
    const responseBody = await response.json(); // Asegúrate de leer el cuerpo de la respuesta siempre
    if (!response.ok) {
      console.error('Respuesta de la API:', responseBody); // Esto te mostrará el mensaje de error detallado de la API
      throw new Error(`HTTP error! status 356 WebHooks: ${response}`);
    }
    console.log("Webhook creado exitosamente:", responseBody);
  } catch (error) {
    console.error("Error al crear el webhook:", error);
  }
}


module.exports = {
  fetchWebHooks,
  createWebhookToUpdateProduct,
  deleteWebhook,
  createWebhookToDeleteProduct,
  activateAllWebHooks,
  createWebhookToCreateProduct
};
