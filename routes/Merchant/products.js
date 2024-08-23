const express = require("express");
const routerProducts= express.Router();

const {
    fetchProductById,
    getAvailableProducts,
    checkCustomField,
    getProductCustomFields,
    countPages,
    manageProductProcessing, fetchProductIdsBySKUs
} = require("../../api/productsBigCommerceApi");

const { fetchOneFromTable } = require("../../databases/CRUD");

const { transformProduct } = require("../../helpers/helpers")

routerProducts.get("/products/getProductByID", async (req, res) => {
    res.send("Se ha hecho una consulta a un producto");
    const idProducto = 87341;
    const product = await fetchProductById(idProducto);
    console.log("Id Producto Usado: ", product);

    console.log("Producto: ", product);
    const respuesta = await checkCustomField(idProducto);
    console.log("Respuesta: ", respuesta);
    
    const respuestaCustomFliends = await getProductCustomFields(idProducto);
    console.log("Respuesta CustomFliends: ", respuestaCustomFliends);

})

routerProducts.get("/products/deleteProduct/:id/:feedID", async (req, res) => {
    const productId = req.params.id;
    const feedId = req.params.feedID;

    const feed = await fetchOneFromTable("feeds", feedId, "feed_id");

    const storeHash = feed.store_hash;
    const accessToken = feed.x_auth_token;
    
    console.log("Store Hash: ", storeHash);
    console.log("Access Token: ", accessToken);
  
    const config = {
      accessToken: accessToken,
      storeHash: storeHash,
    };

    res.send("Se ha hecho una consulta a un producto");
    const product = await deleteProduct(config, productId);

})

routerProducts.get("/products/countAvailableProducts", async (req, res) => {
    res.send("Se ha hecho una consulta a un producto");
    //const conteoPages= await countPages();
    const conteoByTipo = await getAvailableProducts();   // Productos mayores a 0: 17440
    console.log("Conteo total de productos con parametros: ", conteoByTipo);
    
})

routerProducts.get("/products/sendProductsToGoogleMechant", async (req, res) => {
    res.send("Se ha hecho una consulta a un producto");
    const conteoPages= await countPages();
    const conteoByTipo = await manageProductProcessing(conteoPages);  
})

routerProducts.get("/products/countPages", async (req, res) => {
    res.send("Se ha hecho una consulta a un producto");
    const conteoPages= await countPages();   // Productos mayores a 0: 17440
    console.log("Conteo total de productos con parametros: ", conteoPages);

})

  routerProducts.post("/products/fetchProductIds/:feedId", async (req, res) => {
    const { feedId } = req.params;
    const skus = req.body.skus;

    if (!Array.isArray(skus) || skus.length === 0) {
        return res.status(400).json({ message: "Se requiere una lista de SKUs válida." });
    }

    try {
        // Obtener el feed desde la base de datos
        const feed = await fetchOneFromTable("feeds", feedId, "feed_id");

        if (!feed) {
            return res.status(404).json({ message: "Feed no encontrado." });
        }

        // Crear la configuración a partir de los datos del feed
        const storeHash = feed.store_hash;
        const accessToken = feed.x_auth_token;
        const privateKey = feed.private_key; // decrypt(JSON.parse(feed.private_key));
        const merchantId = feed.client_id;
        const formula = feed.formulas;

        console.log("Formula: ", formula);
        console.log("Store Hash: ", storeHash);
        console.log("Access Token: ", accessToken);

        //const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products`;
        //const url = await buildQueryUrl(baseUrl, formula);

        const config = {
            accessToken: accessToken,
            storeHash: storeHash,
            client_email: feed.client_email,
            private_key: privateKey,
            merchantId: merchantId,
            domain: feed.domain
        };

        // Llamar a la función para obtener los IDs de productos por SKUs
        const productIds = await fetchProductIdsBySKUs(config, skus);
        res.status(200).json({ productIds });
    } catch (error) {
        console.error("Error fetching product IDs by SKUs:", error);
        res.status(500).json({ message: "Error al obtener los IDs de productos." });
    }
});






module.exports = routerProducts;