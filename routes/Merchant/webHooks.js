const express = require("express");
const routerWebHooks = express.Router();

const {
  fetchWebHooks,
  createWebhookToUpdateProduct,
  deleteWebhook,
  activateAllWebHooks,
  createWebhookToCreateProduct
} = require("../../api/webHooksBigCommerceApi");
const {
  findProductByBigCommerceId,
  getProductInfoGoogleMerchant,
  updateGoogleMerchantProduct,
  deleteGoogleMerchantProduct,
  insertProductToGoogleMerchant,
  initializeGoogleAuth,
} = require("../../api/googleMerchantAPI");

const { fetchOneFromTable } = require("../../databases/CRUD");

const { transformProduct } = require("../../helpers/helpers");

const {
  fetchProductById,
  checkCustomField,
  getConfig,
} = require("../../api/productsBigCommerceApi");
const { getConfigCategories } = require("../../api/categoriesBigCommerceApi");
const { getConfigImages } = require("../../api/imagesBigCommerceApi");

routerWebHooks.get("/webhooks/fetchWebHooks/:feedID", async (req, res) => {
  const { feedID } = req.params;
  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");

  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;

  console.log("Store Hash: ", storeHash);
  console.log("Access Token: ", accessToken);

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
  };

  res.send("Se ha hecho una consulta de las ordenes");
  const totalWebHooks = await fetchWebHooks(config);
  console.log("WebHooks: ", totalWebHooks);
});

routerWebHooks.get("/webhooks/createWebHooks/:feedID", async (req, res) => {
  const { feedID } = req.params;
  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");

  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;

  console.log("Store Hash: ", storeHash);
  console.log("Access Token: ", accessToken);

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
  };

  res.send("Se ha hecho una consulta de las ordenes");
  await createWebhookToCreateProduct(config, feedID);
  await createWebhookToUpdateProduct(config, feedID);
  console.log("WebHooks: ", totalWebHooks);
});

routerWebHooks.get("/webhooks/deleteWebhook/:feedID", async (req, res) => {
  const { WebHookID } = req.params;
  const { feedID } = req.params;

  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");

  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;

  console.log("Store Hash: ", storeHash);
  console.log("Access Token: ", accessToken);

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
  };

  try {
    const totalWebHooks = await fetchWebHooks(config);

    // Verifica si se obtuvieron WebHooks
    if (totalWebHooks.data && totalWebHooks.data.length > 0) {
      // Itera sobre cada WebHook y elimina según el ID
      for (const webhook of totalWebHooks.data) {
        console.log(`Deleting WebHook with ID: ${webhook.id}`);
        await deleteWebhook(webhook.id, config);
      }
      res.send("Se han eliminado todos los WebHooks.");
    } else {
      res.send("No se encontraron WebHooks para eliminar.");
    }
  } catch (error) {
    console.error("Error al eliminar WebHooks:", error);
    res.status(500).send("Hubo un error al eliminar los WebHooks.");
  }
});

routerWebHooks.get("/webhooks/activateAllWebHooks", async (req, res) => {
  res.send("Se ha hecho una consulta de las ordenes");
  const totalWebHooks = await activateAllWebHooks();
  //console.log("WebHooks: ", totalWebHooks);
});

routerWebHooks.get(
  "/webhooks/createWebhookToUpdateProduct",
  async (req, res) => {
    res.send("Se ha hecho una consulta de las ordenes");
    const idProducto = 87345;
    const totalWebHooks = await createWebhookToUpdateProduct(idProducto);
    console.log("WebHook Creado para: ", idProducto);
  }
);

routerWebHooks.get(
  "/webhooks/createWebhookToDeleteProduct",
  async (req, res) => {
    res.send("Se ha hecho una consulta de las ordenes");
    const totalWebHooks = await createWebhookToDeleteProduct();
  }
);

const {
  manageProductProcessingFeed,
  checkCustomFieldFeed,
} = require("../../api/checkProductsFeeds");
const { buildQueryUrl } = require("../../helpers/helpers");

routerWebHooks.post("/updatedProduct/:feedID", async (req, res) => {
  const { feedID } = req.params;
  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");

  console.log("Feed: ", feed);
  console.log("feedID: ", feedID);

  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;
  const privateKey = feed.private_key;
  const merchantId = feed.client_id;
  const formula = feed.formulas;

  const url = await buildQueryUrl(baseUrl, formula);

  console.log("Webhook recibido de actualizar productos");

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
    client_email: feed.client_email,
    private_key: privateKey,
    merchantId: merchantId,
    domain: feed.domain,
    apiInfo: url,
  };

  await activateAllWebHooks(config);

  console.clear();
  const productData = req.body;
  const productId = productData.data.id;

  console.log(`ID del Producto: `, productId);

  // Obtener información del producto de BigCommerce.
  const infoProductBigCommerce = await fetchProductById(config, productId);
  if (!infoProductBigCommerce) {
    console.log("Producto no encontrado en BigCommerce.");
    return res.status(404).send("Producto no encontrado en BigCommerce.");
  }

  const hasImage = await checkCustomFieldFeed(config, productId);
  console.log("¿El producto tiene imagen correcta?: ", hasImage);
  if (hasImage) {
    console.log("El producto tiene imagen adecuada.");
  }

  try {
    const infoProductGoogle = await getProductInfoGoogleMerchant(
      config,
      infoProductBigCommerce.sku
    );
    if (
      infoProductBigCommerce.price === 0 ||
      !infoProductBigCommerce.is_visible ||
      infoProductBigCommerce.availability === "disabled" ||
      !hasImage
    ) {
      console.log(
        `El producto ${productId} no está activo o su precio es 0, procediendo a eliminar en Google Merchant.`
      );
      await deleteGoogleMerchantProduct(config, infoProductGoogle.id);
      console.log("Producto eliminado en Google Merchant.");
      return res
        .status(200)
        .send(
          "Producto inactivo o a precio cero, no se requiere acción adicional en Google Merchant."
        );
    } else {
      console.log(`Actualizando el producto ${productId} en Google Merchant.`);
      await updateGoogleMerchantProduct(
        config,
        infoProductGoogle.id,
        infoProductBigCommerce
      );
      console.log("Producto actualizado en Google Merchant.");
      return res.status(200).send("Producto actualizado en Google Merchant.");
    }
  } catch (error) {
    console.log(`Producto no encontrado en Google Merchant, intentando crear.`);
    if (
      infoProductBigCommerce.price !== 0 &&
      infoProductBigCommerce.is_visible &&
      hasImage &&
      infoProductBigCommerce.availability !== "disabled"
    ) {
      const transformedProduct = await transformProduct(
        config,
        infoProductBigCommerce
      );
      await insertProductToGoogleMerchant(config, transformedProduct);
      console.log("Producto creado en Google Merchant.");
    } else {
      console.log(
        "Producto no cumple con las condiciones para ser creado en Google Merchant."
      );
    }
  }
});

routerWebHooks.post("/createdProduct/:feedID", async (req, res) => {
  const { feedID } = req.params;
  const feed = await fetchOneFromTable("feeds", feedID, "feed_id");

  const storeHash = feed.store_hash;
  const accessToken = feed.x_auth_token;
  const privateKey = feed.private_key;
  const merchantId = feed.client_id;

  console.log("Webhook recibido de crear Producto");

  const config = {
    accessToken: accessToken,
    storeHash: storeHash,
    client_email: feed.client_email,
    private_key: privateKey,
    merchantId: merchantId,
    domain: feed.domain,
  };

  try {
    await activateAllWebHooks(config);
    const productData = req.body;
    const idProduct = productData.data.id;

    console.log(`El producto creado: ${JSON.stringify(productData, null, 2)}`);
    console.log(`ID del Producto: `, idProduct);

    const hasImage = await checkCustomField(config, idProduct);

    if (hasImage) {
      const product = await fetchProductById(config, idProduct);
      const transformedProducto = await transformProduct(config, product);
      const response = await insertProductToGoogleMerchant(
        config,
        transformedProducto
      );

      console.log("Producto insertado en Google Merchant con éxito: ");
      res
        .status(200)
        .send(
          "Producto creado y sincronizado correctamente con Google Merchant."
        );
    }
  } catch (error) {
    console.error(
      "Error al crear y sincronizar el producto con Google Merchant: ",
      error
    );
    res
      .status(500)
      .send("Error al procesar la solicitud de creación de producto");
  }
});

routerWebHooks.post("/deletedProduct", async (req, res) => {
  try {
    const productData = req.body;
    const idProduct = productData.data.id;

    console.log(
      `El producto eliminado: ${JSON.stringify(productData, null, 2)}`
    );
    console.log(`ID del Producto: `, idProduct);

    const infoProductGoogle = await findProductByBigCommerceId(idProduct);
    const idGoogleProduct = infoProductGoogle.id;

    await deleteGoogleMerchantProduct(idGoogleProduct);
    res
      .status(200)
      .send(
        "Producto eliminado y sincronizado correctamente en Google Merchant."
      );
  } catch (error) {
    console.error("Error al procesar la eliminación del producto: ", error);
  }
});

const { CloudSchedulerClient } = require("@google-cloud/scheduler");
//const client = new CloudSchedulerClient();

const pm2 = require("pm2");

routerWebHooks.get("/pm2Cron", (req, res) => {
  const cronPattern = "* * * * *"; // Cada minuto (puedes ajustar el patrón cron según tus necesidades)
  //const scriptPath = require("./cron-task")
  const scriptPath = "./cron-task.js";

  pm2.connect((err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error al conectar con PM2");
      return;
    }

    pm2.start(
      {
        script: scriptPath,
        name: "cron-task",
        cron: cronPattern,
        autorestart: false,
      },
      (err, apps) => {
        pm2.disconnect(); // Desconecta PM2
        if (err) {
          console.error(err);
          res.status(500).send("Error al crear el trabajo cron");
          return;
        }

        res.status(200).send("Trabajo cron creado exitosamente");
      }
    );
  });
});

module.exports = routerWebHooks;
