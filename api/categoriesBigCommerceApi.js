async function getConfigCategories(config) {
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

const fetch = require('node-fetch');

/*
async function fetchCategoryNameById(config, categoryId) {
  const { storeHash } = config;
  const options = await getConfigCategories(config);
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/categories/${categoryId}`;

  try {
    const response = await fetch(url, options);
    const categoryData = await response.json();
    return categoryData.data; // Retorna el nombre de la categoría
  } catch (error) {
    console.error(`Error fetching category name for ID ${categoryId}:`/*, error*///);
  //  return 0// O puedes optar por devolver un valor por defecto o manejar de otra manera
  //}
//}

async function fetchCategoryNameById(config, categoryId) {
  const { storeHash } = config;
  const options = await getConfigCategories(config);
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/categories/${categoryId}`;

  async function fetchWithRetry(url, options, retries = 1) {
      try {
          const response = await fetch(url, options);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const categoryData = await response.json();
          return categoryData.data; // Retorna toda la información de la categoría
      } catch (error) {
          if (retries > 0) {
              console.warn(`Retrying fetch for category ID ${categoryId}, attempts left: ${retries}`);
              return await fetchWithRetry(url, options, retries - 1);
          } else {
              console.error(`Error fetching category name for ID ${categoryId}:`, error);
              return null; // Retorna null en caso de error después de reintentar
          }
      }
  }

  return await fetchWithRetry(url, options);
}

async function getStoreDomain(config) {
  const { storeHash } = config;
  const options = await getConfigCategories(config);
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v2/store`;

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const storeInfo = await response.json();
    const domain = storeInfo.domain;

    console.log(`El dominio de la tienda es: ${domain}`);
    return domain;
  } catch (error) {
    console.error(`Error fetching store domain:`, error);
    throw error; // Re-lanza el error para que la llamada a la función pueda manejarlo
  }
}


async function buildCategoryTree(config, categoryId) {
  try {
      let categoryData = await fetchCategoryNameById(config, categoryId);
      if (!categoryData) {
          throw new Error(`Failed to fetch data for category ID ${categoryId}`);
      }
      let categoryTree = categoryData.name;

      while (categoryData.parent_id && categoryData.parent_id !== 0) {
          categoryData = await fetchCategoryNameById(config, categoryData.parent_id);
          if (!categoryData) {
              throw new Error(`Failed to fetch data for parent category ID ${categoryData.parent_id}`);
          }
          categoryTree = `${categoryData.name} > ${categoryTree}`;
      }

      return categoryTree;
  } catch (error) {
      console.error("Error building category tree: 100");
      return 1; // Retorna un mensaje de error
  }
}

module.exports = {
  fetchCategoryNameById,
  getConfigCategories,
  getStoreDomain,
  buildCategoryTree
};
