const { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
const fetch = require("node-fetch"); // Asegúrate de tener esta dependencia instalada
const xlsx = require("xlsx");

const credentials = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN
};

const { transformProduct } = require("../helpers/helpers");

// Define los alcances de la API a los que tu cuenta de servicio necesita acceder

let auth;
let content;
let merchantId;

async function initializeGoogleAuth(config) {

  //console.log("config: ",config)
  const { client_email, private_key, merchantId } = config;

  //console.log("config en Google: ", config)

  const formattedPrivateKeyFromDb = private_key.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    client_email,
    null,
    formattedPrivateKeyFromDb,
    ["https://www.googleapis.com/auth/content"]
  );

  const content = google.content({
    version: "v2.1",
    auth: auth,
  });

  return { content, merchantId };
}

async function initializeGoogleAuth2(config) {
  const { client_email, private_key, merchantId } = config;

  const auth = new google.auth.JWT(
    client_email,
    null,
    private_key,
    ["https://www.googleapis.com/auth/content"]
  );

  const content = google.content({
    version: "v2.1",
    auth: auth,
  });

  return { content, merchantId };
}


async function insertProductToGoogleMerchant(config, product) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  try {
    const response = await content.products.insert({
      merchantId: merchantId,
      resource: product,
    });
    console.log("Producto insertado");
    return response.data;
  } catch (error) {
    console.error("Error al insertar producto: ", error);
    throw error; // Re-lanza el error para manejarlo más arriba si es necesario
  }
}



async function insertBatchProducts(config, products) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  const batchRequest = { entries: [] };

  products.forEach((product, index) => {
    batchRequest.entries.push({
      batchId: index + 1,
      merchantId: merchantId,
      method: "insert",
      product: product,
    });
  });

  console.time("InsertProductBatchTime"); // Inicia el temporizador

  try {
    const response = await content.products.custombatch({
      resource: batchRequest,
    });
    console.timeEnd("InsertProductBatchTime"); // Termina el temporizador y muestra el tiempo
    console.log("Se subieron los productos a Google Merchant"); // Ver la respuesta de la API
    console.log("----------------------------------");
  } catch (error) {
    console.log("Hubo un error");
    console.timeEnd("InsertProductBatchTime"); // Asegúrate de detener el temporizador si hay un error
    console.error(error);
  }
}



async function deleteBatchProducts(productIds) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  const batchRequest = { entries: [] };

  productIds.forEach((productId, index) => {
    batchRequest.entries.push({
      batchId: index + 1,
      merchantId: merchantId,
      method: "delete",
      productId: productId,
    });
  });

  console.time("DeleteProductBatchTime"); // Inicia el temporizador

  try {
    const response = await content.products.custombatch({
      resource: batchRequest,
    });
    console.timeEnd("DeleteProductBatchTime"); // Termina el temporizador y muestra el tiempo
    console.log(response.data); // Ver la respuesta de la API
  } catch (error) {
    console.log("Hubo un error");
    console.timeEnd("DeleteProductBatchTime"); // Asegúrate de detener el temporizador si hay un error
    console.error(error);
  }
}



async function getProductStatusByProductId(productId) {
  try {
    const response = await content.productstatuses.get({
      merchantId: merchantId,
      productId: productId,
      destinations: ["Shopping"],
    });

    console.log("Estado del producto: ", response.data);
    return response.data;
  } catch (error) {
    console.error("Error al obtener el estado del producto: ", error);
    throw error;
  }
}




async function listAllProductStatuses() {
  let totalProducts = 0;
  let nextPageToken = null; // Inicializamos el nextPageToken como null
  const maxResults = 250; // Máximo de resultados por página

  console.time("Duración del listado de productos"); // Inicia el temporizador

  try {
    do {
      const params = {
        merchantId,
        destinations: ['Shopping'],
        maxResults
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken; // Añade el pageToken solo si existe
      }

      const response = await content.productstatuses.list(params);

      if (response.data.resources) {
        totalProducts += response.data.resources.length; // Sumamos la cantidad de productos de esta página
        nextPageToken = response.data.nextPageToken; // Actualizamos el nextPageToken con el nuevo valor
      }
    } while (nextPageToken); // Continúa mientras haya un nextPageToken

    console.log("Total de productos listados: ", totalProducts);
    console.timeEnd("Duración del listado de productos"); // Detiene el temporizador y muestra la duración
    return totalProducts;
  } catch (error) {
    console.error("Error al listar todos los estados de los productos: ", error);
    console.timeEnd("Duración del listado de productos"); // Asegúrate de detener el temporizador si hay un error
    throw error;
  }
}


async function listAllProducts(config) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  let totalProducts = 0;
  let nextPageToken = null;
  const maxResults = 250;

  console.time("Duración del listado de productos");

  try {
    do {
      const params = {
        merchantId,
        maxResults
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const response = await content.products.list(params);

      if (response.data.resources) {
        totalProducts += response.data.resources.length;
        nextPageToken = response.data.nextPageToken;
      }
    } while (nextPageToken);

    console.log("Total de productos listados: ", totalProducts);
    console.timeEnd("Duración del listado de productos");
    return totalProducts;
  } catch (error) {
    console.error("Error al listar todos los productos: ", error);
    console.timeEnd("Duración del listado de productos");
    throw error;
  }
}



/**
 * Función asíncrona para buscar un producto específico en Google Merchant mediante su ID de BigCommerce.
 * Utiliza la API de Google Content para iterar sobre las páginas de productos y encontrar el producto con el ID especificado.
 *
 * Parámetros:
 * - bigCommerceId: El ID del producto en BigCommerce que se desea encontrar en Google Merchant.
 *
 * Proceso:
 * 1. Inicia un temporizador para medir la duración del proceso de búsqueda del producto.
 * 2. Configura los parámetros iniciales para la solicitud de la API, incluyendo el 'merchantId' y el número máximo de resultados por página.
 * 3. Utiliza un bucle do-while que continúa mientras exista un 'nextPageToken', lo que indica más páginas de productos disponibles.
 * 4. En cada iteración, realiza una solicitud a la API para obtener la página actual de productos.
 * 5. Filtra los productos de la página actual para encontrar aquel cuyo 'customLabel1' coincide con el 'bigCommerceId' especificado.
 * 6. Si el producto es encontrado, imprime los detalles del producto, detiene el temporizador y retorna el producto encontrado.
 * 7. Si no se encuentra el producto, actualiza el 'nextPageToken' para la próxima iteración.
 * 8. Al finalizar todas las páginas sin encontrar el producto, imprime un mensaje de no encontrado y detiene el temporizador.
 * 9. Captura y maneja cualquier error durante las solicitudes, registrando el error y deteniendo el temporizador antes de re-lanzar el error para su manejo externo.
 *
 * Esta función es útil para verificar la presencia y detalles de un producto específico en Google Merchant basándose en su ID de BigCommerce,
 * facilitando la sincronización y administración de inventarios entre plataformas.
 */

async function findProductByBigCommerceId(bigCommerceId) { // Asegúrate de reemplazar este con tu Merchant ID real
  let nextPageToken = null; // Inicializamos el nextPageToken como null
  const maxResults = 250; // Máximo de resultados por página

  console.time("Duración de la búsqueda de producto"); // Inicia el temporizador

  try {
    do {
      const params = {
        merchantId,
        maxResults,
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken; // Añade el pageToken solo si existe
      }

      const response = await content.products.list(params);

      if (response.data.resources) {
        // Filtra los productos para encontrar aquel que tiene el ID de BigCommerce especificado
        const foundProduct = response.data.resources.find(product => product.customLabel1 === bigCommerceId);
        if (foundProduct) {
          console.log("Producto encontrado: ", foundProduct);
          console.timeEnd("Duración de la búsqueda de producto"); // Detiene el temporizador y muestra la duración
          return foundProduct;
        }
        nextPageToken = response.data.nextPageToken; // Actualizamos el nextPageToken para la próxima iteración
      }
    } while (nextPageToken); // Continúa mientras haya un nextPageToken

    console.log("Producto no encontrado.");
    console.timeEnd("Duración de la búsqueda de producto"); // Detiene el temporizador
    return null;
  } catch (error) {
    console.error("Error al buscar el producto: ", error);
    console.timeEnd("Duración de la búsqueda de producto"); // Asegúrate de detener el temporizador si hay un error
    throw error;
  }
}

/**
 * Función asíncrona para actualizar un producto en Google Merchant utilizando la API de Google Content.
 * La función transforma los datos de un producto de BigCommerce y actualiza el correspondiente en Google Merchant.
 *
 * Parámetros:
 * - googleProductId: El ID del producto en Google Merchant Center que se desea actualizar.
 * - bcProduct: Objeto que contiene la información del producto de BigCommerce a transformar y actualizar.
 *
 * Proceso:
 * 1. Imprime el ID del producto de Google para fines de seguimiento.
 * 2. Transforma el producto de BigCommerce en un formato adecuado para Google Merchant, eliminando campos innecesarios como 'offerId', 'targetCountry', etc.
 * 3. Intenta actualizar el producto en Google Merchant utilizando el ID del producto y los datos transformados.
 * 4. Si se especifica, puede usar 'updateMask' para limitar los campos que se actualizarán durante la operación.
 * 5. Registra en consola el éxito de la operación junto con los datos del producto actualizado.
 * 6. Captura y maneja cualquier error durante el proceso, registrando el error y lanzando una excepción para manejo externo.
 *
 * Esta función es crucial para mantener sincronizados los datos del producto entre BigCommerce y Google Merchant, asegurando que las modificaciones
 * en una plataforma se reflejen adecuadamente en la otra. Esto facilita la gestión de inventarios y la presentación correcta de los productos en diferentes canales de venta.
 */

async function updateGoogleMerchantProduct(config, googleProductId, bcProduct) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  console.log("Google Product Id: ", googleProductId);

  const transformedProduct = await transformProduct(bcProduct);
  delete transformedProduct.offerId;
  delete transformedProduct.targetCountry;
  delete transformedProduct.contentLanguage;
  delete transformedProduct.channel;

  try {
    const response = await content.products.update({
      merchantId: merchantId,
      productId: googleProductId, // ID del producto en Google Merchant Center
      resource: transformedProduct, // Datos del producto transformado
      // Si deseas especificar qué campos actualizar, puedes usar 'updateMask'
      // Por ejemplo: updateMask: 'title,link'
    });

    console.log("Producto actualizado con éxito:", response.data.id);
    return response.data;
  } catch (error) {
    console.error("Error al actualizar el producto:", error);
    throw error;
  }
}

/**
 * Función asíncrona para recuperar la información detallada de un producto específico desde Google Merchant utilizando la API de Google Content.
 * La función utiliza el ID del producto para realizar una solicitud GET y obtener toda la información relevante del producto en Google Merchant.
 *
 * Parámetros:
 * - productId: El ID del producto que se desea consultar. Este ID debe estar en el formato adecuado que Google Merchant requiere.
 *
 * Proceso:
 * 1. Imprime el SKU o ID del producto recibido para fines de seguimiento.
 * 2. Configura los parámetros de la solicitud, incluyendo el 'merchantId' y el 'productId', asegurándose de que el formato del ID del producto sea el correcto.
 * 3. Realiza una solicitud GET a la API de Google Content para obtener los detalles del producto.
 * 4. Si la solicitud es exitosa, devuelve los datos del producto obtenido.
 * 5. Captura y maneja cualquier error durante el proceso, deteniendo cualquier temporizador activo y lanzando una excepción para manejo externo.
 *
 * Esta función es útil para obtener información actualizada y detallada de los productos listados en Google Merchant, permitiendo a los administradores y desarrolladores verificar la exactitud y la integridad de la información del producto en el inventario de Google Merchant.
 */

async function getProductInfoGoogleMerchant(config, productId) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  console.log("SKU recibido desde Info Google Merchant: ", productId);

  console.time("Duración de la obtención del producto"); // Inicia el temporizador

  try {
    const response = await content.products.get({
      merchantId: merchantId,
      productId: `online:en:US:${productId}`, // Asegúrate de que el ID del producto esté formateado correctamente
    });

    console.log("Información del producto: ", response.data.id);
    console.timeEnd("Duración de la obtención del producto"); // Detiene el temporizador y muestra la duración
    return response.data;
  } catch (error) {
    console.error("Error al obtener la información del producto: ", productId);
    console.timeEnd("Duración de la obtención del producto"); // Detiene el temporizador si hay un error
    throw error;
  }
}

/**
 * Función asíncrona para eliminar un producto específico de Google Merchant utilizando la API de Google Content.
 * Esta función recibe el ID de un producto y envía una solicitud DELETE para eliminarlo permanentemente del inventario en Google Merchant.
 *
 * Parámetros:
 * - googleProductId: El ID del producto en Google Merchant Center que se desea eliminar.
 *
 * Proceso:
 * 1. Imprime el SKU o ID del producto recibido para fines de seguimiento.
 * 2. Configura los parámetros de la solicitud DELETE, incluyendo el 'merchantId' y el 'productId'.
 * 3. Realiza una solicitud DELETE a la API de Google Content para eliminar el producto especificado.
 * 4. Registra en consola el éxito de la operación si el producto se elimina con éxito.
 * 5. Devuelve la respuesta de la API, generalmente un indicativo de que el producto ha sido eliminado.
 * 6. Captura y maneja cualquier error durante el proceso, registrando el error y lanzando una excepción para manejo externo.
 *
 * Esta función es crucial para la gestión de inventarios en Google Merchant, permitiendo a los administradores y desarrolladores eliminar productos que ya no deben estar disponibles para la venta.
 */

async function deleteGoogleMerchantProduct(config, googleProductId) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  console.log("SKU recibido desde Info Google Merchant: ", googleProductId);

  try {
    const response = await content.products.delete({
      merchantId: merchantId,
      productId: googleProductId, // ID del producto en Google Merchant Center
    });

    console.log("Producto eliminado con éxito:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error al eliminar el producto:", error);
    throw error;
  }
}



function shortenDescription(description) {
  if (description.length > 20) {
    return description.substring(0, 20) + "..." + `${description.length - 20}`;
  }
  return description;
}

function shortenDescription(description) {
  if (description && description.length > 100) {
    return description.substring(0, 20) + "..." + `${description.length - 20}`;
  }
  return description;
}


async function getInfoOfAllProducts(config) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  let products = [];
  let nextPageToken = null;
  const maxResults = 250;

  console.time("Duración del listado de productos");

  try {
    do {
      const params = {
        merchantId,
        maxResults
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const response = await content.products.list(params);

      if (response.data.resources) {
        products = products.concat(response.data.resources);
        nextPageToken = response.data.nextPageToken;
      }
    } while (nextPageToken);

    console.log("Total de productos listados: ", products.length);
    console.timeEnd("Duración del listado de productos");
    return products;
  } catch (error) {
    console.error("Error al listar todos los productos: ", error);
    console.timeEnd("Duración del listado de productos");
    throw error;
  }
}

function createExcel(products, returnBuffer = false) {
  const workbook = xlsx.utils.book_new();
  const worksheetData = products.map(product => ({
    id: product.id,
    title: product.title,
    description: shortenDescription(product.description),
    imageLink: product.imageLink,
    contentLanguage: product.contentLanguage,
    targetCountry: product.targetCountry,
    availability: product.availability,
    brand: product.brand,
    condition: product.condition,
    googleProductCategory: product.googleProductCategory,
    mpn: product.mpn,
    price: product.price ? (product.price.value + ' ' + product.price.currency) : '',
    productTypes: Array.isArray(product.productTypes) ? product.productTypes.join(', ') : ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  xlsx.utils.book_append_sheet(workbook, worksheet, "Products");

  if (returnBuffer) {
    // Escribe el archivo Excel en un buffer y lo devuelve
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  } else {
    // Guarda el archivo en el directorio de trabajo actual
    xlsx.writeFile(workbook, "Products.xlsx");
    console.log("Archivo Excel creado exitosamente en el directorio de trabajo actual");
  }
}

async function deleteBatchProducts(productIds, config) {
  const { content, merchantId } = await initializeGoogleAuth(config);
  const batchSize = 10000; // Tamaño del lote para evitar exceder los límites de la API
  let successfulDeletions = 0;

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const batchRequest = { entries: [] };

    batch.forEach((productId, index) => {
      batchRequest.entries.push({
        batchId: index + 1,
        merchantId: merchantId,
        method: "delete",
        productId: "online:en:US:" + productId,
      });
    });

    console.time("DeleteProductBatchTime"); // Inicia el temporizador

    try {
      const response = await content.products.custombatch({
        resource: batchRequest,
      });
      console.timeEnd("DeleteProductBatchTime"); // Termina el temporizador y muestra el tiempo

      if (response.data.entries) {
        response.data.entries.forEach((entry) => {
          if (!entry.errors) {
            successfulDeletions++;
          } else {
           // console.error(`Error in batchId ${entry.batchId}:`);
            entry.errors.errors.forEach((error) => {
             // console.error(`  - ${error.message}`);
              if (error.reason) {
             //   console.error(`    Reason: ${error.reason}`);
              }
              if (error.location) {
               // console.error(`    Location: ${error.location}`);
              }
            });
          }
        });
      } else {
       // console.log("No entries found in the response.");
      }
    } catch (error) {
      console.log("Hubo un error general en la solicitud.");
      console.timeEnd("DeleteProductBatchTime"); // Asegúrate de detener el temporizador si hay un error
      console.error("Error details:", error);
    }
  }

  console.log(`Total products successfully deleted: ${successfulDeletions}`);
  return successfulDeletions; // Devuelve el número de eliminaciones exitosas
}



async function listAllProductIds(config) {
  const { content, merchantId } = await initializeGoogleAuth(config);
  let productIds = [];
  let nextPageToken = null; // Inicializamos el nextPageToken como null
  const maxResults = 250; // Máximo de resultados por página

  console.time("Duración del listado de IDs de productos"); // Inicia el temporizador

  try {
    do {
      const params = {
        merchantId,
        maxResults,
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken; // Añade el pageToken solo si existe
      }

      const response = await content.products.list(params);

      if (response.data.resources) {
        response.data.resources.forEach(product => {
          const parts = product.id.split(':'); // Divide el ID usando ':' como delimitador
          if (parts.length > 3) { // Asegúrate de que el ID tiene suficientes partes
            productIds.push(parts[3]); // Agrega solo la parte después de "online:en:US:"
          }
        });
        nextPageToken = response.data.nextPageToken; // Actualizamos el nextPageToken con el nuevo valor
      }
    } while (nextPageToken); // Continúa mientras haya un nextPageToken

    console.log("Total de IDs de productos listados: ", productIds.length);
    console.timeEnd("Duración del listado de IDs de productos"); // Detiene el temporizador y muestra la duración
    return productIds; // Devuelve el array de IDs
  } catch (error) {
    console.error("Error al listar los IDs de los productos: ", error);
    console.timeEnd("Duración del listado de IDs de productos"); // Asegúrate de detener el temporizador si hay un error
    throw error;
  }
}

async function verifyGoogleCredentials(config) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  try {
    const params = {
      merchantId,
      maxResults: 1, // Solo necesitamos un resultado para verificar las credenciales
    };

    const response = await content.products.list(params);

    if (response.data.resources) {
      console.log("Credenciales de Google verificadas exitosamente.");
      return true;
    } else {
      //console.error("Error al verificar las credenciales de Google: No se encontraron productos.");
      return false;
    }
  } catch (error) {
    //console.error("Error al verificar las credenciales de Google: ");
    throw error;
  }
}


async function listAllActiveProducts(config) {
  const { content, merchantId } = await initializeGoogleAuth(config);

  let totalApprovedProducts = 0;
  let nextPageToken = null;
  const maxResults = 250;

  console.time("Duración del listado de productos aprobados");

  try {
    do {
      const params = {
        merchantId,
        destinations: ['Shopping'],
        maxResults
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const response = await content.productstatuses.list(params);

      if (response.data.resources) {
        const approvedProductsInPage = response.data.resources.filter(product =>
          product.destinationStatuses.some(status => status.destination === 'Shopping' && status.status === 'approved')
        );
        totalApprovedProducts += approvedProductsInPage.length;
        nextPageToken = response.data.nextPageToken;
      }
    } while (nextPageToken);

    console.log("Total de productos aprobados: ", totalApprovedProducts);
    console.timeEnd("Duración del listado de productos aprobados");
    return totalApprovedProducts;
  } catch (error) {
    console.error("Error al listar los productos aprobados: ", error);
    console.timeEnd("Duración del listado de productos aprobados");
    throw error;
  }
}



module.exports = {
  insertProductToGoogleMerchant,
  insertBatchProducts,
  getProductStatusByProductId,
  listAllProductStatuses,
  listAllProducts,
  findProductByBigCommerceId,
  updateGoogleMerchantProduct,
  getProductInfoGoogleMerchant,
  deleteGoogleMerchantProduct,
  deleteBatchProducts,
  initializeGoogleAuth,
  getInfoOfAllProducts,
  createExcel,
  listAllProductIds,
  verifyGoogleCredentials,
  listAllActiveProducts
};
