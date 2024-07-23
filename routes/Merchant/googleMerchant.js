const express = require("express");
const routerMerchant = express.Router();

const {
  fetchProductById,
  countAvailableProducts,
  getAvailableProducts2,
  getLimitedValidProducts,
} = require("../../api/productsBigCommerceApi");

const { transformProduct } = require("../../helpers/helpers");
const { fetchFeedByStoreHash } = require("../../databases/CRUD");

const {
  insertProductToGoogleMerchant,
  insertBatchProducts,
  getProductStatusByProductId,
  listAllProductStatuses,
  listAllProducts,
  listAllActiveProducts,
  getProductInfoGoogleMerchant
} = require("../../api/googleMerchantAPI");

const { manageDeleteProductsProcessing } = require("../../api/productsBigCommerceApi")

routerMerchant.get("/merchant/sendProductByID", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const idProducto = 124;
  const product = await fetchProductById(idProducto);
  console.log("Id Producto Usado: ", idProducto);
  console.log("Producto: ", product);
  const transformedProducto = await transformProduct(product);
  console.log("Producto transformado: ", transformedProducto);

  await insertProductToGoogleMerchant(transformedProducto);
});

routerMerchant.get("/merchant/sendBatchProducts", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const numeroProductos = 10;
  const products = await getAvailableProducts2(numeroProductos);
  console.log("Productos: ", products);
  const transformedProductos = products.map((product) =>
    transformProduct(product)
  );
  //const transformedProducto = transformProduct(product);
  //console.log("Productos transformados: ", transformedProductos);

  await insertBatchProducts(transformedProductos);
});

routerMerchant.get("/merchant/sendBatchNumberOfProducts", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const numeroProductos = 1;
  const products = await getLimitedValidProducts(numeroProductos);
  console.log("Productos: ", products.validProductIds);
  const transformedProductos = await Promise.all(
    products.validProductIds.map((product) => transformProduct(product))
  );
  //const transformedProducto = transformProduct(product);
  console.log("Productos transformados: ", transformedProductos);

  await insertBatchProducts(transformedProductos);
});

routerMerchant.get(
  "/merchant/getProductStatusByProductId",
  async (req, res) => {
    res.send("Se ha hecho una consulta a un producto");
    const idProducto = "online:en:US:3231-4";
    const products = await getProductStatusByProductId(idProducto);
    //console.log("Productos: ", products);
  }
);

routerMerchant.get("/merchant/listProductStatuses", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const products = await listAllProductStatuses();
  console.log("Productos: ", products);
});

routerMerchant.get("/merchant/listAllProducts", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const products = await listAllProducts();
  //console.log("Productos: ", products);
});

routerMerchant.get("/merchant/deleteProductWeekly", async (req, res) => {
  res.send("Se ha hecho una consulta a un producto");
  const products = await listAllProductIds();
  const conteoPages= await countPages();
  await manageDeleteProductsProcessing(conteoPages,products)
  console.log("Primeros 5 productos:", products.slice(0, 5));
  //console.log("Productos: ", products);
});


routerMerchant.post("/merchant/:storeHash", async (req, res) => {
  const StoreHash = req.params.storeHash;
  console.log("Store Hash: ", StoreHash);
  const feedInfo = await fetchFeedByStoreHash(StoreHash);

  //console.log("Feed Info: ", feedInfo);

  const config = {
    client_email: feedInfo.client_email,
    private_key: feedInfo.private_key,
    merchantId: feedInfo.client_id
};

  const totalProducts = await listAllProducts(config)
  const totalActiveProducts = await listAllActiveProducts(config)
  //const totalActiveProducts = await getProductInfoGoogleMerchant(config,"799868-A")

  console.log("Total Active Products: ", totalActiveProducts);
  res.send({totalActiveProducts:totalActiveProducts,totalProducts:totalProducts});
});


routerMerchant.post("/totalActiveProducts/multiple", async (req, res) => {
  const storeHashes = req.body.storeHashes; // Asume que el cuerpo de la solicitud contiene un array de storeHash

  console.log("Store Hashes: ", storeHashes);

  console.time("Duración total");

  try {
    const results = await Promise.all(storeHashes.map(async (storeHash) => {
      try {
        console.log("Procesando Store Hash: ", storeHash);
        const feedInfo = await fetchFeedByStoreHash(storeHash);

        if (!feedInfo) {
          console.error(`No se encontró información para el storeHash: ${storeHash}`);
          return {
            storeHash,
            totalActiveProducts: null,
            totalProducts:null,
            message: `No se encontró información para el storeHash: ${storeHash}`
          };
        }

        //console.log("Feed Info: ", feedInfo);

        const config = {
          client_email: feedInfo.client_email,
          private_key: feedInfo.private_key,
          merchantId: feedInfo.client_id
        };

        const totalActiveProducts = await listAllActiveProducts(config);
        const totalProducts = await listAllProducts(config)

        console.log("Total Active Products para Store Hash:", storeHash, totalActiveProducts);

        return {
          storeHash,
          totalActiveProducts,
          totalProducts
        };
      } catch (error) {
        console.error(`Error procesando el storeHash: ${storeHash}`, error);
        return {
          storeHash,
          totalActiveProducts: null,
          message: `Error procesando el storeHash: ${storeHash}`
        };
      }
    }));

    console.timeEnd("Duración total");
    res.send({ results });
  } catch (error) {
    console.error("Error procesando los Store Hashes: ", error);
    console.timeEnd("Duración total");
    res.status(500).send({ error: error.message });
  }
});



module.exports = routerMerchant;
