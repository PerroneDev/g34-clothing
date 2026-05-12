const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Muda o local de cache do Puppeteer para a pasta do projeto
  // garantindo que o Render mova o Chrome para a produção após o build.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
