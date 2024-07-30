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

  async function fetchWithRetry(url, options, retries = 5, delay = 10000) {
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
              await new Promise(resolve => setTimeout(resolve, delay)); // Espera 10 segundos antes de reintentar
              return await fetchWithRetry(url, options, retries - 1, delay);
          } else {
              console.error(`Error fetching category name for ID ${categoryId}:`);
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

async function buildCategoryTrees(config, categoryIds) {
  const categoryTrees = [];
  for (let i = 0; i < Math.min(categoryIds.length, 5); i++) {
      const categoryTree = await buildCategoryTree(config, categoryIds[i]);
      if (categoryTree) {
          categoryTrees.push(categoryTree);
      }
  }
  return categoryTrees.join(', '); // Combina los árboles de categorías en una sola cadena separada por comas
}

module.exports = {
  fetchCategoryNameById,
  getConfigCategories,
  getStoreDomain,
  buildCategoryTrees
};
